import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import logoImg from "@/assets/logo-coopaiba.png";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";

type Strength = { score: number; label: string; color: string };

function evaluateStrength(pwd: string): Strength {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (pwd.length >= 12) score++;
  const map: Record<number, Strength> = {
    0: { score: 0, label: "Muito fraca", color: "bg-destructive" },
    1: { score: 1, label: "Fraca", color: "bg-destructive" },
    2: { score: 2, label: "Razoável", color: "bg-warning" },
    3: { score: 3, label: "Boa", color: "bg-warning" },
    4: { score: 4, label: "Forte", color: "bg-success" },
    5: { score: 5, label: "Muito forte", color: "bg-success" },
  };
  return map[score] ?? map[0];
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Supabase Auth coloca o token no hash (#access_token=...&type=recovery)
  // O client detecta automaticamente e dispara PASSWORD_RECOVERY.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    if (tokenHash && params.get("type") === "recovery") {
      // Remove the credential from browser history before exchanging it.
      window.history.replaceState(null, "", window.location.pathname);
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ error }) => {
        if (error) setLinkExpired(true);
        else setSessionReady(true);
      });
    }
    const hash = window.location.hash || "";
    const hashHasError = hash.includes("error") || hash.includes("otp_expired");
    if (hashHasError) {
      setLinkExpired(true);
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setSessionReady(true);
      }
    });

    // Fallback: já existe sessão recuperada
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    // Se em ~3s não recebemos token nem sessão, considera expirado
    const timer = setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) setLinkExpired(true);
      });
    }, tokenHash ? 15000 : 3000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const strength = useMemo(() => evaluateStrength(password), [password]);

  const validate = (): string | null => {
    if (!password || !confirm) return "Preencha os dois campos de senha.";
    if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
    if (!/[A-Z]/.test(password)) return "A senha deve conter ao menos 1 letra maiúscula.";
    if (!/[0-9]/.test(password)) return "A senha deve conter ao menos 1 número.";
    if (!/[^A-Za-z0-9]/.test(password)) return "A senha deve conter ao menos 1 caractere especial.";
    if (password !== confirm) return "As senhas não coincidem.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: "Verifique os dados", description: err, variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({
        title: "Não foi possível redefinir",
        description: error.message ?? "Tente solicitar um novo link.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Invalida a sessão de recuperação para forçar novo login
    await supabase.auth.signOut();
    setDone(true);
    toast({ title: "Sucesso", description: "Senha redefinida com sucesso." });
    setLoading(false);
    setTimeout(() => navigate("/login", { replace: true }), 2200);
  };

  return (
    <div className="min-h-screen flex">
      <SEO
        title="Redefinir senha | Coopaiba EAD"
        description="Defina uma nova senha segura para acessar sua conta na Coopaiba EAD."
      />
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center"
        >
          <img src={logoImg} alt="Coopaiba EAD" className="w-28 h-28 mx-auto mb-8 rounded-2xl object-contain" />
          <h1 className="text-4xl font-heading font-bold text-primary-foreground mb-4">Nova senha</h1>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Crie uma senha forte para manter sua conta sempre segura.
          </p>
        </motion.div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src={logoImg} alt="Coopaiba EAD" className="w-10 h-10 rounded-xl object-contain" />
            <p className="font-heading text-xl font-bold text-foreground">Coopaiba EAD</p>
          </div>

          {done ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-heading font-bold text-foreground">Senha redefinida</h2>
              <p className="text-muted-foreground mt-2">Você já pode entrar com a nova senha.</p>
            </div>
          ) : linkExpired ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-heading font-bold text-foreground">Link expirado</h2>
              <p className="text-muted-foreground mt-2 mb-6">
                Link expirado. Solicite uma nova recuperação de senha.
              </p>
              <Link
                to="/forgot-password"
                className="inline-flex items-center gap-2 gradient-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Solicitar novo link <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-heading font-bold text-foreground">Redefinir senha</h2>
              <p className="text-muted-foreground mt-1 mb-8">Defina uma nova senha para acessar sua conta.</p>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="new-password" className="text-sm font-medium text-foreground mb-1.5 block">Nova senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="new-password"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPw}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {password.length > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${strength.color} transition-all`}
                          style={{ width: `${(strength.score / 5) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Força da senha: {strength.label}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="confirm-password" className="text-sm font-medium text-foreground mb-1.5 block">Confirmar nova senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="confirm-password"
                      type={showPw ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  {confirm.length > 0 && confirm !== password && (
                    <p className="text-xs text-destructive mt-1.5">As senhas não coincidem.</p>
                  )}
                </div>

                <ul className="text-xs text-muted-foreground space-y-1 pl-1">
                  <li className={password.length >= 8 ? "text-success" : ""}>• Mínimo de 8 caracteres</li>
                  <li className={/[A-Z]/.test(password) ? "text-success" : ""}>• Pelo menos 1 letra maiúscula</li>
                  <li className={/[0-9]/.test(password) ? "text-success" : ""}>• Pelo menos 1 número</li>
                  <li className={/[^A-Za-z0-9]/.test(password) ? "text-success" : ""}>
                    • Pelo menos 1 caractere especial
                  </li>
                </ul>

                <button
                  type="submit"
                  disabled={loading || !sessionReady}
                  className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Redefinir senha"} {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

                {!sessionReady && !linkExpired && (
                  <p className="text-xs text-muted-foreground text-center">Validando link de recuperação...</p>
                )}
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
