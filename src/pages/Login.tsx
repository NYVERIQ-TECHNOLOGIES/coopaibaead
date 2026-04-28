import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import logoImg from "@/assets/logo-coopaiba.png";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const redirectAfterLogin = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    // Block deactivated users
    const { data: profile } = await supabase.from("profiles").select("is_active").eq("user_id", user.id).maybeSingle();
    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      toast({
        title: "Conta desativada",
        description: "Sua conta foi desativada. Entre em contato com o administrador.",
        variant: "destructive",
      });
      navigate("/login", { replace: true });
      return;
    }

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const role = roleData?.role;
    if (role === "admin") navigate("/", { replace: true });
    else navigate("/student", { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Detecta se é CPF (apenas dígitos, 11 caracteres após limpeza) ou e-mail
    const digits = email.replace(/\D/g, "");
    const isCpf = !email.includes("@") && digits.length === 11;
    const loginEmail = isCpf ? `cpf${digits}@cooperado.coopaiba.local` : email;

    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });

    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Check if MFA is required (assurance level upgrade needed)
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        setMfaFactorId(totp.id);
        setMfaRequired(true);
        setLoading(false);
        return;
      }
    }

    await redirectAfterLogin();
    setLoading(false);
  };

  const verifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setVerifyingMfa(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (chErr || !ch) {
      toast({ title: "Erro", description: chErr?.message, variant: "destructive" });
      setVerifyingMfa(false);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: ch.id,
      code: mfaCode,
    });
    if (error) {
      toast({ title: "Código inválido", description: error.message, variant: "destructive" });
      setVerifyingMfa(false);
      return;
    }
    await redirectAfterLogin();
    setVerifyingMfa(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-primary-foreground/20"
              style={{
                width: Math.random() * 200 + 50,
                height: Math.random() * 200 + 50,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
              }}
            />
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative z-10 text-center"
        >
          <img src={logoImg} alt="Coopaiba EAD" className="w-28 h-28 mx-auto mb-8 rounded-2xl object-contain" />
          <h1 className="text-4xl font-heading font-bold text-primary-foreground mb-4">Coopaiba EAD</h1>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Plataforma de educação cooperativista. Aprenda, colabore e cresça junto com sua comunidade.
          </p>
          <div className="flex justify-center gap-8 mt-12">
            {[
              { value: "1.200+", label: "Alunos" },
              { value: "20+", label: "Cursos" },
              { value: "95%", label: "Satisfação" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-heading font-bold text-primary-foreground">{stat.value}</p>
                <p className="text-sm text-primary-foreground/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src={logoImg} alt="Coopaiba EAD" className="w-10 h-10 rounded-xl object-contain" />
            <h1 className="font-heading text-xl font-bold text-foreground">Coopaiba EAD</h1>
          </div>

          {mfaRequired ? (
            <>
              <h2 className="text-2xl font-heading font-bold text-foreground">Autenticação de 2 fatores</h2>
              <p className="text-muted-foreground mt-1 mb-8">Digite o código de 6 dígitos do seu app autenticador</p>
              <form className="space-y-4" onSubmit={verifyMfa}>
                <input
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg text-center text-2xl font-mono tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="submit"
                  disabled={mfaCode.length !== 6 || verifyingMfa}
                  className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {verifyingMfa ? "Verificando..." : "Verificar"} {!verifyingMfa && <ArrowRight className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setMfaRequired(false);
                    setMfaCode("");
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancelar e voltar
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-heading font-bold text-foreground">Bem-vindo de volta</h2>
              <p className="text-muted-foreground mt-1 mb-8">Entre na sua conta para continuar</p>

              <form className="space-y-4" onSubmit={handleLogin}>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input type="checkbox" className="rounded border-border" /> Lembrar-me
                  </label>
                  <Link to="/forgot-password" className="text-primary hover:underline font-medium">
                    Esqueci minha senha?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? "Entrando..." : "Entrar"} {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Não tem uma conta?{" "}
                <Link to="/register" className="text-primary font-medium hover:underline">
                  Cadastre-se
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
