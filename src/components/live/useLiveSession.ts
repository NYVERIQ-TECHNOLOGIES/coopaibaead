import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mantém a sessão de presença do usuário na aula ao vivo.
 * Envia um sinal (heartbeat) periódico e encerra a sessão ao sair.
 * O tempo é sempre calculado no servidor — o cliente não escreve presença.
 */
export function useLiveSession(liveClassId?: string, enabled = true) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!liveClassId || !enabled) return;
    let cancelled = false;
    let timer: number | undefined;

    async function join() {
      const { data, error } = await supabase.rpc("live_join_session", { _live_class_id: liveClassId! });
      if (cancelled) return;
      if (error) return setError(error.message);
      const sid = (data as { session_id?: string })?.session_id ?? null;
      sessionRef.current = sid;
      setSessionId(sid);
    }

    void join();

    timer = window.setInterval(async () => {
      if (document.hidden) return;
      if (!sessionRef.current) return void join();
      const { error } = await supabase.rpc("live_heartbeat", { _session_id: sessionRef.current });
      // Se a sessão expirou (reconexão), abre uma nova
      if (error) void join();
    }, 30000);

    const onVisible = () => {
      if (!document.hidden && sessionRef.current) {
        void supabase.rpc("live_heartbeat", { _session_id: sessionRef.current });
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) window.clearInterval(timer);
      const sid = sessionRef.current;
      if (sid) void supabase.rpc("live_leave_session", { _session_id: sid });
    };
  }, [liveClassId, enabled]);

  return { sessionId, error };
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}min`;
  return `${m}min`;
}
