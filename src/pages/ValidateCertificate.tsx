import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Award, Search, CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logoImg from "@/assets/logo-coopaiba.png";

type ValidationResult = {
  code: string;
  status: string;
  issued_at: string;
  student_name: string | null;
  course_title: string | null;
  course_duration: string | null;
};

export default function ValidateCertificate() {
  const { code: codeParam } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const [code, setCode] = useState(codeParam ?? "");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (raw: string) => {
    const cleaned = raw.trim().toUpperCase();
    if (!cleaned) {
      setError("Informe um código de certificado.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(true);
    try {
      const { data, error } = await supabase.rpc("validate_certificate", { _code: cleaned });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      setResult(row ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao validar certificado.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-validate when arriving via /validar-certificado/:code
  useEffect(() => {
    if (codeParam) lookup(codeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (cleaned && cleaned !== codeParam) {
      navigate(`/validar-certificado/${encodeURIComponent(cleaned)}`);
    } else {
      lookup(code);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* SEO */}
      <head>
        <title>Validar Certificado | Coopaiba EAD</title>
        <meta
          name="description"
          content="Verifique a autenticidade de um certificado emitido pela Coopaiba EAD informando o código único."
        />
      </head>

      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoImg} alt="Coopaiba EAD" className="w-10 h-10 rounded-xl object-contain" />
            <div>
              <p className="font-heading font-bold text-foreground">Coopaiba EAD</p>
              <p className="text-xs text-muted-foreground">Validação de Certificado</p>
            </div>
          </Link>
          <Link to="/login" className="text-sm text-primary hover:underline flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Acessar plataforma
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-16 h-16 rounded-2xl gradient-primary mx-auto mb-4 flex items-center justify-center">
            <Award className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-heading font-bold text-foreground">
            Validar Certificado
          </h1>
          <p className="text-muted-foreground mt-2">
            Insira o código único impresso no certificado para confirmar sua autenticidade.
          </p>
        </motion.div>

        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-xl p-6 shadow-card"
        >
          <label htmlFor="cert-code" className="text-sm font-medium text-foreground">Código do certificado</label>
          <div className="flex gap-2 mt-2">
            <Input
              id="cert-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex: CERT-A1B2C3D4"
              autoFocus
              className="font-mono uppercase tracking-wider"
            />
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Validar
            </Button>
          </div>
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </form>

        {/* Result */}
        {searched && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            {result ? (
              <div className="bg-card border-2 border-success/50 rounded-xl p-6 shadow-elevated">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-7 h-7 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-heading font-bold text-foreground">
                      Certificado válido
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Emitido pela Coopaiba EAD — Educação Cooperativista
                    </p>

                    <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                      <div>
                        <dt className="text-muted-foreground text-xs uppercase">Código</dt>
                        <dd className="font-mono text-foreground font-medium">{result.code}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground text-xs uppercase">Emitido em</dt>
                        <dd className="text-foreground">
                          {result.issued_at
                            ? new Date(result.issued_at).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                              })
                            : "—"}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground text-xs uppercase">Aluno</dt>
                        <dd className="text-foreground font-medium">
                          {result.student_name || "—"}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground text-xs uppercase">Curso</dt>
                        <dd className="text-foreground font-medium">
                          {result.course_title || "—"}
                        </dd>
                      </div>
                      {result.course_duration && (
                        <div>
                          <dt className="text-muted-foreground text-xs uppercase">Carga horária</dt>
                          <dd className="text-foreground">{result.course_duration}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card border-2 border-destructive/40 rounded-xl p-6 shadow-card">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <XCircle className="w-7 h-7 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-xl font-heading font-bold text-foreground">
                      Certificado não encontrado
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Verifique se o código foi digitado corretamente. Apenas certificados
                      efetivamente emitidos podem ser validados.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      <footer className="border-t border-border mt-16">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Coopaiba EAD — Sistema oficial de validação de certificados
        </div>
      </footer>
    </div>
  );
}
