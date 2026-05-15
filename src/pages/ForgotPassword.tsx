import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import logoImg from "@/assets/logo-coopaiba.png";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const value = email.trim().toLowerCase();
    if (!value) {
      toast({ title: "Informe seu e-mail", description: "O campo de e-mail é obrigatório.", variant: "destructive" });
      return;
    }
    if (!isValidEmail(value)) {
      toast({ title: "E-mail inválido", description: "Digite um e-mail no formato correto.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Sempre dispara o reset; o Supabase silenciosamente ignora e-mails desconhecidos.
      // NUNCA revele se o e-mail existe (prevenção de enumeração de contas).
      await supabase.auth.resetPasswordForEmail(value, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      // Resposta uniforme, independentemente da existência do e-mail.
      setSent(true);
      toast({
        title: "Verifique seu e-mail",
        description: "Se este e-mail estiver cadastrado, você receberá um link de recuperação.",
      });
    } catch {
      // Mesmo em caso de erro interno, exibimos a mesma mensagem neutra
      // para evitar canais laterais de enumeração.
      setSent(true);
      toast({
        title: "Verifique seu e-mail",
        description: "Se este e-mail estiver cadastrado, você receberá um link de recuperação.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative z-10 text-center"
        >
          <img src={logoImg} alt="Coopaiba EAD" className="w-28 h-28 mx-auto mb-8 rounded-2xl object-contain" />
          <h1 className="text-4xl font-heading font-bold text-primary-foreground mb-4">Recuperar acesso</h1>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Vamos te ajudar a voltar para sua jornada de aprendizado em poucos cliques.
          </p>
        </motion.div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src={logoImg} alt="Coopaiba EAD" className="w-10 h-10 rounded-xl object-contain" />
            <p className="font-heading text-xl font-bold text-foreground">Coopaiba EAD</p>
          </div>

          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-heading font-bold text-foreground">Verifique seu e-mail</h2>
              <p className="text-muted-foreground mt-2 mb-8">
                Se <strong className="text-foreground">{email}</strong> estiver cadastrado, você receberá um link de
                recuperação em instantes. O link expira em até 1 hora.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-heading font-bold text-foreground">Esqueci minha senha</h2>
              <p className="text-muted-foreground mt-1 mb-8">
                Informe o e-mail cadastrado para receber o link de recuperação.
              </p>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="forgot-email" className="text-sm font-medium text-foreground mb-1.5 block">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  {email.length > 0 && !isValidEmail(email) && (
                    <p className="text-xs text-destructive mt-1.5">Digite um e-mail válido.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !isValidEmail(email)}
                  className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground py-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar para o login
                </Link>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
