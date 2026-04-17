import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { CheckCircle, Loader2, ListChecks } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evaluationId: string | null;
  evaluationTitle: string;
}

export default function StudentExamDialog({ open, onOpenChange, evaluationId, evaluationTitle }: Props) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(null);

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

  const submitMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("submit_exam_answers", {
        _evaluation_id: evaluationId!,
        _answers: answers,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      setResult({ score: data.score, correct: data.correct, total: data.total });
      toast({ title: "Avaliação enviada!", description: `Sua nota: ${data.score}%` });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleClose = (v: boolean) => {
    if (!v) {
      setAnswers({});
      setResult(null);
    }
    onOpenChange(v);
  };

  const allAnswered = questions.length > 0 && questions.every((q: any) => answers[q.id]);

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
              : `Responda todas as ${questions.length} questões e clique em Enviar.`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : result ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-success" />
            </div>
            <div>
              <p className="text-4xl font-heading font-bold text-foreground">{result.score}%</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.correct} de {result.total} questões corretas
              </p>
            </div>
            <Button onClick={() => handleClose(false)} className="gap-2">
              Concluir
            </Button>
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

        {!result && questions.length > 0 && (
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
