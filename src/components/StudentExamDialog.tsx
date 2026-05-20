import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { CheckCircle, Loader2, ListChecks, XCircle, RotateCcw, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evaluationId: string | null;
  evaluationTitle: string;
  evaluationType?: string;          // "prova" | "simulado" | "exercicio"
  courseId?: string | null;          // required for final-exam reset
}

const PASS_THRESHOLD = 70;           // 7,0 / 10
const MAX_FINAL_ATTEMPTS = 3;

export default function StudentExamDialog({
  open,
  onOpenChange,
  evaluationId,
  evaluationTitle,
  evaluationType = "exercicio",
  courseId = null,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number; details?: Array<{ question_id: string; given: string; correct_option: string; is_correct: boolean }> } | null>(null);
  const [resetting, setResetting] = useState(false);

  const isFinalExam = evaluationType === "prova";

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["exam_questions_safe", evaluationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evaluation_questions_safe")
        .select("*")
        .eq("evaluation_id", evaluationId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!evaluationId && open,
  });

  // Fetch previous attempts for this evaluation (to count + show best score)
  const { data: previousAttempts = [], refetch: refetchAttempts } = useQuery({
    queryKey: ["my_attempts_for_eval", evaluationId, user?.id],
    queryFn: async () => {
      if (!user || !evaluationId) return [];
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("id, score, submitted_at")
        .eq("user_id", user.id)
        .eq("evaluation_id", evaluationId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && !!evaluationId && open,
  });

  const attemptCount = previousAttempts.length;
  const attemptsLeft = isFinalExam ? Math.max(0, MAX_FINAL_ATTEMPTS - attemptCount) : Infinity;
  const bestScore = previousAttempts.length > 0 ? Math.max(...previousAttempts.map((a: any) => Number(a.score))) : 0;
  const hasPassed = bestScore >= PASS_THRESHOLD;

  const submitMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("submit_exam_answers", {
        _evaluation_id: evaluationId!,
        _answers: answers,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: async (data) => {
      setResult({ score: Number(data.score), correct: data.correct, total: data.total });
      await refetchAttempts();
      qc.invalidateQueries({ queryKey: ["my_exam_attempts"] });
      const passed = Number(data.score) >= PASS_THRESHOLD;
      toast({
        title: passed ? "Aprovado!" : "Não atingiu a média",
        description: `Sua nota: ${data.score}% (mínimo ${PASS_THRESHOLD}%)`,
        variant: passed ? "default" : "destructive",
      });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleReset = async () => {
    if (!courseId) return;
    setResetting(true);
    try {
      const { error } = await supabase.rpc("reset_course_progress", { _course_id: courseId });
      if (error) throw error;
      toast({
        title: "Curso reiniciado",
        description: "Suas tentativas e progresso foram zerados. Você pode começar novamente.",
      });
      qc.invalidateQueries({ queryKey: ["my_lesson_completions", courseId] });
      qc.invalidateQueries({ queryKey: ["my_exam_attempts", courseId] });
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      handleClose(false);
    } catch (e: any) {
      toast({ title: "Erro ao reiniciar", description: e.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setResult(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setAnswers({});
      setResult(null);
    }
    onOpenChange(v);
  };

  const allAnswered = questions.length > 0 && questions.every((q: any) => answers[q.id]);
  const lastAttemptScore = result?.score ?? 0;
  const lastPassed = lastAttemptScore >= PASS_THRESHOLD;
  const finalExamFailed = isFinalExam && !lastPassed && attemptsLeft <= 0;

  // Block opening if already passed or out of attempts (without showing form)
  const lockedOut = !result && (
    (hasPassed && !isFinalExam) ||
    (isFinalExam && hasPassed) ||
    (isFinalExam && attemptsLeft <= 0)
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary" /> {evaluationTitle}
          </DialogTitle>
          <DialogDescription>
            {result
              ? "Resultado da sua avaliação"
              : `Responda todas as ${questions.length} questões. Média mínima: ${PASS_THRESHOLD}%.`}
            {isFinalExam && !result && (
              <span className="block mt-1 text-xs">
                Prova final — tentativa {Math.min(attemptCount + 1, MAX_FINAL_ATTEMPTS)} de {MAX_FINAL_ATTEMPTS}.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : lockedOut ? (
          <div className="text-center py-8 space-y-4">
            {hasPassed ? (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-success" />
                </div>
                <div>
                  <p className="text-lg font-heading font-bold text-foreground">Já aprovado!</p>
                  <p className="text-sm text-muted-foreground mt-1">Melhor nota: {bestScore}%</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-destructive" />
                </div>
                <div>
                  <p className="text-lg font-heading font-bold text-foreground">Tentativas esgotadas</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Você usou {MAX_FINAL_ATTEMPTS} tentativas sem atingir a média. O curso será reiniciado.
                  </p>
                </div>
                <Button onClick={handleReset} disabled={resetting} className="gap-2">
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Reiniciar curso
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => handleClose(false)}>Fechar</Button>
          </div>
        ) : result ? (
          <div className="text-center py-8 space-y-4">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${lastPassed ? "bg-success/10" : "bg-destructive/10"}`}>
              {lastPassed ? (
                <CheckCircle className="w-10 h-10 text-success" />
              ) : (
                <XCircle className="w-10 h-10 text-destructive" />
              )}
            </div>
            <div>
              <p className="text-4xl font-heading font-bold text-foreground">{result.score}%</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.correct} de {result.total} questões corretas
              </p>
              <p className={`text-sm font-semibold mt-2 ${lastPassed ? "text-success" : "text-destructive"}`}>
                {lastPassed ? "Aprovado!" : `Reprovado (mínimo ${PASS_THRESHOLD}%)`}
              </p>
            </div>

            {isFinalExam && !lastPassed && (
              <div className="text-sm text-muted-foreground">
                Tentativas restantes: <strong className="text-foreground">{attemptsLeft}</strong> de {MAX_FINAL_ATTEMPTS}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              {finalExamFailed ? (
                <Button onClick={handleReset} disabled={resetting} className="gap-2" variant="destructive">
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Reiniciar curso
                </Button>
              ) : !lastPassed && (
                <Button onClick={handleRetry} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Tentar novamente
                </Button>
              )}
              <Button variant="outline" onClick={() => handleClose(false)}>Concluir</Button>
            </div>
          </div>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma questão cadastrada nesta avaliação.
          </p>
        ) : (
          <div className="space-y-6">
            {questions.map((q: any, idx: number) => (
              <div key={q.id} className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border">
                <p className="font-medium text-card-foreground text-sm">
                  <span className="text-primary mr-1">{idx + 1}.</span>
                  {q.question_text}
                </p>
                <div className="space-y-2">
                  {(["a", "b", "c", "d"] as const).map((opt) => {
                    const text = q[`option_${opt}`];
                    if (!text) return null;
                    return (
                      <label
                        key={opt}
                        className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                          answers[q.id] === opt
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          className="mt-0.5"
                        />
                        <span className="text-sm text-card-foreground">
                          <strong className="uppercase mr-1">{opt})</strong>
                          {text}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {!result && !lockedOut && questions.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => submitMut.mutate()}
              disabled={!allAnswered || submitMut.isPending}
              className="gradient-primary text-primary-foreground gap-2"
            >
              {submitMut.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                </>
              ) : (
                "Enviar Respostas"
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
