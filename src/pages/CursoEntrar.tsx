import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

export default function CursoEntrar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, loading, passwordChangeRequired } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (loading || !id || ran.current) return;

    if (!session) {
      navigate(`/login?next=${encodeURIComponent(`/curso/${id}/entrar`)}`, { replace: true });
      return;
    }

    ran.current = true;
    if (passwordChangeRequired) {
      navigate("/reset-password?initial=1", { replace: true });
      return;
    }
    (async () => {
      const { error } = await supabase.rpc("matricular_via_link" as any, { _course_id: id });
      if (error) {
        setError(error.message);
        return;
      }
      navigate(`/courses/${id}`, { replace: true });
    })();
  }, [id, session, loading, passwordChangeRequired, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        {error ? (
          <>
            <AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <h1 className="font-heading text-xl font-bold text-foreground">Não foi possível liberar o curso</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-6" onClick={() => navigate("/courses")}>Ver meus cursos</Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <h1 className="font-heading text-xl font-bold text-foreground">Liberando seu acesso ao curso…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Aguarde um instante.</p>
          </>
        )}
      </div>
    </div>
  );
}
