import { motion } from "framer-motion";
import { useState } from "react";
import {
  Plus, Search, Clock, FileQuestion, BarChart3, Trash2, Edit, Eye,
  CheckCircle, XCircle, Timer, Shuffle, Filter, Copy
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Question {
  id: number;
  text: string;
  type: "objective" | "discursive";
  options?: string[];
  correctOption?: number;
  points: number;
}

interface Evaluation {
  id: number;
  title: string;
  course: string;
  type: "prova" | "exercicio" | "simulado";
  duration: number;
  questions: Question[];
  shuffle: boolean;
  status: "rascunho" | "publicada" | "encerrada";
  attempts: number;
  avgScore: number;
  createdAt: string;
}

const initialEvaluations: Evaluation[] = [
  {
    id: 1, title: "Prova Final - Cooperativismo Básico", course: "Cooperativismo Básico",
    type: "prova", duration: 60, shuffle: true, status: "publicada", attempts: 187, avgScore: 7.8,
    createdAt: "2026-03-15",
    questions: [
      { id: 1, text: "Qual é o primeiro princípio cooperativista?", type: "objective", options: ["Adesão voluntária", "Gestão democrática", "Autonomia", "Educação"], correctOption: 0, points: 2 },
      { id: 2, text: "Explique a importância da intercooperação.", type: "discursive", points: 3 },
    ],
  },
  {
    id: 2, title: "Exercício - Gestão Financeira", course: "Gestão Financeira",
    type: "exercicio", duration: 30, shuffle: false, status: "rascunho", attempts: 0, avgScore: 0,
    createdAt: "2026-03-20",
    questions: [
      { id: 1, text: "O que é DRE?", type: "objective", options: ["Demonstração de Resultado", "Documento Regional", "Dados de Receita", "Declaração de Renda"], correctOption: 0, points: 1 },
    ],
  },
  {
    id: 3, title: "Simulado - Legislação Cooperativista", course: "Legislação Cooperativista",
    type: "simulado", duration: 90, shuffle: true, status: "encerrada", attempts: 312, avgScore: 6.5,
    createdAt: "2026-03-01",
    questions: [],
  },
];

const typeLabels = { prova: "Prova", exercicio: "Exercício", simulado: "Simulado" };
const statusStyles = {
  rascunho: "bg-muted text-muted-foreground",
  publicada: "bg-success/10 text-success",
  encerrada: "bg-destructive/10 text-destructive",
};

export default function Evaluations() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>(initialEvaluations);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [currentEval, setCurrentEval] = useState<Evaluation | null>(null);
  const [viewMode, setViewMode] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [type, setType] = useState<"prova" | "exercicio" | "simulado">("prova");
  const [duration, setDuration] = useState(60);
  const [shuffle, setShuffle] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);

  // Question form
  const [qText, setQText] = useState("");
  const [qType, setQType] = useState<"objective" | "discursive">("objective");
  const [qOptions, setQOptions] = useState(["", "", "", ""]);
  const [qCorrect, setQCorrect] = useState(0);
  const [qPoints, setQPoints] = useState(1);

  const filtered = evaluations.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() {
    setCurrentEval(null);
    setTitle("");
    setCourse("");
    setType("prova");
    setDuration(60);
    setShuffle(false);
    setQuestions([]);
    setViewMode(false);
    setDialogOpen(true);
  }

  function openEdit(ev: Evaluation) {
    setCurrentEval(ev);
    setTitle(ev.title);
    setCourse(ev.course);
    setType(ev.type);
    setDuration(ev.duration);
    setShuffle(ev.shuffle);
    setQuestions([...ev.questions]);
    setViewMode(false);
    setDialogOpen(true);
  }

  function openView(ev: Evaluation) {
    setCurrentEval(ev);
    setTitle(ev.title);
    setCourse(ev.course);
    setType(ev.type);
    setDuration(ev.duration);
    setShuffle(ev.shuffle);
    setQuestions([...ev.questions]);
    setViewMode(true);
    setDialogOpen(true);
  }

  function saveEval() {
    if (!title.trim() || !course.trim()) return;
    if (currentEval) {
      setEvaluations((prev) =>
        prev.map((e) =>
          e.id === currentEval.id
            ? { ...e, title, course, type, duration, shuffle, questions }
            : e
        )
      );
    } else {
      setEvaluations((prev) => [
        ...prev,
        {
          id: Date.now(), title, course, type, duration, shuffle, questions,
          status: "rascunho", attempts: 0, avgScore: 0, createdAt: new Date().toISOString().slice(0, 10),
        },
      ]);
    }
    setDialogOpen(false);
  }

  function deleteEval(id: number) {
    setEvaluations((prev) => prev.filter((e) => e.id !== id));
  }

  function toggleStatus(ev: Evaluation) {
    const next = ev.status === "rascunho" ? "publicada" : ev.status === "publicada" ? "encerrada" : "rascunho";
    setEvaluations((prev) => prev.map((e) => (e.id === ev.id ? { ...e, status: next } : e)));
  }

  function openAddQuestion() {
    setQText("");
    setQType("objective");
    setQOptions(["", "", "", ""]);
    setQCorrect(0);
    setQPoints(1);
    setQuestionDialogOpen(true);
  }

  function addQuestion() {
    if (!qText.trim()) return;
    const q: Question = {
      id: Date.now(),
      text: qText,
      type: qType,
      points: qPoints,
      ...(qType === "objective" ? { options: [...qOptions], correctOption: qCorrect } : {}),
    };
    setQuestions((prev) => [...prev, q]);
    setQuestionDialogOpen(false);
  }

  function removeQuestion(id: number) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Avaliações</h1>
          <p className="text-muted-foreground mt-1">Gerencie provas, exercícios e simulados</p>
        </div>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" /> Nova Avaliação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: evaluations.length, icon: FileQuestion, color: "text-primary" },
          { label: "Publicadas", value: evaluations.filter((e) => e.status === "publicada").length, icon: CheckCircle, color: "text-success" },
          { label: "Tentativas", value: evaluations.reduce((s, e) => s + e.attempts, 0), icon: BarChart3, color: "text-accent" },
          { label: "Média Geral", value: (evaluations.filter((e) => e.avgScore > 0).reduce((s, e) => s + e.avgScore, 0) / (evaluations.filter((e) => e.avgScore > 0).length || 1)).toFixed(1), icon: Timer, color: "text-secondary" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl p-4 shadow-card border border-border">
            <div className="flex items-center justify-between mb-2">
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-heading font-bold text-card-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar avaliações..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map((ev, i) => (
          <motion.div key={ev.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="bg-card rounded-xl p-4 shadow-card border border-border hover:shadow-elevated transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-semibold text-card-foreground">{ev.title}</h3>
                  <Badge variant="outline" className={statusStyles[ev.status]}>{ev.status === "rascunho" ? "Rascunho" : ev.status === "publicada" ? "Publicada" : "Encerrada"}</Badge>
                  <Badge variant="secondary">{typeLabels[ev.type]}</Badge>
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                  <span>{ev.course}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {ev.duration}min</span>
                  <span className="flex items-center gap-1"><FileQuestion className="w-3 h-3" /> {ev.questions.length} questões</span>
                  {ev.shuffle && <span className="flex items-center gap-1"><Shuffle className="w-3 h-3" /> Embaralhada</span>}
                  {ev.attempts > 0 && <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {ev.attempts} tentativas • Média: {ev.avgScore}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => openView(ev)}><Eye className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(ev)}><Edit className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => toggleStatus(ev)}>
                  {ev.status === "publicada" ? <XCircle className="w-4 h-4 text-destructive" /> : <CheckCircle className="w-4 h-4 text-success" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteEval(ev.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">Nenhuma avaliação encontrada</div>
        )}
      </div>

      {/* Eval Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewMode ? "Visualizar Avaliação" : currentEval ? "Editar Avaliação" : "Nova Avaliação"}</DialogTitle>
            <DialogDescription>
              {viewMode ? "Detalhes da avaliação" : "Preencha os dados da avaliação e adicione questões"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={viewMode} placeholder="Nome da avaliação" />
              </div>
              <div className="space-y-2">
                <Label>Curso</Label>
                <Input value={course} onChange={(e) => setCourse(e.target.value)} disabled={viewMode} placeholder="Curso vinculado" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)} disabled={viewMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prova">Prova</SelectItem>
                    <SelectItem value="exercicio">Exercício</SelectItem>
                    <SelectItem value="simulado">Simulado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} disabled={viewMode} />
              </div>
              <div className="flex items-center gap-2 pt-7">
                <Switch checked={shuffle} onCheckedChange={setShuffle} disabled={viewMode} />
                <Label>Embaralhar questões</Label>
              </div>
            </div>

            {/* Questions */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-heading font-semibold text-card-foreground">Questões ({questions.length})</h4>
                  <p className="text-xs text-muted-foreground">Total: {totalPoints} pontos</p>
                </div>
                {!viewMode && (
                  <Button size="sm" variant="outline" onClick={openAddQuestion} className="gap-1">
                    <Plus className="w-3 h-3" /> Questão
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {questions.map((q, qi) => (
                  <div key={q.id} className="bg-muted/30 rounded-lg p-3 border border-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-[10px]">{q.type === "objective" ? "Objetiva" : "Discursiva"}</Badge>
                          <span className="text-[10px] text-muted-foreground">{q.points} pt{q.points > 1 ? "s" : ""}</span>
                        </div>
                        <p className="text-sm text-card-foreground">{qi + 1}. {q.text}</p>
                        {q.options && (
                          <div className="mt-2 space-y-1">
                            {q.options.map((opt, oi) => (
                              <p key={oi} className={`text-xs pl-3 ${oi === q.correctOption ? "text-success font-medium" : "text-muted-foreground"}`}>
                                {String.fromCharCode(65 + oi)}) {opt}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      {!viewMode && (
                        <Button size="sm" variant="ghost" onClick={() => removeQuestion(q.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {questions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma questão adicionada</p>
                )}
              </div>
            </div>
          </div>

          {!viewMode && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveEval} className="gradient-primary text-primary-foreground">Salvar</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Question Dialog */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Questão</DialogTitle>
            <DialogDescription>Configure o tipo e conteúdo da questão</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={qType} onValueChange={(v) => setQType(v as typeof qType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="objective">Objetiva</SelectItem>
                    <SelectItem value="discursive">Discursiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pontuação</Label>
                <Input type="number" value={qPoints} onChange={(e) => setQPoints(Number(e.target.value))} min={1} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Enunciado</Label>
              <Textarea value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Digite a pergunta..." rows={3} />
            </div>
            {qType === "objective" && (
              <div className="space-y-2">
                <Label>Alternativas</Label>
                {qOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      onClick={() => setQCorrect(i)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                        ${i === qCorrect ? "border-success bg-success/10" : "border-border"}`}
                    >
                      {i === qCorrect && <CheckCircle className="w-4 h-4 text-success" />}
                    </button>
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const copy = [...qOptions];
                        copy[i] = e.target.value;
                        setQOptions(copy);
                      }}
                      placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Clique no círculo para marcar a resposta correta</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={addQuestion} className="gradient-primary text-primary-foreground">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
