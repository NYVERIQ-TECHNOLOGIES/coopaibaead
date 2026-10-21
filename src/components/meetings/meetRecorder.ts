import { supabase } from "@/integrations/supabase/client";
import { callMeeting } from "@/components/meetings/data";
import { toast } from "sonner";

// Grava a aba do Google Meet (vídeo + som da aba + microfone) neste computador.
let active: { meetingId: string; recorder: MediaRecorder } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
export const subscribeRecording = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const recordingMeetingId = () => active?.meetingId ?? null;

export function stopMeetRecording() {
  if (active?.recorder.state === "recording") active.recorder.stop();
}

export async function startMeetRecording(meetingId: string, userId: string) {
  if (active) { toast.error("Já existe uma gravação em andamento."); return; }
  if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") { toast.error("Este navegador não permite gravar. Use o Chrome ou o Edge no computador."); return; }
  let display: MediaStream;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, selfBrowserSurface: "exclude", systemAudio: "include" } as unknown as DisplayMediaStreamOptions);
  } catch { toast.error("Gravação cancelada. Escolha a aba do Google Meet e marque “Compartilhar áudio da aba”."); return; }
  const mic = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
  const ctx = new AudioContext(); const dest = ctx.createMediaStreamDestination();
  for (const s of [display, mic]) { const t = s?.getAudioTracks() ?? []; if (t.length) ctx.createMediaStreamSource(new MediaStream(t)).connect(dest); }
  if (!display.getAudioTracks().length) toast.warning("Sem o som da aba: marque “Compartilhar áudio da aba” para gravar as vozes dos participantes.");
  const output = new MediaStream([...display.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const cleanup = () => { display.getTracks().forEach(t => t.stop()); mic?.getTracks().forEach(t => t.stop()); void ctx.close().catch(() => undefined); };
  const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(t => MediaRecorder.isTypeSupported(t)) ?? "";
  const recorder = new MediaRecorder(output, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = []; const started = Date.now();
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = async () => {
    cleanup(); active = null; emit();
    void callMeeting("meeting_set_state", { _id: meetingId, _action: "parar_gravacao" }).catch(() => undefined);
    const blob = new Blob(chunks, { type: "video/webm" });
    if (!blob.size) { toast.error("Nada foi gravado."); return; }
    const name = `reuniao-${meetingId}-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    const { error } = await supabase.from("meeting_recordings").insert({ meeting_id: meetingId, file_name: name, file_size: blob.size, duration_seconds: Math.round((Date.now() - started) / 1000), created_by: userId, storage_type: "local" });
    if (error) toast.warning("Arquivo baixado, mas não foi possível registrar a gravação."); else toast.success("Gravação salva na pasta Downloads deste computador.");
  };
  display.getVideoTracks()[0]?.addEventListener("ended", () => { if (recorder.state === "recording") recorder.stop(); });
  recorder.start(1000); active = { meetingId, recorder }; emit();
  void callMeeting("meeting_set_state", { _id: meetingId, _action: "gravar" }).catch(() => undefined);
  toast.success("Gravando. Volte à lista de Reuniões e clique em “Parar gravação” para salvar.");
}
