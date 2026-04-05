import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Plus, Pin, Lock, ArrowLeft, Send, Trash2, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIES = ["geral", "dúvidas", "materiais", "cooperativismo", "sugestões"];

export default function Forum() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"topic" | "reply">("topic");
  const [filterCategory, setFilterCategory] = useState("todos");
  const [form, setForm] = useState({ title: "", content: "", category: "geral" });
  const [replyContent, setReplyContent] = useState("");
  const { user, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = role === "admin";

  // Fetch topics
  const { data: topics = [], isLoading } = useQuery({
    queryKey: ["forum_topics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forum_topics")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles for author names
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_forum"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, avatar_url");
      if (error) throw error;
      return data;
    },
  });

  // Fetch replies for selected topic
  const { data: replies = [] } = useQuery({
    queryKey: ["forum_replies", selectedTopic],
    queryFn: async () => {
      if (!selectedTopic) return [];
      const { data, error } = await supabase
        .from("forum_replies")
        .select("*")
        .eq("topic_id", selectedTopic)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTopic,
  });

  // Reply counts
  const { data: replyCounts = {} } = useQuery({
    queryKey: ["forum_reply_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("forum_replies").select("topic_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((r) => { counts[r.topic_id] = (counts[r.topic_id] || 0) + 1; });
      return counts;
    },
  });

  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
  const getAuthor = (userId: string) => profileMap.get(userId)?.full_name || "Usuário";

  const createTopic = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("forum_topics").insert({
        title: form.title,
        content: form.content,
        category: form.category,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum_topics"] });
      setDialogOpen(false);
      setForm({ title: "", content: "", category: "geral" });
      toast({ title: "Tópico criado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const createReply = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("forum_replies").insert({
        topic_id: selectedTopic!,
        user_id: user!.id,
        content: replyContent,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum_replies", selectedTopic] });
      qc.invalidateQueries({ queryKey: ["forum_reply_counts"] });
      setReplyContent("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const togglePin = useMutation({
    mutationFn: async (topic: any) => {
      const { error } = await supabase.from("forum_topics").update({ pinned: !topic.pinned }).eq("id", topic.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forum_topics"] }),
  });

  const toggleClose = useMutation({
    mutationFn: async (topic: any) => {
      const { error } = await supabase.from("forum_topics").update({ closed: !topic.closed }).eq("id", topic.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forum_topics"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (deleteType === "topic") {
        const { error } = await supabase.from("forum_topics").delete().eq("id", deleteId!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("forum_replies").delete().eq("id", deleteId!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      if (deleteType === "topic") {
        qc.invalidateQueries({ queryKey: ["forum_topics"] });
        setSelectedTopic(null);
      } else {
        qc.invalidateQueries({ queryKey: ["forum_replies", selectedTopic] });
        qc.invalidateQueries({ queryKey: ["forum_reply_counts"] });
      }
      setDeleteId(null);
      toast({ title: deleteType === "topic" ? "Tópico removido" : "Resposta removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const currentTopic = topics.find((t) => t.id === selectedTopic);
  const filtered = topics.filter((t) => filterCategory === "todos" || t.category === filterCategory);

  const categoryColors: Record<string, string> = {
    geral: "bg-muted text-muted-foreground",
    dúvidas: "bg-info/10 text-info",
    materiais: "bg-primary/10 text-primary",
    cooperativismo: "bg-accent/20 text-accent-foreground",
    sugestões: "bg-secondary/10 text-secondary",
  };

  // Topic detail view
  if (selectedTopic && currentTopic) {
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedTopic(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar ao fórum
        </button>

        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {currentTopic.pinned && <Pin className="w-4 h-4 text-accent" />}
                {currentTopic.closed && <Lock className="w-4 h-4 text-muted-foreground" />}
                <Badge className={categoryColors[currentTopic.category] || ""}>{currentTopic.category}</Badge>
              </div>
              <h1 className="text-2xl font-heading font-bold text-foreground">{currentTopic.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                por <span className="font-medium text-foreground">{getAuthor(currentTopic.user_id)}</span> · {formatDistanceToNow(new Date(currentTopic.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => togglePin.mutate(currentTopic)}>
                  {currentTopic.pinned ? "Desafixar" : "Fixar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleClose.mutate(currentTopic)}>
                  {currentTopic.closed ? "Reabrir" : "Fechar"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { setDeleteId(currentTopic.id); setDeleteType("topic"); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="mt-4 text-foreground whitespace-pre-wrap">{currentTopic.content}</div>
        </div>

        {/* Replies */}
        <div className="space-y-3">
          <h3 className="font-heading font-semibold text-foreground">{replies.length} {replies.length === 1 ? "resposta" : "respostas"}</h3>
          {replies.map((reply, i) => (
            <motion.div key={reply.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-card rounded-lg border border-border p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-foreground">
                      {getAuthor(reply.user_id).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground">{getAuthor(reply.user_id)}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                {(reply.user_id === user?.id || isAdmin) && (
                  <Button size="sm" variant="ghost" onClick={() => { setDeleteId(reply.id); setDeleteType("reply"); }}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                )}
              </div>
              <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{reply.content}</p>
            </motion.div>
          ))}
        </div>

        {/* Reply input */}
        {!currentTopic.closed ? (
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <Textarea
              placeholder="Escreva sua resposta..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end mt-3">
              <Button onClick={() => createReply.mutate()} disabled={!replyContent.trim() || createReply.isPending}
                className="gradient-primary text-primary-foreground">
                <Send className="w-4 h-4 mr-2" /> {createReply.isPending ? "Enviando..." : "Responder"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">Este tópico está fechado para novas respostas.</p>
        )}

        {/* Delete confirm */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja remover {deleteType === "topic" ? "este tópico e todas as respostas" : "esta resposta"}?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate()}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Topics list view
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Fórum</h1>
          <p className="text-muted-foreground mt-1">Troque ideias e tire dúvidas com a comunidade</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gradient-primary text-primary-foreground w-fit">
          <Plus className="w-4 h-4 mr-2" /> Novo Tópico
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {["todos", ...CATEGORIES].map((cat) => (
          <button key={cat} onClick={() => setFilterCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              filterCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Topics list */}
      <div className="space-y-3">
        {filtered.map((topic, i) => (
          <motion.div key={topic.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <button
              onClick={() => setSelectedTopic(topic.id)}
              className="w-full text-left bg-card rounded-xl border border-border p-4 shadow-card hover:shadow-elevated transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 mt-1">
                  <MessageSquare className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {topic.pinned && <Pin className="w-3.5 h-3.5 text-accent" />}
                    {topic.closed && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                    <h3 className="font-heading font-semibold text-foreground truncate">{topic.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{topic.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <Badge className={`text-xs ${categoryColors[topic.category] || ""}`}>{topic.category}</Badge>
                    <span>{getAuthor(topic.user_id)}</span>
                    <span>{formatDistanceToNow(new Date(topic.created_at), { addSuffix: true, locale: ptBR })}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {(replyCounts as Record<string, number>)[topic.id] || 0}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </motion.div>
        ))}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-heading">Nenhum tópico encontrado</p>
          <p className="text-sm mt-1">Seja o primeiro a criar um tópico!</p>
        </div>
      )}

      {/* New Topic Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Tópico</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Assunto do tópico" />
            </div>
            <div>
              <Label>Categoria</Label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Conteúdo *</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Escreva seu tópico..." rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createTopic.mutate()} disabled={!form.title || !form.content || createTopic.isPending}
              className="gradient-primary text-primary-foreground">
              {createTopic.isPending ? "Criando..." : "Criar Tópico"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
