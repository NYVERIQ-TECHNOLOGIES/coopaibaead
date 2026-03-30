import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-primary-foreground/20"
              style={{
                width: Math.random() * 200 + 50,
                height: Math.random() * 200 + 50,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
              }}
            />
          ))}
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-8">
            <GraduationCap className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-heading font-bold text-primary-foreground mb-4">CoopEdu</h1>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Plataforma de educação cooperativista. Aprenda, colabore e cresça junto com sua comunidade.
          </p>
          <div className="flex justify-center gap-8 mt-12">
            {[
              { value: "1.200+", label: "Alunos" },
              { value: "32", label: "Cursos" },
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="font-heading text-xl font-bold text-foreground">CoopEdu</h1>
          </div>

          <h2 className="text-2xl font-heading font-bold text-foreground">Bem-vindo de volta</h2>
          <p className="text-muted-foreground mt-1 mb-8">Entre na sua conta para continuar</p>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="rounded border-border" /> Lembrar-me
              </label>
              <a href="#" className="text-primary hover:underline font-medium">Esqueci a senha</a>
            </div>

            <Link to="/"
              className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
              Entrar <ArrowRight className="w-4 h-4" />
            </Link>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Não tem uma conta? <Link to="/register" className="text-primary font-medium hover:underline">Cadastre-se</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
