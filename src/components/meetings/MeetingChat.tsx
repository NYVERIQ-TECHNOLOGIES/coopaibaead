import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { toast } from "sonner";

type Message = { id: string; user_id: string; message: string; created_at: string };
export default function MeetingChat({ id, names }: { id: string; names: Record<string, string> }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Message[]>([]);
  const [text, setText] = useState("");
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("meeting_chat").select("id,user_id,message,created_at").eq("meeting_id", id).order("created_at").limit(300);
      if (alive) setRows(data ?? []);
    };
    void load();
    const channel = supabase.channel(`meeting-chat-${id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "meeting_chat", filter: `meeting_id=eq.${id}` }, () => void load()).subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [id]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    const { error } = await supabase.from("meeting_chat").insert({ meeting_id: id, user_id: user.id, message: text.trim() });
    if (error) toast.error(error.message);
    else setText("");
  };
  return <div className="flex h-full min-h-0 flex-col gap-3">
    <div className="flex-1 overflow-y-auto space-y-3" aria-live="polite">{rows.map(m => <div key={m.id} className="text-sm break-words"><span className="font-semibold text-primary">{names[m.user_id] ?? "Participante"}</span> <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span><p>{m.message}</p></div>)}</div>
    <form onSubmit={send} className="flex gap-2"><Input aria-label="Mensagem" maxLength={1000} value={text} onChange={e => setText(e.target.value)} placeholder="Mensagem" /><Button size="icon" aria-label="Enviar mensagem" disabled={!text.trim()}><Send className="h-4 w-4" /></Button></form>
  </div>;
}
