import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, ArrowRight, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState<"aluno" | "cooperado">("aluno");

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground">CoopEdu</h1>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-elevated border border-border">
          <h2 className="text-2xl font-heading font-bold text-card-foreground text-center">Criar Conta</h2>
          <p className="text-muted-foreground mt-1 mb-6 text-center text-sm">Junte-se à comunidade de aprendizagem cooperativista</p>

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={() => setUserType("aluno")}
              className={`p-4 rounded-xl border-2 transition-all text-center ${userType === "aluno" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}`}>
              <User className={`w-6 h-6 mx-auto mb-2 ${userType === "aluno" ? "text-primary" : "text-muted-foreground"}`} />
              <p className={`text-sm font-semibold ${userType === "aluno" ? "text-primary" : "text-card-foreground"}`}>Aluno</p>
              <p className="text-xs text-muted-foreground mt-1">Acesso aos cursos gerais</p>
            </button>
            <button onClick={() => setUserType("cooperado")}
              className={`p-4 rounded-xl border-2 transition-all text-center ${userType === "cooperado" ? "border-secondary bg-secondary/5" : "border-border hover:border-muted-foreground"}`}>
              <Shield className={`w-6 h-6 mx-auto mb-2 ${userType === "cooperado" ? "text-secondary" : "text-muted-foreground"}`} />
              <p className={`text-sm font-semibold ${userType === "cooperado" ? "text-secondary" : "text-card-foreground"}`}>Cooperado</p>
              <p className="text-xs text-muted-foreground mt-1">Acesso completo + exclusivos</p>
            </button>
          </div>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-card-foreground mb-1.5 block">Nome</label>
                <input type="text" placeholder="Seu nome"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium text-card-foreground mb-1.5 block">Sobrenome</label>
                <input type="text" placeholder="Seu sobrenome"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            {userType === "cooperado" && (
              <div>
                <label className="text-sm font-medium text-card-foreground mb-1.5 block">Cooperativa</label>
                <input type="text" placeholder="Nome da sua cooperativa"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-card-foreground mb-1.5 block">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-card-foreground mb-1.5 block">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="rounded border-border mt-0.5" />
              <span>Concordo com os <a href="#" className="text-primary underline">Termos de Uso</a> e a <a href="#" className="text-primary underline">Política de Privacidade</a> (LGPD)</span>
            </label>

            <Link to="/"
              className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
              Criar Conta <ArrowRight className="w-4 h-4" />
            </Link>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Já tem conta? <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
