import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Send, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  courseId: string;
  cooperadoOnly: boolean;
}

interface ChatMsg {
  id: string;
  course_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export default function CourseChat({ courseId, cooperadoOnly }: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAdmin = role === "admin";
  const canParticipate =
    !cooperadoOnly || role === "cooperado" || role === "admin";

  const { data: messages = [], isLoading } = useQuery<ChatMsg[]>({
    queryKey: ["course-chat", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_chat_messages")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ChatMsg[];
    },
  });

  const userIds = Array.from(new Set(messages.map((m) => m.user_id)));
  const { data: authors = [] } = useQuery({
    queryKey: ["course-chat-authors", courseId, userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });

  const authorMap = new Map(authors.map((a: any) => [a.user_id, a]));

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`course-chat-${courseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "course_chat_messages",
          filter: `course_id=eq.${courseId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["course-chat", courseId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [courseId, qc]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("course_chat_messages").insert({
      course_id: courseId,
      user_id: user.id,
      content,
    });
    setSending(false);
    if (error) {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setText("");
  };

  const deleteMessage = async (id: string) => {
    const { error } = await supabase
      .from("course_chat_messages")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden flex flex-col h-[500px]">
      <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h3 className="font-heading font-semibold text-card-foreground">
          Chat do Curso
        </h3>
        {cooperadoOnly && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-medium">
            Exclusivo Cooperados
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Carregando mensagens...
          </p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Seja o primeiro a iniciar a conversa.
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => {
              const author = authorMap.get(m.user_id) as any;
              const isOwn = m.user_id === user?.id;
              const initials = (author?.full_name || "U")
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
                >
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary-foreground">
                      {initials}
                    </span>
                  </div>
                  <div
                    className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}
                  >
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm ${
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}
                    >
                      {!isOwn && (
                        <p className="text-xs font-semibold mb-0.5 opacity-80">
                          {author?.full_name || "Usuário"}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 px-1">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {(isOwn || isAdmin) && (
                        <button
                          onClick={() => deleteMessage(m.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Excluir mensagem"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <div className="border-t border-border p-3 bg-muted/10">
        {!canParticipate ? (
          <p className="text-center text-xs text-muted-foreground py-2">
            Este chat é exclusivo para cooperados.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder="Escreva uma mensagem..."
              className="flex-1 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              type="submit"
              disabled={!text.trim() || sending}
              size="sm"
              className="gap-1"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
