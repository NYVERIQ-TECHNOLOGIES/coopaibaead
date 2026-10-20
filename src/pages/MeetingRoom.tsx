import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Camera, CameraOff, Copy, Lock, LockOpen, Mic, MicOff, MonitorUp, PhoneOff, Radio, Send, ShieldX, Users, Video, VideoOff } from "lucide-react";
import MeetingChat from "@/components/meetings/MeetingChat";
import { callMeeting, meetingUrl, when } from "@/components/meetings/data";
import type { Database } from "@/integrations/supabase/types";

type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
type Signal = Database["public"]["Tables"]["meeting_signals"]["Row"];
type Session = Database["public"]["Tables"]["meeting_sessions"]["Row"];
type Request = Database["public"]["Tables"]["meeting_access_requests"]["Row"];
type Peer = { id: string; stream: MediaStream };
const iceConfig: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

function VideoTile({ stream, label, muted = false }: { stream: MediaStream; label: string; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; return () => { if (ref.current) ref.current.srcObject = null; }; }, [stream]);
  return <div className="relative aspect-video min-w-0 overflow-hidden rounded-md bg-muted"><video ref={ref} autoPlay playsInline muted={muted} className="h-full w-full object-contain"/><div className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-xs font-medium text-foreground">{label}</div></div>;
}

