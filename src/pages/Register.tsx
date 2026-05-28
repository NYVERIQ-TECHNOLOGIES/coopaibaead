import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Camera,
  Loader2,
  IdCard,
  Check,
  X,
  Phone,
  MapPin,
  Sparkles,
} from "lucide-react";

import logoImg from "@/assets/logo-coopaiba.png";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import SEO from "@/components/SEO";

type PasswordCheck = {
  key: string;
  label: string;
  test: (pwd: string) => boolean;
};

const PASSWORD_CHECKS: PasswordCheck[] = [
  { key: "length", label: "Mínimo de 8 caracteres", test: (p) => p.length >= 8 },
  { key: "upper", label: "Pelo menos 1 letra maiúscula (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { key: "lower", label: "Pelo menos 1 letra minúscula (a-z)", test: (p) => /[a-z]/.test(p) },
  { key: "numbers", label: "Pelo menos 2 números (0-9)", test: (p) => (p.match(/\d/g) || []).length >= 2 },
  {
    key: "special",
    label: "Pelo menos 1 caractere especial (!@#$...)",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [userType, setUserType] = useState<"aluno" | "cooperado" | "eventual">("aluno");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cooperativa, setCooperativa] = useState("");
  const [phone, setPhone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cooperativasList, setCooperativasList] = useState<{ id: string; name: string }[]>([]);

  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Máscara CPF: 000.000.000-00
  const formatCpf = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  // Validação de CPF (dígitos verificadores)
  const isValidCpf = (value: string) => {
    const c = value.replace(/\D/g, "");
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
    let d1 = (sum * 10) % 11;
    if (d1 === 10) d1 = 0;
    if (d1 !== parseInt(c[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
    let d2 = (sum * 10) % 11;
    if (d2 === 10) d2 = 0;
    return d2 === parseInt(c[10]);
  };

  useEffect(() => {
    supabase
      .from("cooperativas")
      .select("id, name")
      .eq("active", true)
      .order("name")
      .then(({ data }) => {
        if (data && data.length) setCooperativasList(data);
        else setCooperativasList([{ id: "default", name: "Coopaíba" }]);
      });
  }, []);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Foto muito grande", description: "O arquivo deve ter no máximo 5MB.", variant: "destructive" });
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ====== Validação de senha em tempo real ======
  const passwordResults = useMemo(
    () => PASSWORD_CHECKS.map((c) => ({ ...c, ok: c.test(password) })),
    [password]
  );
  const passedCount = passwordResults.filter((r) => r.ok).length;
  const allPasswordOk = passedCount === PASSWORD_CHECKS.length;

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const confirmHasError = confirmPassword.length > 0 && !passwordsMatch;

  const strength: { level: 0 | 1 | 2 | 3; label: string; color: string; barColor: string } = useMemo(() => {
    if (password.length === 0) return { level: 0, label: "", color: "", barColor: "" };
    if (passedCount <= 2)
      return {
        level: 1,
        label: "Fraca",
        color: "text-destructive",
        barColor: "bg-destructive",
      };
    if (passedCount <= 4)
      return {
        level: 2,
        label: "Média",
        color: "text-warning",
        barColor: "bg-warning",
      };
    return { level: 3, label: "Forte", color: "text-success", barColor: "bg-success" };
  }, [password, passedCount]);

  const trimmedName = fullName.trim();
  const nameOk = trimmedName.length > 0 && trimmedName.split(/\s+/).length >= 2;
  const cpfOk = isValidCpf(cpf);
  const emailRequired = userType === "aluno";
  const emailOk = !emailRequired || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const cooperativaOk = userType !== "cooperado" || !!cooperativa;
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneOk = userType !== "eventual" || phoneDigits.length >= 10;
  const enderecoOk = userType !== "eventual" || endereco.trim().length >= 5;

  const formValid =
    nameOk && cpfOk && emailOk && allPasswordOk && passwordsMatch && agreed && cooperativaOk && phoneOk && enderecoOk;

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 10) {
      return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
    }
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
  };


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameOk) {
      toast({
        title: "Nome completo obrigatório",
        description: "Informe seu nome completo (nome e sobrenome).",
        variant: "destructive",
      });
      return;
    }
    if (!cpf.trim()) {
      toast({ title: "CPF obrigatório", description: "Informe seu CPF para criar a conta.", variant: "destructive" });
      return;
    }
    if (!cpfOk) {
      toast({ title: "CPF inválido", description: "Digite um CPF válido para continuar.", variant: "destructive" });
      return;
    }
    if (emailRequired && !emailOk) {
      toast({ title: "E-mail inválido", description: "Digite um e-mail válido.", variant: "destructive" });
      return;
    }
    if (!allPasswordOk) {
      toast({
        title: "Senha não atende aos requisitos",
        description: "Verifique os critérios listados abaixo do campo de senha.",
        variant: "destructive",
      });
      return;
    }
    if (!passwordsMatch) {
      toast({
        title: "Senhas não coincidem",
        description: "Os campos 'Senha' e 'Confirmar senha' devem ser iguais.",
        variant: "destructive",
      });
      return;
    }
    if (!agreed) {
      toast({ title: "Aceite os termos", description: "Você precisa concordar com os Termos de Uso.", variant: "destructive" });
      return;
    }
    if (!cooperativaOk) {
      toast({ title: "Selecione a cooperativa", description: "Escolha uma cooperativa para continuar.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const cleanCpf = cpf.replace(/\D/g, "");

    // ====== Fluxo COOPERADO ou COOPERADO EVENTUAL (via edge function + e-mail sintético) ======
    if (userType === "cooperado" || userType === "eventual") {
      try {
        let avatar_url: string | undefined;

        if (photoFile) {
          const ext = photoFile.name.split(".").pop();
          const prefix = userType === "eventual" ? "eventual" : "cooperado";
          const path = `${prefix}-${cleanCpf}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("avatars")
            .upload(path, photoFile, { upsert: true, contentType: photoFile.type });
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
            avatar_url = publicUrl;
          }
        }

        const { data, error: fnErr } = await supabase.functions.invoke("register-cooperado", {
          body: {
            cpf: cleanCpf,
            password,
            full_name: trimmedName,
            cooperativa: userType === "cooperado" ? cooperativa : null,
            avatar_url,
            tipo: userType,
            phone: userType === "eventual" ? phoneDigits : null,
            endereco: userType === "eventual" ? endereco.trim() : null,
          },
        });

        if (fnErr || (data && (data as { error?: string }).error)) {
          const msg = (data as { error?: string })?.error || fnErr?.message || "Falha ao criar conta";
          toast({ title: "Erro ao criar conta", description: msg, variant: "destructive" });
          setLoading(false);
          return;
        }

        toast({
          title: "Solicitação enviada para análise",
          description:
            userType === "eventual"
              ? "Seu cadastro de cooperado eventual será revisado pela administração. Você receberá acesso após a aprovação."
              : "Seu cadastro de cooperado será revisado pela administração. Você receberá acesso após a aprovação.",
        });
        navigate("/login");
        setLoading(false);
        return;
      } catch (err) {
        toast({
          title: "Erro ao criar conta",
          description: err instanceof Error ? err.message : "Erro desconhecido",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }


    // ====== Fluxo ALUNO: signup padrão com e-mail real ======
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: trimmedName,
          cpf: cleanCpf,
          user_type: "aluno",
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const newUserId = signUpData.user?.id;

    if (newUserId) {
      try {
        await new Promise((r) => setTimeout(r, 400));

        const updates: { avatar_url?: string; cpf?: string; full_name?: string } = {
          cpf: cleanCpf,
          full_name: trimmedName,
        };

        if (photoFile) {
          const ext = photoFile.name.split(".").pop();
          const path = `${newUserId}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("avatars")
            .upload(path, photoFile, { upsert: true, contentType: photoFile.type });
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
            updates.avatar_url = publicUrl;
          }
        }

        await supabase.from("profiles").update(updates).eq("user_id", newUserId);
      } catch {
        // Não bloqueia o cadastro
      }
    }

    toast({ title: "Conta criada com sucesso!", description: "Verifique seu e-mail para confirmar a conta." });
    navigate("/login");
    setLoading(false);
  };

  const initials =
    fullName
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background">
      <SEO
        title="Cadastre-se | Coopaiba EAD"
        description="Crie sua conta gratuita na Coopaiba EAD e participe dos cursos de educação cooperativista."
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="flex items-center gap-3 mb-6 sm:mb-8 justify-center">
          <img src={logoImg} alt="Coopaiba EAD" className="w-10 h-10 rounded-xl object-contain" />
          <h1 className="font-heading text-xl font-bold text-foreground">Coopaiba EAD</h1>
        </div>

        <div className="bg-card rounded-2xl p-5 sm:p-8 shadow-elevated border border-border">
          <h2 className="text-2xl font-heading font-bold text-card-foreground text-center">Criar Conta</h2>
          <p className="text-muted-foreground mt-1 mb-6 text-center text-sm">
            Junte-se à comunidade de aprendizagem cooperativista
          </p>

          {/* Type selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setUserType("aluno")}
              className={`p-4 rounded-xl border-2 transition-all text-center ${
                userType === "aluno" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
              }`}
            >
              <User
                className={`w-6 h-6 mx-auto mb-2 ${userType === "aluno" ? "text-primary" : "text-muted-foreground"}`}
              />
              <p
                className={`text-sm font-semibold ${userType === "aluno" ? "text-primary" : "text-card-foreground"}`}
              >
                Aluno
              </p>
              <p className="text-xs text-muted-foreground mt-1">Acesso aos cursos gerais</p>
            </button>
            <button
              type="button"
              onClick={() => setUserType("cooperado")}
              className={`p-4 rounded-xl border-2 transition-all text-center ${
                userType === "cooperado"
                  ? "border-secondary bg-secondary/5"
                  : "border-border hover:border-muted-foreground"
              }`}
            >
              <Shield
                className={`w-6 h-6 mx-auto mb-2 ${
                  userType === "cooperado" ? "text-secondary" : "text-muted-foreground"
                }`}
              />
              <p
                className={`text-sm font-semibold ${
                  userType === "cooperado" ? "text-secondary" : "text-card-foreground"
                }`}
              >
                Cooperado
              </p>
              <p className="text-xs text-muted-foreground mt-1">Acesso completo + exclusivos</p>
            </button>
            <button
              type="button"
              onClick={() => setUserType("eventual")}
              className={`p-4 rounded-xl border-2 transition-all text-center ${
                userType === "eventual"
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-muted-foreground"
              }`}
            >
              <Sparkles
                className={`w-6 h-6 mx-auto mb-2 ${
                  userType === "eventual" ? "text-accent-foreground" : "text-muted-foreground"
                }`}
              />
              <p
                className={`text-sm font-semibold ${
                  userType === "eventual" ? "text-accent-foreground" : "text-card-foreground"
                }`}
              >
                Cooperado Eventual
              </p>
              <p className="text-xs text-muted-foreground mt-1">Acesso por campanha</p>
            </button>
          </div>


          <form className="space-y-4" onSubmit={handleRegister} noValidate>
            {/* Photo picker */}
            <div className="flex flex-col items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="relative w-20 h-20 rounded-full border-4 border-primary/20 bg-primary/10 flex items-center justify-center overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Adicionar foto de perfil"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Pré-visualização" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-primary">{initials}</span>
                )}
                <span className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-primary-foreground" />
                </span>
              </button>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              <p className="text-xs text-muted-foreground">Foto de perfil (opcional)</p>
            </div>

            {/* Nome */}
            <div>
              <label htmlFor="fullName" className="text-sm font-medium text-card-foreground mb-1.5 block">
                Nome completo *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="fullName"
                  type="text"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {fullName.length > 0 && !nameOk && (
                <p className="text-xs text-destructive mt-1">Informe nome e sobrenome.</p>
              )}
            </div>

            {/* CPF */}
            <div>
              <label htmlFor="cpf" className="text-sm font-medium text-card-foreground mb-1.5 block">
                CPF *
              </label>
              <div className="relative">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  required
                  maxLength={14}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {cpf.length > 0 && !cpfOk && (
                <p className="text-xs text-destructive mt-1">CPF inválido.</p>
              )}
            </div>

            {userType === "cooperado" && (
              <div>
                <label className="text-sm font-medium text-card-foreground mb-1.5 block">Cooperativa *</label>
                <Select value={cooperativa} onValueChange={setCooperativa}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Selecione sua cooperativa" />
                  </SelectTrigger>
                  <SelectContent>
                    {cooperativasList.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* E-mail (apenas para alunos) */}
            {userType === "aluno" && (
              <div>
                <label htmlFor="email" className="text-sm font-medium text-card-foreground mb-1.5 block">
                  E-mail *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {email.length > 0 && !emailOk && (
                  <p className="text-xs text-destructive mt-1">E-mail inválido.</p>
                )}
              </div>
            )}

            {/* Senha */}
            <div>
              <label htmlFor="password" className="text-sm font-medium text-card-foreground mb-1.5 block">
                Senha *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Crie uma senha forte"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  aria-describedby="password-checklist password-strength"
                  className="w-full pl-10 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Barra de força */}
              {password.length > 0 && (
                <div id="password-strength" className="mt-2">
                  <div className="flex gap-1.5" aria-hidden="true">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-colors",
                          strength.level >= i ? strength.barColor : "bg-muted"
                        )}
                      />
                    ))}
                  </div>
                  <p className={cn("text-xs mt-1 font-medium", strength.color)}>
                    Força da senha: {strength.label}
                  </p>
                </div>
              )}

              {/* Checklist visual */}
              <ul
                id="password-checklist"
                className="mt-3 space-y-1.5 bg-muted/40 rounded-lg p-3 border border-border"
                aria-live="polite"
              >
                {passwordResults.map((r) => (
                  <li key={r.key} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "flex items-center justify-center w-4 h-4 rounded-full shrink-0",
                        r.ok ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {r.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </span>
                    <span className={r.ok ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Confirmar senha */}
            <div>
              <label htmlFor="confirmPassword" className="text-sm font-medium text-card-foreground mb-1.5 block">
                Confirmar senha *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Digite a senha novamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  aria-invalid={confirmHasError}
                  className={cn(
                    "w-full pl-10 pr-10 py-2.5 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                    confirmHasError ? "border-destructive" : "border-border"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p
                  className={cn(
                    "text-xs mt-1 flex items-center gap-1",
                    passwordsMatch ? "text-success" : "text-destructive"
                  )}
                >
                  {passwordsMatch ? (
                    <>
                      <Check className="w-3 h-3" /> As senhas coincidem
                    </>
                  ) : (
                    <>
                      <X className="w-3 h-3" /> As senhas não coincidem
                    </>
                  )}
                </p>
              )}
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="rounded border-border mt-0.5"
              />
              <span>
                Concordo com os{" "}
                <Link to="/termos" target="_blank" className="text-primary underline">
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link to="/privacidade" target="_blank" className="text-primary underline">
                  Política de Privacidade
                </Link>{" "}
                (LGPD)
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !formValid}
              className="w-full gradient-primary text-primary-foreground py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Criando conta...
                </>
              ) : (
                <>
                  Criar Conta <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            {!formValid && !loading && (
              <p className="text-center text-xs text-muted-foreground">
                Preencha todos os campos corretamente para habilitar o botão.
              </p>
            )}
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
