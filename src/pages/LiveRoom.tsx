import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  ArrowLeft, Circle, Lock, Mic, MicOff, MonitorUp, Radio, ShoppingCart, Square, Users, Video, VideoOff, X,
} from "lucide-react";
import LiveChat from "@/components/live/LiveChat";
import { formatDuration, useLiveSession } from "@/components/live/useLiveSession";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { isPaymentsConfigured } from "@/lib/stripe";

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

interface Participant {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  joined_at: string | null;
  left_at: string | null;
  total_seconds: number;
  online: boolean;
}

export default function LiveRoom() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingRef = useRef(false);

  const [broadcasting, setBroadcasting] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [remoteRecording, setRemoteRecording] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);

  const { data: lc, isLoading, refetch } = useQuery({
    queryKey: ["live-room", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_classes")
        .select("*, courses(title)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const isHost = useMemo(
    () => !!lc && !!user && (lc.teacher_id === user.id || role === "admin" || role === "moderador"),
    [lc, user, role],
  );

  // Acesso à sala (inclui cobrança automática de cursos pagos)
  const { data: access, isLoading: accessLoading, refetch: refetchAccess } = useQuery({
    queryKey: ["live-access", id],
    enabled: !!id && !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("live_class_access", { _live_class_id: id! });
      if (error) throw error;
      return data as unknown as {
        allowed: boolean; reason?: string; is_host?: boolean;
        course_id?: string; course_title?: string;
        price?: number | null; promotional_price?: number | null;
      };
    },
  });
  const allowed = access?.allowed === true;

  // Presença: só participantes (não o professor) contam para o relatório,
  // mas todos mantêm sessão para o contador em tempo real.
  const { sessionId } = useLiveSession(id, !!lc && allowed);

  const { data: myAttendance } = useQuery({
    queryKey: ["live-my-attendance", id, sessionId],
    enabled: !!id && !isHost,
    queryFn: async () => {
      const { data } = await supabase.rpc("live_my_attendance", { _live_class_id: id! });
      return data as { total_seconds: number; percent: number; min_percent: number; status: string } | null;
    },
    refetchInterval: 60000,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["live-participants", id],
    enabled: !!id && isHost,
    queryFn: async () => {
      const { data } = await supabase.rpc("live_class_participants", { _live_class_id: id! });
      return (data ?? []) as Participant[];
    },
    refetchInterval: 15000,
  });

  const { data: viewers = [] } = useQuery({
    queryKey: ["live-viewers", id],
    enabled: !!id && !isHost && allowed,
    queryFn: async () => {
      const { data } = await supabase.rpc("live_viewer_participants", { _live_class_id: id! });
      return (data ?? []) as { user_id: string; full_name: string; avatar_url: string | null; role: string; online: boolean }[];
    },
    refetchInterval: 15000,
  });

  const onlineCount = isHost
    ? participants.filter((p) => p.online).length
    : viewers.filter((v) => v.online).length;

  // Cronômetro da transmissão
  useEffect(() => {
    if (!broadcasting && !receiving) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [broadcasting, receiving]);

  // ---------- Sinalização WebRTC via Realtime ----------
  const sendSignal = useCallback((event: string, payload: Record<string, unknown>) => {
    void channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const createHostPeer = useCallback(async (viewerId: string) => {
    const stream = localStreamRef.current;
    if (!stream || !user) return;
    peersRef.current.get(viewerId)?.close();
    const pc = new RTCPeerConnection(ICE);
    peersRef.current.set(viewerId, pc);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal("ice", { to: viewerId, from: user.id, candidate: e.candidate.toJSON() });
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal("offer", { to: viewerId, from: user.id, sdp: offer.sdp });
  }, [sendSignal, user]);

  useEffect(() => {
    if (!id || !user) return;
    const channel = supabase.channel(`live-signal-${id}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "hello" }, ({ payload }) => {
        if (!isHost || !localStreamRef.current) return;
        void createHostPeer(payload.from as string);
        sendSignal("rec-state", { recording: recordingRef.current });
      })
      .on("broadcast", { event: "host-online" }, () => {
        if (isHost) return;
        sendSignal("hello", { from: user.id });
      })
      .on("broadcast", { event: "rec-state" }, ({ payload }) => {
        if (isHost) return;
        const on = !!payload.recording;
        setRemoteRecording(on);
        if (on) {
          setNoticeOpen(true);
          toast.info("Esta aula está sendo gravada.");
        }
      })
      .on("broadcast", { event: "host-stop" }, () => {
        if (isHost) return;
        setReceiving(false);
        setRemoteRecording(false);
        peersRef.current.forEach((pc) => pc.close());
        peersRef.current.clear();
        if (videoRef.current) videoRef.current.srcObject = null;
      })
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (isHost || payload.to !== user.id) return;
        peersRef.current.get("host")?.close();
        const pc = new RTCPeerConnection(ICE);
        peersRef.current.set("host", pc);
        pc.ontrack = (e) => {
          if (videoRef.current) videoRef.current.srcObject = e.streams[0];
          setReceiving(true);
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            sendSignal("ice", { to: payload.from, from: user.id, candidate: e.candidate.toJSON() });
          }
        };
        await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp as string });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal("answer", { to: payload.from, from: user.id, sdp: answer.sdp });
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (!isHost || payload.to !== user.id) return;
        const pc = peersRef.current.get(payload.from as string);
        if (pc && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp as string });
        }
      })
      .on("broadcast", { event: "ice" }, async ({ payload }) => {
        if (payload.to !== user.id) return;
        const key = isHost ? (payload.from as string) : "host";
        const pc = peersRef.current.get(key);
        try { await pc?.addIceCandidate(payload.candidate as RTCIceCandidateInit); } catch { /* ignora */ }
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (isHost) { if (localStreamRef.current) sendSignal("host-online", { from: user.id }); }
        else sendSignal("hello", { from: user.id });
      });

    // Reenvia "hello" periodicamente para reconectar após queda de rede
    const retry = window.setInterval(() => {
      if (!isHost && !receiving) sendSignal("hello", { from: user.id });
    }, 10000);

    return () => {
      window.clearInterval(retry);
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id, isHost, receiving]);

  // ---------- Controles do professor ----------
  async function startBroadcast() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; }
      setBroadcasting(true);
      setElapsed(0);
      sendSignal("host-online", { from: user!.id });

      await supabase.from("live_classes").update({
        status: "ao_vivo",
        started_at: lc?.started_at ?? new Date().toISOString(),
      }).eq("id", id!);
      void refetch();

      if (lc?.recording_enabled !== false) startRecording(stream);
      toast.success("Transmissão iniciada.");
    } catch {
      toast.error("Não foi possível acessar a câmera e o microfone.");
    }
  }

  function startRecording(stream?: MediaStream) {
    const src = stream ?? localStreamRef.current;
    if (!src) return toast.error("Inicie a transmissão antes de gravar.");
    if (recorderRef.current) return;
    try {
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const rec = new MediaRecorder(src, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start(5000);
      recorderRef.current = rec;
      recordingRef.current = true;
      setRecording(true);
      setNoticeOpen(true);
      sendSignal("rec-state", { recording: true });
      toast.info("A gravação da aula foi iniciada.");
    } catch {
      toast.warning("A gravação automática não é suportada neste navegador.");
    }
  }

  async function stopRecording() {
    if (!recorderRef.current) return;
    recordingRef.current = false;
    sendSignal("rec-state", { recording: false });
    await finishRecording();
  }

  async function finishRecording() {
    const rec = recorderRef.current;
    if (!rec) return;
    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: "video/webm" }));
      rec.stop();
    });
    recorderRef.current = null;
    recordingRef.current = false;
    setRecording(false);
    if (blob.size === 0) return;

    toast.info("Processando a gravação…");
    const { data: existing } = await supabase
      .from("live_recordings").select("id").eq("live_class_id", id!).maybeSingle();

    let recId = existing?.id;
    if (!recId) {
      const { data, error } = await supabase.from("live_recordings").insert({
        live_class_id: id!, course_id: lc!.course_id, module_id: lc!.module_id,
        title: lc!.title, description: lc!.description, status: "processando", source: "nativo",
      }).select("id").single();
      if (error) { toast.error("Não foi possível registrar a gravação."); return; }
      recId = data.id;
    }

    const path = `${id}/${recId}.webm`;
    const { error: upErr } = await supabase.storage.from("gravacoes")
      .upload(path, blob, { contentType: "video/webm", upsert: true });
    if (upErr) {
      await supabase.from("live_recordings").update({
        status: "aguardando_upload", error_message: upErr.message,
      }).eq("id", recId);
      return toast.error("A gravação não pôde ser enviada. Envie o arquivo manualmente.");
    }

    await supabase.from("live_recordings").update({
      storage_path: path, file_size: blob.size, status: "pronta", error_message: null,
    }).eq("id", recId);
    await supabase.from("live_classes").update({ recording_status: "pronta" }).eq("id", id!);
    toast.success("Gravação disponível.");
  }

  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  async function toggleShare() {
    const stream = localStreamRef.current;
    if (!stream) return;
    try {
      if (sharing) {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true });
        const camTrack = cam.getVideoTracks()[0];
        replaceVideoTrack(stream, camTrack);
        setSharing(false);
      } else {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = display.getVideoTracks()[0];
        screenTrack.onended = () => { void toggleShare(); };
        replaceVideoTrack(stream, screenTrack);
        setSharing(true);
      }
    } catch {
      toast.error("Não foi possível alternar o compartilhamento de tela.");
    }
  }

  function replaceVideoTrack(stream: MediaStream, track: MediaStreamTrack) {
    const old = stream.getVideoTracks()[0];
    if (old) { stream.removeTrack(old); old.stop(); }
    stream.addTrack(track);
    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      void sender?.replaceTrack(track);
    });
    if (videoRef.current) videoRef.current.srcObject = stream;
  }

  async function endClass() {
    if (!confirm("Encerrar a aula ao vivo? A transmissão será finalizada para todos.")) return;
    setEnding(true);
    try {
      await finishRecording();
      sendSignal("host-stop", { from: user!.id });
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setBroadcasting(false);
      const { error } = await supabase.rpc("live_end_class", { _live_class_id: id! });
      if (error) throw error;
      toast.success("Aula encerrada e presença consolidada.");
      void refetch();
    } catch (e) {
      toast.error((e as Error).message ?? "Não foi possível encerrar a aula.");
    } finally {
      setEnding(false);
    }
  }

  useEffect(() => () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  if (isLoading) return <Skeleton className="h-[70vh] rounded-2xl" />;
  if (!lc) {
    return (
      <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
        Aula ao vivo não encontrada ou sem acesso.
      </CardContent></Card>
    );
  }

  const isLiveNow = lc.status === "ao_vivo";
  const opensAt = new Date(lc.scheduled_at).getTime() - (lc.open_minutes_before ?? 15) * 60000;
  const canEnter = isLiveNow || Date.now() >= opensAt;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate flex items-center gap-2">
            {lc.title}
            {isLiveNow && <Badge className="gap-1 animate-pulse"><Radio className="h-3 w-3" /> AO VIVO</Badge>}
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            {(lc as { courses?: { title: string } }).courses?.title}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-border">
            <video ref={videoRef} autoPlay playsInline
              className="w-full h-full object-contain bg-black" />
            {!broadcasting && !receiving && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6 text-primary-foreground">
                <Radio className="h-8 w-8 opacity-70" />
                <p className="text-sm opacity-80">
                  {isHost
                    ? "Inicie a transmissão para que os alunos vejam a aula."
                    : canEnter
                      ? "Aguardando o professor iniciar a transmissão…"
                      : `A aula começa em ${new Date(lc.scheduled_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
                </p>
              </div>
            )}
            {(broadcasting || receiving) && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <Badge className="gap-1"><Radio className="h-3 w-3" /> {formatDuration(elapsed)}</Badge>
                {(recording || remoteRecording) && (
                  <Badge variant="destructive" className="gap-1">
                    <Circle className="h-2.5 w-2.5 fill-current animate-pulse" /> Gravando
                  </Badge>
                )}
              </div>
            )}
          </div>

          {noticeOpen && (recording || remoteRecording) && (
            <div role="status"
              className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
              <Circle className="h-3 w-3 mt-1 shrink-0 fill-destructive text-destructive animate-pulse" />
              <p className="text-sm flex-1">
                <span className="font-semibold">Esta aula está sendo gravada.</span>{" "}
                A gravação (vídeo, áudio e tela compartilhada) ficará disponível para os alunos do curso após a publicação.
              </p>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                onClick={() => setNoticeOpen(false)} aria-label="Fechar aviso">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}


          {isHost ? (
            <div className="flex flex-wrap gap-2">
              {!broadcasting ? (
                <Button onClick={startBroadcast}>
                  <Radio className="h-4 w-4 mr-1" /> Iniciar transmissão
                </Button>
              ) : (
                <>
                  <Button variant={camOn ? "outline" : "secondary"} onClick={toggleCam}>
                    {camOn ? <Video className="h-4 w-4 mr-1" /> : <VideoOff className="h-4 w-4 mr-1" />}
                    {camOn ? "Câmera" : "Câmera desligada"}
                  </Button>
                  <Button variant={micOn ? "outline" : "secondary"} onClick={toggleMic}>
                    {micOn ? <Mic className="h-4 w-4 mr-1" /> : <MicOff className="h-4 w-4 mr-1" />}
                    {micOn ? "Microfone" : "Sem áudio"}
                  </Button>
                  <Button variant={sharing ? "secondary" : "outline"} onClick={toggleShare}>
                    <MonitorUp className="h-4 w-4 mr-1" /> {sharing ? "Parar de compartilhar" : "Compartilhar tela"}
                  </Button>
                  <Button variant={recording ? "destructive" : "outline"}
                    onClick={() => (recording ? void stopRecording() : startRecording())}>
                    <Circle className={`h-3.5 w-3.5 mr-1 ${recording ? "fill-current animate-pulse" : ""}`} />
                    {recording ? "Parar gravação" : "Gravar aula"}
                  </Button>
                  <Button variant="destructive" onClick={endClass} disabled={ending}>
                    <Square className="h-4 w-4 mr-1" /> Encerrar aula
                  </Button>
                </>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Sua presença nesta aula</span>
                <span className="font-medium">
                  {formatDuration(myAttendance?.total_seconds ?? 0)} · {myAttendance?.percent ?? 0}%
                  {" "}
                  <Badge variant={myAttendance?.status === "presente" ? "default" : "secondary"}>
                    {myAttendance?.status === "presente" ? "Presente"
                      : myAttendance?.status === "parcial" ? "Parcial" : "Ausente"}
                  </Badge>
                </span>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="lg:col-span-1">
          <CardContent className="p-3 h-[520px] flex flex-col">
            <Tabs defaultValue="chat" className="flex flex-col flex-1 min-h-0">
              <TabsList className="w-full">
                <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
                {isHost && (
                  <TabsTrigger value="participantes" className="flex-1">
                    <Users className="h-3.5 w-3.5 mr-1" /> {onlineCount}
                  </TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="chat" className="flex-1 min-h-0 mt-3">
                <LiveChat liveClassId={lc.id} canModerate={isHost} />
              </TabsContent>
              {isHost && (
                <TabsContent value="participantes" className="flex-1 min-h-0 mt-3">
                  <ScrollArea className="h-full pr-2">
                    <div className="divide-y divide-border">
                      {participants.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          Nenhum participante entrou ainda.
                        </p>
                      )}
                      {participants.map((p) => (
                        <div key={p.user_id} className="py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm truncate">{p.full_name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Entrou {p.joined_at ? new Date(p.joined_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                              {" · "}{formatDuration(p.total_seconds)}
                            </p>
                          </div>
                          <Badge variant={p.online ? "default" : "secondary"}>
                            {p.online ? "Online" : "Ausente"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