export default function MeetingRoom() {
  const { token } = useParams<{ token: string }>();
  const { user, profile } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [googleLink, setGoogleLink] = useState<{ meet_url: string } | null>(null);
  const [linkInfo, setLinkInfo] = useState<{ found: boolean; id?: string; title?: string; allowed?: boolean; manager?: boolean; requested?: boolean; access_type?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [peers, setPeers] = useState<Peer[]>([]);
  const [error, setError] = useState("");
  const local = useRef<MediaStream | null>(null);
  const cameraTrack = useRef<MediaStreamTrack | null>(null);
  const displayTrack = useRef<MediaStreamTrack | null>(null);
  const connections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIce = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const sessionId = useRef<string | null>(null);
  const joinedRef = useRef(false);
  const managerRef = useRef(false);
  const recordingRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  const loadInfo = useCallback(async () => {
    if (!token || !user) return;
    try {
      const info = await callMeeting<typeof linkInfo>("meeting_link_info", { _token: token });
      setLinkInfo(info);
      managerRef.current = !!info?.manager;
      if (info?.id && info.allowed) {
        const { data, error: fetchError } = await supabase.from("meetings").select("*").eq("id", info.id).single();
        if (fetchError) throw fetchError;
        setMeeting(data);
        if (data?.provider === "google_meet") {
          // RLS devolve o link somente para quem pode entrar (meeting_can_enter).
          const { data: gl } = await supabase.from("meeting_google_links").select("meet_url").eq("meeting_id", info.id).maybeSingle();
          setGoogleLink(gl ?? null);
        } else setGoogleLink(null);
      } else { setMeeting(null); setGoogleLink(null); }
    } catch (err) { setError((err as Error).message); }
  }, [token, user?.id]);
  useEffect(() => { void loadInfo(); }, [loadInfo]);
  useEffect(() => { if (!token || !user) return; const timer = window.setInterval(() => void loadInfo(), 12000); return () => window.clearInterval(timer); }, [loadInfo, token, user?.id]);

  const loadPresence = useCallback(async () => {
    if (!meeting || !joinedRef.current) return;
    const [s, r] = await Promise.all([
      supabase.from("meeting_sessions").select("*").eq("meeting_id", meeting.id).is("left_at", null),
      managerRef.current ? supabase.from("meeting_access_requests").select("*").eq("meeting_id", meeting.id).eq("status", "pendente") : Promise.resolve({ data: [] as Request[] }),
    ]);
    const active = (s.data ?? []).filter(row => new Date(row.last_seen_at).getTime() > Date.now() - 90000);
    setSessions(active);
    setRequests(r.data ?? []);
    const ids = [...new Set([...active.map(row => row.user_id), ...(r.data ?? []).map(row => row.user_id)])];
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("user_id,full_name").in("user_id", ids);
      setNames(Object.fromEntries((data ?? []).map(row => [row.user_id, row.full_name])));
    }
  }, [meeting?.id]);
  useEffect(() => { if (!joined) return; void loadPresence(); const timer = window.setInterval(() => void loadPresence(), 8000); return () => window.clearInterval(timer); }, [joined, loadPresence]);

  const send = useCallback(async (to: string, kind: string, payload: Record<string, unknown>) => {
    if (!meeting || !user || to === user.id) return;
    const { error: sendError } = await supabase.from("meeting_signals").insert({ meeting_id: meeting.id, sender_id: user.id, recipient_id: to, kind, payload: payload as Signal["payload"] });
    if (sendError) console.warn("Falha na sinalização da reunião:", sendError.message);
  }, [meeting?.id, user?.id]);

  const closePeer = useCallback((id: string) => {
    connections.current.get(id)?.close(); connections.current.delete(id); pendingIce.current.delete(id);
    setPeers(prev => prev.filter(peer => peer.id !== id));
  }, []);

  const makePeer = useCallback((id: string) => {
    closePeer(id);
    const pc = new RTCPeerConnection(iceConfig);
    connections.current.set(id, pc);
    local.current?.getTracks().forEach(track => pc.addTrack(track, local.current as MediaStream));
    pc.onicecandidate = event => { if (event.candidate) void send(id, "ice", { candidate: event.candidate.toJSON() }); };
    pc.ontrack = event => { const stream = event.streams[0]; if (stream) setPeers(prev => [...prev.filter(peer => peer.id !== id), { id, stream }]); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === "failed" || pc.connectionState === "closed") closePeer(id); };
    return pc;
  }, [closePeer, send]);

  const handleSignal = useCallback(async (signal: Signal) => {
    if (!joinedRef.current || !user || signal.sender_id === user.id) return;
    const from = signal.sender_id;
    const payload = signal.payload as Record<string, unknown>;
    try {
      if (signal.kind === "control") {
        if (!managerRef.current && payload.action === "mute") { const track = local.current?.getAudioTracks()[0]; if (track) track.enabled = false; setMic(false); toast.info("Seu microfone foi silenciado pelo responsável."); }
        if (!managerRef.current && payload.action === "camera_off") { const track = local.current?.getVideoTracks()[0]; if (track) track.enabled = false; setCam(false); toast.info("Sua câmera foi desligada pelo responsável."); }
        if (!managerRef.current && payload.action === "remove") { await leave(); toast.error("Você foi removido desta reunião."); }
        return;
      }
       if (signal.kind === "ice" && payload.action === "bye") { closePeer(from); return; }
       if (signal.kind === "ice" && payload.action === "hello") {
        if (!local.current || connections.current.has(from)) return;
        const pc = makePeer(from);
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
        await send(from, "offer", { sdp: offer.sdp });
      } else if (signal.kind === "offer") {
        if (!local.current || typeof payload.sdp !== "string") return;
        const pc = makePeer(from);
        await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
        for (const candidate of pendingIce.current.get(from) ?? []) await pc.addIceCandidate(candidate);
        pendingIce.current.delete(from);
        const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
        await send(from, "answer", { sdp: answer.sdp });
      } else if (signal.kind === "answer") {
        const pc = connections.current.get(from);
        if (!pc || typeof payload.sdp !== "string" || pc.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
        for (const candidate of pendingIce.current.get(from) ?? []) await pc.addIceCandidate(candidate);
        pendingIce.current.delete(from);
      } else if (signal.kind === "ice" && payload.candidate) {
        const candidate = payload.candidate as RTCIceCandidateInit;
        const pc = connections.current.get(from);
        if (pc?.remoteDescription) await pc.addIceCandidate(candidate);
        else pendingIce.current.set(from, [...(pendingIce.current.get(from) ?? []), candidate]);
      }
    } catch (err) { console.warn("Não foi possível conectar participante:", err); }
  // leave uses refs so callbacks remain stable through the session
  }, [user?.id, makePeer, closePeer, send]);

  useEffect(() => {
    if (!meeting || !joined || !user) return;
    const channel = supabase.channel(`meeting-signals-${meeting.id}-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "meeting_signals", filter: `recipient_id=eq.${user.id}` }, ({ new: row }) => {
        const signal = row as Signal;
        if (signal.meeting_id === meeting.id) void handleSignal(signal);
      }).subscribe(status => {
        if (status === "SUBSCRIBED") {
          void supabase.from("meeting_sessions").select("user_id").eq("meeting_id", meeting.id).is("left_at", null).then(({ data }) => {
             for (const row of data ?? []) if (row.user_id !== user.id) void send(row.user_id, "ice", { action: "hello" });
          });
        }
      });
    const heartbeat = window.setInterval(async () => {
      if (sessionId.current) await callMeeting("meeting_heartbeat", { _sid: sessionId.current }).catch(() => void loadInfo());
    }, 25000);
    return () => { window.clearInterval(heartbeat); void supabase.removeChannel(channel); };
  }, [meeting?.id, joined, user?.id, handleSignal, send, loadInfo]);
   useEffect(() => { if (!joined || !meeting || !user) return; for (const s of sessions) if (s.user_id !== user.id && !connections.current.has(s.user_id)) void send(s.user_id, "ice", { action: "hello" }); for (const id of connections.current.keys()) if (!sessions.some(s => s.user_id === id)) closePeer(id); }, [sessions, joined, meeting?.id, user?.id, send, closePeer]);
  useEffect(() => { if (joined && (meeting?.status !== "em_andamento" || !linkInfo?.allowed)) { void leave(); toast.info("A reunião foi encerrada ou seu acesso mudou."); } }, [meeting?.status, linkInfo?.allowed, joined]);

  async function join() {
    if (!meeting || busy || !linkInfo?.allowed) return;
    setBusy(true); setError("");
    try {
      // Capture first so a denied browser permission never creates a phantom attendee.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(async () => navigator.mediaDevices.getUserMedia({ audio: true }));
      local.current = stream; cameraTrack.current = stream.getVideoTracks()[0] ?? null; setCam(!!cameraTrack.current); setMic(!!stream.getAudioTracks()[0]);
      try { sessionId.current = await callMeeting<string>("meeting_join", { _id: meeting.id }); }
      catch (err) { stream.getTracks().forEach(track => track.stop()); local.current = null; throw err; }
      joinedRef.current = true; setJoined(true);
    } catch (err) { setError((err as Error).message || "Não foi possível acessar câmera e microfone."); }
    finally { setBusy(false); }
  }
  async function leave() {
    joinedRef.current = false;
    if (recordingRef.current && recordingRef.current.state !== "inactive") recordingRef.current.stop();
     if (meeting && user) for (const id of connections.current.keys()) void send(id, "ice", { action: "bye" });
    connections.current.forEach(pc => pc.close()); connections.current.clear(); pendingIce.current.clear(); setPeers([]);
    displayTrack.current?.stop(); displayTrack.current = null;
    local.current?.getTracks().forEach(track => track.stop()); local.current = null;
    if (sessionId.current) { const id = sessionId.current; sessionId.current = null; await callMeeting("meeting_leave", { _sid: id }).catch(() => undefined); }
    setJoined(false); setSharing(false);
  }
  useEffect(() => () => { joinedRef.current = false; local.current?.getTracks().forEach(track => track.stop()); displayTrack.current?.stop(); connections.current.forEach(pc => pc.close()); if (sessionId.current) void callMeeting("meeting_leave", { _sid: sessionId.current }); }, []);
  function toggleMic() { const track = local.current?.getAudioTracks()[0]; if (track) { track.enabled = !track.enabled; setMic(track.enabled); } }
  function toggleCam() { const track = local.current?.getVideoTracks()[0]; if (track) { track.enabled = !track.enabled; setCam(track.enabled); } }
  async function toggleScreen() {
    if (!meeting?.allow_screen_share || !local.current) return;
    if (sharing) { displayTrack.current?.stop(); displayTrack.current = null; const track = cameraTrack.current; if (track) { local.current.removeTrack(local.current.getVideoTracks()[0]); local.current.addTrack(track); connections.current.forEach(pc => { void pc.getSenders().find(s => s.track?.kind === "video")?.replaceTrack(track); }); } setSharing(false); return; }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0]; if (!track) return;
      displayTrack.current = track; track.onended = () => { if (displayTrack.current === track) void toggleScreen(); };
      const old = local.current.getVideoTracks()[0]; if (old) local.current.removeTrack(old);
      local.current.addTrack(track); connections.current.forEach(pc => { void pc.getSenders().find(s => s.track?.kind === "video")?.replaceTrack(track); }); setSharing(true);
    } catch { toast.error("Não foi possível compartilhar a tela."); }
  }
  async function action(name: string) { if (!meeting) return; try { await callMeeting("meeting_set_state", { _id: meeting.id, _action: name }); await loadInfo(); if (name === "encerrar") await leave(); } catch (err) { toast.error((err as Error).message); } }
  async function createMeet() {
    if (!meeting || busy) return;
    setBusy(true); setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("meeting-create-meet", { body: { meetingId: meeting.id } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      toast.success("Sala do Google Meet criada.");
      await loadInfo();
    } catch (err) { toast.error((err as Error).message || "Não foi possível criar a sala do Google Meet."); }
    finally { setBusy(false); }
  }
  async function moderate(id: string, command: "mute" | "camera_off" | "remove") {
    if (!meeting || !linkInfo?.manager || id === user?.id) return;
    try {
      if (command === "remove") { await callMeeting("meeting_remove_participant", { _id: meeting.id, _target: id }); await loadPresence(); }
      await send(id, "control", { action: command });
      toast.success(command === "remove" ? "Participante removido." : "Controle enviado.");
    } catch (err) { toast.error((err as Error).message); }
  }
  async function record() {
    if (!meeting || !linkInfo?.manager || !meeting.allow_recording || !local.current) return;
    if (recordingRef.current?.state === "recording") { recordingRef.current.stop(); await action("parar_gravacao"); return; }
    try {
      await callMeeting("meeting_set_state", { _id: meeting.id, _action: "gravar" });
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/webm";
      const recorder = new MediaRecorder(local.current, { mimeType }); chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" }); setRecording(false); recordingRef.current = null;
        if (blob.size) {
          const name = `reuniao-${meeting.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
          const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
          const { error: logError } = await supabase.from("meeting_recordings").insert({ meeting_id: meeting.id, file_name: name, file_size: blob.size, duration_seconds: Math.round((Date.now() - started) / 1000), created_by: user?.id ?? "", storage_type: "local" });
          if (logError) toast.warning("Arquivo baixado, mas não foi possível registrar a gravação."); else toast.success("Gravação baixada neste dispositivo.");
        }
      };
      const started = Date.now(); recorder.start(1000); recordingRef.current = recorder; setRecording(true); await loadInfo();
    } catch (err) { toast.error((err as Error).message); await action("parar_gravacao"); }
  }
  const activeIds = [...new Set(sessions.map(s => s.user_id))];
  return <div className="mx-auto max-w-7xl space-y-5 pb-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><Button asChild size="sm" variant="ghost"><Link to="/reunioes"><ArrowLeft className="mr-2 h-4 w-4"/>Reuniões</Link></Button><h1 className="text-2xl font-bold">{meeting?.title ?? linkInfo?.title ?? "Sala de reunião"}</h1>{meeting && <p className="text-sm text-muted-foreground">{when(meeting.start_at)} · {meeting.description}</p>}</div><div className="flex items-center gap-2">{meeting?.recording_active && <Badge variant="destructive" className="gap-1"><Radio className="h-3 w-3"/>Gravando</Badge>}<Badge variant={meeting?.status === "em_andamento" ? "default" : "secondary"}>{meeting?.status === "em_andamento" ? "Ao vivo" : meeting?.status === "agendada" ? "Agendada" : meeting?.status === "encerrada" ? "Encerrada" : meeting?.status === "cancelada" ? "Cancelada" : "Acesso restrito"}</Badge></div></div>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {!linkInfo ? <p>Carregando reunião…</p> : !linkInfo.found ? <p>Este link não corresponde a uma reunião.</p> : !linkInfo.allowed ? <div className="space-y-3 border-t border-border py-8"><p>Você ainda não tem acesso a esta reunião.</p>{linkInfo.access_type === "aprovacao" && !linkInfo.requested && <Button onClick={async () => { try { await callMeeting("meeting_request_entry", { _token: token }); await loadInfo(); toast.success("Solicitação enviada."); } catch (err) { toast.error((err as Error).message); } }}>Solicitar entrada</Button>}{linkInfo.requested && <p className="text-sm text-muted-foreground">Solicitação aguardando aprovação.</p>}</div> : meeting && <>
      {meeting.recording_active && <div role="status" className="border-l-4 border-destructive bg-muted px-4 py-3 text-sm">Esta reunião está sendo gravada. Avise os participantes antes de continuar.</div>}
      {meeting.provider === "google_meet" ? <div className="max-w-xl space-y-4 rounded-xl border border-border p-6">
        <p className="text-sm">Esta reunião acontece no Google Meet. Ao entrar, você usará o ambiente oficial do Google, com áudio, vídeo, chat e os recursos de segurança do próprio Google Meet.</p>
        {googleLink?.meet_url ? <div className="flex flex-wrap gap-2"><Button onClick={() => window.open(googleLink.meet_url, "_blank", "noopener,noreferrer")}><Video className="mr-2 h-4 w-4"/>Entrar no Google Meet</Button>{linkInfo.manager && <Button size="icon" variant="outline" title="Copiar link do Google Meet" aria-label="Copiar link do Google Meet" onClick={() => { void navigator.clipboard.writeText(googleLink.meet_url); toast.success("Link copiado."); }}><Copy className="h-4 w-4"/></Button>}</div> : linkInfo.manager ? <Button onClick={() => void createMeet()} disabled={busy}><Video className="mr-2 h-4 w-4"/>{busy ? "Criando…" : "Criar sala do Google Meet"}</Button> : <p className="text-sm text-muted-foreground">A sala do Google Meet ainda não foi criada pelo responsável.</p>}
        <div className="flex flex-wrap gap-2 items-center border-t border-border pt-4">{meeting.status === "agendada" && linkInfo.manager && <Button variant="outline" disabled={!googleLink?.meet_url} title={googleLink?.meet_url ? undefined : "Crie a sala do Google Meet antes de iniciar"} onClick={() => void action("iniciar")}><Video className="mr-2 h-4 w-4"/>Iniciar reunião no Google Meet</Button>}{linkInfo.manager && <Button size="icon" variant="outline" title="Copiar link da plataforma" aria-label="Copiar link da plataforma" onClick={() => { void navigator.clipboard.writeText(meetingUrl(meeting.meeting_token)); toast.success("Link copiado."); }}><Copy className="h-4 w-4"/></Button>}{linkInfo.manager && meeting.status === "em_andamento" && <Button variant="destructive" onClick={() => { if (confirm("Encerrar a reunião para todos?")) void action("encerrar"); }}><PhoneOff className="mr-2 h-4 w-4"/>Encerrar reunião</Button>}</div>
      </div> : null}
      {meeting.provider !== "google_meet" && <div className="flex flex-wrap gap-2 items-center">{meeting.status === "agendada" && linkInfo.manager && <Button onClick={() => void action("iniciar")}><Video className="mr-2 h-4 w-4"/>Iniciar reunião</Button>}{meeting.status === "em_andamento" && !joined && <Button onClick={() => void join()} disabled={busy}><Video className="mr-2 h-4 w-4"/>{busy ? "Entrando…" : "Entrar na sala"}</Button>}{linkInfo.manager && <Button size="icon" variant="outline" title="Copiar link" aria-label="Copiar link" onClick={() => { void navigator.clipboard.writeText(meetingUrl(meeting.meeting_token)); toast.success("Link copiado."); }}><Copy className="h-4 w-4"/></Button>}{linkInfo.manager && meeting.status === "em_andamento" && <><Button size="icon" variant="outline" title={meeting.room_locked ? "Desbloquear sala" : "Bloquear sala"} aria-label={meeting.room_locked ? "Desbloquear sala" : "Bloquear sala"} onClick={() => void action(meeting.room_locked ? "desbloquear" : "bloquear")}>{meeting.room_locked ? <Lock className="h-4 w-4"/> : <LockOpen className="h-4 w-4"/>}</Button><Button variant="destructive" onClick={() => { if (confirm("Encerrar a reunião para todos?")) void action("encerrar"); }}><PhoneOff className="mr-2 h-4 w-4"/>Encerrar para todos</Button></>}</div>}
      {meeting.provider !== "google_meet" && joined && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="min-w-0 space-y-4"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{local.current && <VideoTile stream={local.current} muted label={`${profile?.full_name ?? "Você"} (você)`}/>} {peers.map(peer => <VideoTile key={peer.id} stream={peer.stream} label={names[peer.id] ?? "Participante"}/>)}</div><div className="flex flex-wrap gap-2 border-t border-border pt-3"><Button size="icon" variant={mic ? "outline" : "destructive"} aria-label={mic ? "Desligar microfone" : "Ligar microfone"} title={mic ? "Desligar microfone" : "Ligar microfone"} onClick={toggleMic}>{mic ? <Mic className="h-4 w-4"/> : <MicOff className="h-4 w-4"/>}</Button><Button size="icon" variant={cam ? "outline" : "destructive"} aria-label={cam ? "Desligar câmera" : "Ligar câmera"} title={cam ? "Desligar câmera" : "Ligar câmera"} onClick={toggleCam} disabled={!cameraTrack.current}>{cam ? <Camera className="h-4 w-4"/> : <CameraOff className="h-4 w-4"/>}</Button>{meeting.allow_screen_share && <Button size="icon" variant={sharing ? "default" : "outline"} title={sharing ? "Parar compartilhamento" : "Compartilhar tela"} aria-label={sharing ? "Parar compartilhamento" : "Compartilhar tela"} onClick={() => void toggleScreen()}><MonitorUp className="h-4 w-4"/></Button>}{linkInfo.manager && meeting.allow_recording && <Button size="icon" variant={recording ? "destructive" : "outline"} title={recording ? "Parar gravação" : "Gravar reunião neste dispositivo"} aria-label={recording ? "Parar gravação" : "Gravar reunião neste dispositivo"} onClick={() => void record()}>{recording ? <Radio className="h-4 w-4"/> : <Video className="h-4 w-4"/>}</Button>}<Button variant="outline" onClick={() => void leave()}><PhoneOff className="mr-2 h-4 w-4"/>Sair</Button></div><p className="text-xs text-muted-foreground">A gravação é baixada somente neste dispositivo; não fica disponível online.</p></div><aside className="min-w-0 space-y-4"><section className="space-y-2"><h2 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4"/>Participantes ({activeIds.length})</h2><div className="max-h-44 overflow-y-auto divide-y divide-border">{activeIds.map(id => <div key={id} className="flex items-center justify-between gap-2 py-2 text-sm"><span className="min-w-0 truncate">{id === user?.id ? `${profile?.full_name ?? "Você"} (você)` : names[id] ?? "Participante"}</span>{linkInfo.manager && id !== user?.id && <div className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" title="Silenciar participante" aria-label="Silenciar participante" onClick={() => void moderate(id, "mute")}><MicOff className="h-4 w-4"/></Button><Button size="icon" variant="ghost" title="Desligar câmera do participante" aria-label="Desligar câmera do participante" onClick={() => void moderate(id, "camera_off")}><VideoOff className="h-4 w-4"/></Button><Button size="icon" variant="ghost" title="Remover participante" aria-label="Remover participante" onClick={() => { if (confirm("Remover participante desta reunião?")) void moderate(id, "remove"); }}><ShieldX className="h-4 w-4 text-destructive"/></Button></div>}</div>)}</div></section>{linkInfo.manager && requests.length > 0 && <section className="space-y-2"><h2 className="font-semibold">Solicitações de entrada</h2>{requests.map(req => <div key={req.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{names[req.user_id] ?? "Usuário"}</span><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => void callMeeting("meeting_decide_entry", { _request_id: req.id, _approve: true }).then(loadPresence).catch(err => toast.error(err.message))}>Permitir</Button><Button size="sm" variant="ghost" onClick={() => void callMeeting("meeting_decide_entry", { _request_id: req.id, _approve: false }).then(loadPresence).catch(err => toast.error(err.message))}>Recusar</Button></div></div>)}</section>}<section className="h-80 border-t border-border pt-3"><h2 className="font-semibold mb-2">Chat</h2><div className="h-[calc(100%-2rem)]"><MeetingChat id={meeting.id} names={names}/></div></section></aside></div>}
    </>}
  </div>;
}
