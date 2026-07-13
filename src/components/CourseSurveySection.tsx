import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Trash2, Edit, ChevronDown, ChevronUp, CheckCircle, Star, BarChart3, Lock, Eye } from "lucide-react";

type QType = "scale" | "text" | "multiple_choice";
interface SQuestion { id: string; question: string; type: QType; options?: string[]; required?: boolean; }

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function CourseSurveySection({ courseId, isAdmin, progressPct }: { courseId: string; isAdmin: boolean; progressPct: number; }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const { data: survey } = useQuery({
    queryKey: ["course_survey", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("course_surveys").select("*").eq("course_id", courseId).maybeSingle();
      return data;
    },
  });

  const { data: myResponse } = useQuery({
    queryKey: ["course_survey_my_response", survey?.id, user?.id],
    enabled: !!survey?.id && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("course_survey_responses").select("*").eq("survey_id", survey!.id).eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: allResponses = [] } = useQuery({
    queryKey: ["course_survey_all_responses", survey?.id],
    enabled: !!survey?.id && isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("course_survey_responses").select("*").eq("survey_id", survey!.id).order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });

  const questions: SQuestion[] = useMemo(() => (survey?.questions as any) ?? [], [survey]);

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!survey || !user) return;
      for (const q of questions) {
        if (q.required && (answers[q.id] === undefined || answers[q.id] === "")) {
          throw new Error(`Responda: ${q.question}`);
        }
      }
      const { error } = await supabase.from("course_survey_responses").insert({
        survey_id: survey.id, course_id: courseId, user_id: user.id, answers,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course_survey_my_response", survey?.id, user?.id] });
      toast({ title: "Obrigado! Sua resposta foi registrada." });
      setAnswers({});
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const alreadyAnswered = !!myResponse;
  const canAnswer = !isAdmin && progressPct >= 100 && survey?.is_active && questions.length > 0 && !alreadyAnswered;
  const notCompleted = !isAdmin && progressPct < 100;

  return (
    <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
        <h2 className="font-heading font-bold text-card-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-accent" /> Pesquisa de Satisfação
          {isAdmin && <Badge variant="outline" className="text-[10px]">{allResponses.length} resposta(s)</Badge>}
          {!isAdmin && alreadyAnswered && <Badge className="text-[10px] bg-success/10 text-success gap-1"><CheckCircle className="w-3 h-3" /> Respondida</Badge>}
        </h2>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setEditorOpen(true)} className="gradient-primary text-primary-foreground gap-1">
                <Edit className="w-3.5 h-3.5" /> {survey ? "Editar pesquisa" : "Criar pesquisa"}
              </Button>
              {survey && (
                <Button size="sm" variant="outline" onClick={() => setResultsOpen(true)} className="gap-1">
                  <BarChart3 className="w-3.5 h-3.5" /> Ver resultados ({allResponses.length})
                </Button>
              )}
            </div>
          )}

          {!survey && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {isAdmin ? "Nenhuma pesquisa criada. Clique em \"Criar pesquisa\" para começar." : "Nenhuma pesquisa disponível para este curso."}
            </p>
          )}

          {survey && (
            <div>
              <h3 className="font-heading font-semibold text-card-foreground">{survey.title}</h3>
              {survey.description && <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>}

              {isAdmin && (
                <div className="mt-3 space-y-2">
                  {questions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma pergunta cadastrada ainda.</p>
                  ) : questions.map((q, i) => (
                    <div key={q.id} className="text-sm border border-border rounded-md p-2 bg-muted/10">
                      <span className="font-medium">{i + 1}. {q.question}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        [{q.type === "scale" ? "Nota 1-5" : q.type === "text" ? "Texto livre" : "Múltipla escolha"}{q.required ? " • obrigatória" : ""}]
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {!isAdmin && (
                <div className="mt-4">
                  {notCompleted && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-muted/20 rounded-md">
                      <Lock className="w-4 h-4" /> A pesquisa é liberada após concluir 100% do curso. Progresso atual: {progressPct}%.
                    </div>
                  )}
                  {alreadyAnswered && (
                    <div className="flex items-center gap-2 text-sm text-success p-4 bg-success/10 rounded-md">
                      <CheckCircle className="w-4 h-4" /> Você já respondeu esta pesquisa. Obrigado pelo feedback!
                    </div>
                  )}
                  {canAnswer && (
                    <div className="space-y-4">
                      {questions.map((q, i) => (
                        <div key={q.id} className="space-y-2">
                          <Label className="text-sm">
                            {i + 1}. {q.question} {q.required && <span className="text-destructive">*</span>}
                          </Label>
                          {q.type === "scale" && (
                            <div className="flex gap-2">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button key={n} type="button"
                                  onClick={() => setAnswers((p) => ({ ...p, [q.id]: n }))}
                                  className={`w-10 h-10 rounded-md border transition-colors flex items-center justify-center gap-0.5 ${answers[q.id] === n ? "bg-accent text-accent-foreground border-accent" : "border-border hover:bg-muted"}`}
                                >
                                  <Star className={`w-4 h-4 ${answers[q.id] === n ? "fill-current" : ""}`} />
                                  <span className="text-xs font-semibold">{n}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {q.type === "text" && (
                            <Textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))} placeholder="Sua resposta..." rows={3} />
                          )}
                          {q.type === "multiple_choice" && (
                            <Select value={answers[q.id] ?? ""} onValueChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))}>
                              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                              <SelectContent>
                                {(q.options ?? []).map((op, idx) => (
                                  <SelectItem key={idx} value={op}>{op}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                      <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending} className="gradient-primary text-primary-foreground">
                        {submitMut.isPending ? "Enviando..." : "Enviar resposta"}
                      </Button>
                    </div>
                  )}
                  {!notCompleted && !alreadyAnswered && (!survey.is_active || questions.length === 0) && (
                    <p className="text-sm text-muted-foreground py-2">A pesquisa não está disponível no momento.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <SurveyEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          courseId={courseId}
          survey={survey}
          onSaved={() => qc.invalidateQueries({ queryKey: ["course_survey", courseId] })}
        />
      )}

      {isAdmin && survey && (
        <SurveyResultsDialog
          open={resultsOpen}
          onOpenChange={setResultsOpen}
          questions={questions}
          responses={allResponses as any[]}
        />
      )}
    </div>
  );
}

function SurveyEditorDialog({ open, onOpenChange, courseId, survey, onSaved }: any) {
  const { toast } = useToast();
  const [title, setTitle] = useState("Pesquisa de Satisfação");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [questions, setQuestions] = useState<SQuestion[]>([]);

  useEffect(() => {
    if (open) {
      setTitle(survey?.title ?? "Pesquisa de Satisfação");
      setDescription(survey?.description ?? "");
      setIsActive(survey?.is_active ?? true);
      setQuestions((survey?.questions as SQuestion[]) ?? []);
    }
  }, [open, survey]);

  const addQ = (type: QType) => setQuestions((p) => [...p, { id: uid(), question: "", type, options: type === "multiple_choice" ? ["Opção 1"] : undefined, required: false }]);
  const updateQ = (i: number, patch: Partial<SQuestion>) => setQuestions((p) => p.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  const removeQ = (i: number) => setQuestions((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    try {
      const payload = { course_id: courseId, title, description, is_active: isActive, questions: questions as any };
      if (survey) {
        const { error } = await supabase.from("course_surveys").update(payload).eq("id", survey.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_surveys").insert(payload);
        if (error) throw error;
      }
      toast({ title: "Pesquisa salva" });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{survey ? "Editar" : "Criar"} pesquisa de satisfação</DialogTitle>
          <DialogDescription>Personalize as perguntas que os alunos responderão ao concluir o curso.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Pesquisa ativa</Label>
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-base">Perguntas</Label>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => addQ("scale")}><Plus className="w-3 h-3 mr-1" /> Nota 1-5</Button>
                <Button size="sm" variant="outline" onClick={() => addQ("text")}><Plus className="w-3 h-3 mr-1" /> Texto</Button>
                <Button size="sm" variant="outline" onClick={() => addQ("multiple_choice")}><Plus className="w-3 h-3 mr-1" /> Múltipla</Button>
              </div>
            </div>

            {questions.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Adicione perguntas usando os botões acima.</p>}

            {questions.map((q, i) => (
              <div key={q.id} className="border border-border rounded-md p-3 space-y-2 bg-muted/10">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-muted-foreground mt-2">{i + 1}.</span>
                  <Input value={q.question} onChange={(e) => updateQ(i, { question: e.target.value })} placeholder="Digite a pergunta" />
                  <Button size="sm" variant="ghost" onClick={() => removeQ(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
                <div className="flex items-center gap-3 pl-6 text-xs">
                  <Badge variant="secondary">{q.type === "scale" ? "Nota 1-5" : q.type === "text" ? "Texto livre" : "Múltipla escolha"}</Badge>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!!q.required} onChange={(e) => updateQ(i, { required: e.target.checked })} /> Obrigatória
                  </label>
                </div>
                {q.type === "multiple_choice" && (
                  <div className="pl-6 space-y-1">
                    {(q.options ?? []).map((op, oi) => (
                      <div key={oi} className="flex gap-1">
                        <Input value={op} onChange={(e) => {
                          const next = [...(q.options ?? [])]; next[oi] = e.target.value;
                          updateQ(i, { options: next });
                        }} />
                        <Button size="sm" variant="ghost" onClick={() => updateQ(i, { options: (q.options ?? []).filter((_, x) => x !== oi) })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => updateQ(i, { options: [...(q.options ?? []), `Opção ${(q.options?.length ?? 0) + 1}`] })}>
                      <Plus className="w-3 h-3 mr-1" /> Adicionar opção
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} className="gradient-primary text-primary-foreground">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SurveyResultsDialog({ open, onOpenChange, questions, responses }: { open: boolean; onOpenChange: (v: boolean) => void; questions: SQuestion[]; responses: any[]; }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resultados da pesquisa</DialogTitle>
          <DialogDescription>{responses.length} resposta(s) recebida(s).</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {questions.map((q, i) => {
            const values = responses.map((r) => r.answers?.[q.id]).filter((v) => v !== undefined && v !== "");
            return (
              <div key={q.id} className="border border-border rounded-md p-3">
                <p className="font-medium text-sm">{i + 1}. {q.question}</p>
                <p className="text-xs text-muted-foreground mb-2">{values.length} resposta(s)</p>
                {q.type === "scale" && values.length > 0 && (
                  <div className="text-sm">
                    Média: <span className="font-bold text-accent">{(values.reduce((a, b) => a + Number(b), 0) / values.length).toFixed(2)}</span> / 5
                    <div className="mt-2 space-y-1">
                      {[5, 4, 3, 2, 1].map((n) => {
                        const c = values.filter((v) => Number(v) === n).length;
                        const pct = values.length ? (c / values.length) * 100 : 0;
                        return (
                          <div key={n} className="flex items-center gap-2 text-xs">
                            <span className="w-4">{n}</span>
                            <div className="flex-1 h-2 bg-muted rounded"><div className="h-full bg-accent rounded" style={{ width: `${pct}%` }} /></div>
                            <span className="w-8 text-right">{c}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {q.type === "multiple_choice" && (
                  <div className="space-y-1">
                    {(q.options ?? []).map((op) => {
                      const c = values.filter((v) => v === op).length;
                      const pct = values.length ? (c / values.length) * 100 : 0;
                      return (
                        <div key={op} className="flex items-center gap-2 text-xs">
                          <span className="w-32 truncate">{op}</span>
                          <div className="flex-1 h-2 bg-muted rounded"><div className="h-full bg-primary rounded" style={{ width: `${pct}%` }} /></div>
                          <span className="w-8 text-right">{c}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {q.type === "text" && (
                  <ul className="space-y-1 text-sm max-h-48 overflow-y-auto">
                    {values.map((v, idx) => <li key={idx} className="p-2 bg-muted/20 rounded">{String(v)}</li>)}
                    {values.length === 0 && <li className="text-xs text-muted-foreground">Sem respostas.</li>}
                  </ul>
                )}
              </div>
            );
          })}
          {questions.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma pergunta cadastrada.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
