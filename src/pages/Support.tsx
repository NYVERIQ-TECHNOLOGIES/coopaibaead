import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageSquare, Search, Headphones, ShieldCheck, Trash2, UserPlus, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversation {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_for_user: number;
  unread_for_admin: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface ProfileLite {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

export default function Support() {
  const { user, role, profile } = useAuth();
  const isAdmin = role === "admin" || role === "moderador";
  const isRealAdmin = role === "admin";
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"inbox" | "new">("inbox");
  const [userSearch, setUserSearch] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ============== USER VIEW: own conversation ==============
  const { data: ownConversation } = useQuery({
    queryKey: ["support-own-conversation", user?.id],
    enabled: !!user && !isAdmin,
    queryFn: async () => {
      const { data: existing } = await supabase
        .from("support_conversations")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (existing) return existing as Conversation;
      const { data: created, error } = await supabase
        .from("support_conversations")
        .insert({ user_id: user!.id, subject: "Suporte" })
        .select()
        .single();
      if (error) throw error;
      return created as Conversation;
    },
  });

  // ============== ADMIN VIEW: all conversations ==============
  const { data: allConversations = [] } = useQuery<Conversation[]>({
    queryKey: ["support-all-conversations"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Conversation[];
    },
  });

  // Profiles for admin sidebar
  const { data: profilesMap = {} } = useQuery<Record<string, ProfileLite>>({
    queryKey: ["support-profiles", allConversations.map((c) => c.user_id).join(",")],
    enabled: isAdmin && allConversations.length > 0,
    queryFn: async () => {
      const ids = allConversations.map((c) => c.user_id);
      const { data, error } = await supabase.rpc("get_public_profiles", { _user_ids: ids });
      if (error) throw error;
      const map: Record<string, ProfileLite> = {};
      (data || []).forEach((p: ProfileLite) => (map[p.user_id] = p));
      return map;
    },
  });

  const activeConversationId = isAdmin ? selectedId : ownConversation?.id ?? null;

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    if (isAdmin) return allConversations.find((c) => c.id === activeConversationId) ?? null;
    return ownConversation ?? null;
  }, [activeConversationId, allConversations, ownConversation, isAdmin]);

  // ============== Messages for active conversation ==============
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["support-messages", activeConversationId],
    enabled: !!activeConversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", activeConversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Message[];
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("support-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_messages" },
        (payload: any) => {
          const convId = payload.new?.conversation_id ?? payload.old?.conversation_id;
          qc.invalidateQueries({ queryKey: ["support-messages", convId] });
          qc.invalidateQueries({ queryKey: ["support-all-conversations"] });
          qc.invalidateQueries({ queryKey: ["support-own-conversation", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => {
          qc.invalidateQueries({ queryKey: ["support-all-conversations"] });
          qc.invalidateQueries({ queryKey: ["support-own-conversation", user.id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, activeConversationId]);

  // Mark unread as read when opening conversation
  useEffect(() => {
    if (!activeConversation) return;
    const unread = isAdmin ? activeConversation.unread_for_admin : activeConversation.unread_for_user;
    if (unread > 0) {
      const patch = isAdmin ? { unread_for_admin: 0 } : { unread_for_user: 0 };
      supabase
        .from("support_conversations")
        .update(patch)
        .eq("id", activeConversation.id)
        .then(() => {
          qc.invalidateQueries({ queryKey: ["support-all-conversations"] });
          qc.invalidateQueries({ queryKey: ["support-own-conversation", user?.id] });
        });
    }
  }, [activeConversation, isAdmin, qc, user?.id]);

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || !activeConversationId || !user) return;
    if (content.length > 2000) {
      toast.error("Mensagem muito longa (máx. 2000 caracteres).");
      return;
    }
    const { error } = await supabase.from("support_messages").insert({
      conversation_id: activeConversationId,
      sender_id: user.id,
      sender_role: isAdmin ? "admin" : (role ?? "aluno"),
      content,
    });
    if (error) {
      toast.error("Erro ao enviar mensagem");
      return;
    }
    setDraft("");
  };

  const deleteMessage = async (id: string) => {
    if (!isAdmin) return;
    const { error } = await supabase.from("support_messages").delete().eq("id", id);
    if (error) toast.error("Erro ao remover");
  };

  const filteredConversations = allConversations.filter((c) => {
    if (!search.trim()) return true;
    const p = profilesMap[c.user_id];
    const term = search.toLowerCase();
    return (
      p?.full_name?.toLowerCase().includes(term) ||
      c.last_message_preview?.toLowerCase().includes(term) ||
      c.subject.toLowerCase().includes(term)
    );
  });

  const initials = (name?: string | null) =>
    name
      ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
      : "?";

  // List of all users (admin only) — used to start new conversations
  const { data: allUsers = [] } = useQuery<ProfileLite[]>({
    queryKey: ["support-all-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_public_profiles");
      if (error) throw error;
      return (data || []) as ProfileLite[];
    },
  });

  const startConversationWith = async (targetUserId: string) => {
    if (!user) return;
    setStartingId(targetUserId);
    try {
      const { data: existing } = await supabase
        .from("support_conversations")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: created, error } = await supabase
          .from("support_conversations")
          .insert({ user_id: targetUserId, subject: "Mensagem do administrador" })
          .select("id")
          .single();
        if (error) throw error;
        convId = created.id;
      }
      await qc.invalidateQueries({ queryKey: ["support-all-conversations"] });
      setSelectedId(convId!);
      setTab("inbox");
      toast.success("Conversa aberta");
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar conversa");
    } finally {
      setStartingId(null);
    }
  };

  const filteredUsers = allUsers.filter((u) => {
    if (u.user_id === user?.id) return false;
    if (!userSearch.trim()) return true;
    return u.full_name?.toLowerCase().includes(userSearch.toLowerCase());
  });

  // ====== ADMIN LAYOUT (list + chat) ======
  if (isAdmin) {
    const activeProfile = activeConversation ? profilesMap[activeConversation.user_id] : null;
    return (
      <div className="p-4 md:p-6 h-[calc(100vh-2rem)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Central de Suporte</h1>
            <p className="text-sm text-muted-foreground">Conversas privadas com alunos e cooperados</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 h-[calc(100%-5rem)]">
          {/* Conversations / New message */}
          <Card className="flex flex-col overflow-hidden">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "inbox" | "new")} className="flex-1 flex flex-col">
              <TabsList className="grid grid-cols-2 m-2">
                <TabsTrigger value="inbox" className="gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Conversas
                </TabsTrigger>
                <TabsTrigger value="new" className="gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Nova mensagem
                </TabsTrigger>
              </TabsList>

              <TabsContent value="inbox" className="flex-1 flex flex-col mt-0 overflow-hidden">
                <div className="p-3 border-b border-t">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar conversa..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="divide-y">
                    {filteredConversations.length === 0 && (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        Nenhuma conversa ainda.
                      </div>
                    )}
                    {filteredConversations.map((c) => {
                      const p = profilesMap[c.user_id];
                      const active = c.id === selectedId;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedId(c.id)}
                          className={`w-full text-left p-3 hover:bg-muted/50 transition flex gap-3 items-start ${
                            active ? "bg-muted" : ""
                          }`}
                        >
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {initials(p?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm truncate">{p?.full_name || "Usuário"}</p>
                              {c.unread_for_admin > 0 && (
                                <Badge className="h-5 min-w-5 px-1.5 rounded-full text-[10px]">
                                  {c.unread_for_admin}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {c.last_message_preview || "Sem mensagens"}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {format(new Date(c.last_message_at), "dd/MM HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="new" className="flex-1 flex flex-col mt-0 overflow-hidden">
                <div className="p-3 border-b border-t">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar usuário..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Selecione um usuário para abrir um chat privado.
                  </p>
                </div>
                <ScrollArea className="flex-1">
                  <div className="divide-y">
                    {filteredUsers.length === 0 && (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        Nenhum usuário encontrado.
                      </div>
                    )}
                    {filteredUsers.map((u) => {
                      const hasConv = allConversations.some((c) => c.user_id === u.user_id);
                      return (
                        <div
                          key={u.user_id}
                          className="w-full p-3 flex gap-3 items-center hover:bg-muted/50 transition"
                        >
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {initials(u.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{u.full_name || "Usuário"}</p>
                            {hasConv && (
                              <p className="text-[10px] text-muted-foreground">Conversa existente</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={hasConv ? "outline" : "default"}
                            disabled={startingId === u.user_id}
                            onClick={() => startConversationWith(u.user_id)}
                            className="gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {hasConv ? "Abrir" : "Iniciar"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Chat area */}
          <Card className="flex flex-col overflow-hidden">
            {!activeConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <MessageSquare className="w-12 h-12 opacity-30" />
                <p>Selecione uma conversa para começar</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials(activeProfile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{activeProfile?.full_name || "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeConversation.subject} · {activeConversation.status}
                    </p>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {messages.map((m) => {
                        const mine = m.sender_id === user?.id;
                        const fromAdmin = m.sender_role === "admin";
                        return (
                          <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${mine ? "justify-end" : "justify-start"} group`}
                          >
                            <div
                              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm relative ${
                                mine
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              {fromAdmin && !mine && (
                                <div className="flex items-center gap-1 text-[10px] opacity-70 mb-1">
                                  <ShieldCheck className="w-3 h-3" /> Admin
                                </div>
                              )}
                              <p className="whitespace-pre-wrap break-words">{m.content}</p>
                              <p className="text-[10px] opacity-60 mt-1">
                                {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                              </p>
                              <button
                                onClick={() => deleteMessage(m.id)}
                                className="absolute -top-2 -right-2 hidden group-hover:flex bg-background border rounded-full w-6 h-6 items-center justify-center text-muted-foreground hover:text-destructive"
                                title="Remover mensagem"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
                <div className="p-3 border-t flex gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Digite sua resposta..."
                    className="resize-none min-h-[44px] max-h-32"
                    rows={1}
                  />
                  <Button onClick={sendMessage} disabled={!draft.trim()} className="self-end">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ====== USER LAYOUT (single conversation) ======
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Headphones className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Suporte</h1>
          <p className="text-sm text-muted-foreground">
            Fale em particular com a equipe administrativa
          </p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="font-medium">Conversa privada</span>
            <span className="text-muted-foreground">— apenas você e os administradores</span>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-12">
              <MessageSquare className="w-10 h-10 opacity-30" />
              <p className="text-sm">Nenhuma mensagem ainda. Envie a primeira para iniciar a conversa.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  const fromAdmin = m.sender_role === "admin";
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {fromAdmin && (
                          <div className="flex items-center gap-1 text-[10px] opacity-70 mb-1">
                            <ShieldCheck className="w-3 h-3" /> Equipe de Suporte
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p className="text-[10px] opacity-60 mt-1">
                          {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Escreva sua mensagem para o suporte..."
            className="resize-none min-h-[44px] max-h-32"
            rows={1}
          />
          <Button onClick={sendMessage} disabled={!draft.trim() || !ownConversation} className="self-end">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
