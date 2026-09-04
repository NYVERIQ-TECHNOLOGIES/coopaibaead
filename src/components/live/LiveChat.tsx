import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MicOff, Send, Trash2 } from "lucide-react";

interface Msg {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  deleted_at: string | null;
}

export default function LiveChat({
  liveClassId,
  canModerate,
}: {
  liveClassId: string;
  canModerate: boolean;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadNames(ids: string[]) {
    const missing = ids.filter((id) => !names[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.rpc("get_public_profiles", { _user_ids: missing });
    if (!data) return;
    setNames((prev) => {
      const next = { ...prev };
      (data as { user_id: string; full_name: string }[]).forEach((p) => { next[p.user_id] = p.full_name; });
      return next;
    });
  }

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("live_chat_messages")
        .select("id, user_id, message, created_at, deleted_at")
        .eq("live_class_id", liveClassId)
        .order("created_at")
        .limit(300);
      if (!active) return;
      const rows = (data ?? []) as Msg[];
      setMessages(rows);
      void loadNames([...new Set(rows.map((m) => m.user_id))]);
    }
    void load();

    const channel = supabase
      .channel(`live-chat-${liveClassId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "live_chat_messages", filter: `live_class_id=eq.${liveClassId}` },
        (payload) => {
          const row = payload.new as Msg;
          if (!row?.id) return;
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === row.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = row; return next; }
            return [...prev, row];
          });
          void loadNames([row.user_id]);
        })
      .subscribe();

    return () => { active = false; void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveClassId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const value = text.trim();
    if (!value || !user) return;
    setSending(true);
    const { error } = await supabase.from("live_chat_messages").insert({
      live_class_id: liveClassId, user_id: user.id, message: value.slice(0, 1000),
    });
    setSending(false);
    if (error) return toast.error("Não foi possível enviar a mensagem.");
    setText("");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("live_chat_messages")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
      .eq("id", id);
    if (error) toast.error(error.message);
  }

  async function mute(userId: string) {
    const { error } = await supabase.from("live_chat_mutes").insert({
      live_class_id: liveClassId, user_id: userId, muted_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Participante silenciado no chat desta aula.");
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 min-h-0 pr-2">
        <div className="space-y-3 py-1">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhuma mensagem ainda. Envie a primeira!
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="group text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-xs text-primary truncate">
                  {names[m.user_id] ?? "Participante"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {canModerate && !m.deleted_at && (
                  <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button onClick={() => remove(m.id)} aria-label="Excluir mensagem">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                    <button onClick={() => mute(m.user_id)} aria-label="Silenciar participante">
                      <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </span>
                )}
              </div>
              <p className={m.deleted_at ? "text-xs italic text-muted-foreground" : "text-sm break-words"}>
                {m.deleted_at ? "Mensagem removida pela moderação" : m.message}
              </p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form
        className="flex gap-2 pt-3 border-t border-border mt-2"
        onSubmit={(e) => { e.preventDefault(); void send(); }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem" maxLength={1000} />
        <Button type="submit" size="icon" disabled={sending || !text.trim()} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
