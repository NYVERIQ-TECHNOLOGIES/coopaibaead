import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Shield, Camera, Loader2, IdCard } from "lucide-react";
import logoImg from "@/assets/logo-coopaiba.png";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState<"aluno" | "cooperado">("aluno");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cooperativa, setCooperativa] = useState("");
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().split(/\s+/).length < 2) {
      toast({ title: "Nome completo obrigatório", description: "Informe seu nome completo (nome e sobrenome).", variant: "destructive" });
      return;
    }
    if (!cpf.trim()) {
      toast({ title: "CPF obrigatório", description: "Informe seu CPF para criar a conta.", variant: "destructive" });
      return;
    }
    if (!isValidCpf(cpf)) {
      toast({ title: "CPF inválido", description: "Digite um CPF válido para continuar.", variant: "destructive" });
      return;
    }
    if (!agreed) {
      toast({ title: "Aceite os termos", description: "Você precisa concordar com os Termos de Uso.", variant: "destructive" });
      return;
    }
    if (userType === "cooperado" && !cooperativa) {
      toast({ title: "Selecione a cooperativa", description: "Escolha uma cooperativa para continuar.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const cleanCpf = cpf.replace(/\D/g, "");
    const trimmedName = fullName.trim();

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: trimmedName,
          cooperativa: userType === "cooperado" ? cooperativa : null,
          cpf: cleanCpf,
          user_type: userType,
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

    // Atualiza o profile com cooperativa (cooperado) e foto, e ajusta o role se necessário
    if (newUserId) {
      try {
        // Aguarda o trigger handle_new_user criar o profile
        await new Promise((r) => setTimeout(r, 400));

        const updates: { cooperativa?: string; avatar_url?: string; cpf?: string; full_name?: string } = {
          cpf: cleanCpf,
          full_name: trimmedName,
        };
        if (userType === "cooperado" && cooperativa) {
          updates.cooperativa = cooperativa;
        }

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

        if (Object.keys(updates).length > 0) {
          await supabase.from("profiles").update(updates).eq("user_id", newUserId);
        }

        // Aluno cooperado: substituir o role padrão (aluno) por cooperado
        if (userType === "cooperado") {
          await supabase.from("user_roles").delete().eq("user_id", newUserId);
          await supabase.from("user_roles").insert({ user_id: newUserId, role: "cooperado" });
        }
      } catch {
        // Não bloqueia o cadastro
      }
    }

    toast({ title: "Conta criada com sucesso!", description: "Você já pode fazer login." });
    navigate("/login");
    setLoading(false);
  };

  const initials = fullName
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src={logoImg} alt="Coopaiba EAD" className="w-10 h-10 rounded-xl object-contain" />
          <h1 className="font-heading text-xl font-bold text-foreground">Coopaiba EAD</h1>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-elevated border border-border">
          <h2 className="text-2xl font-heading font-bold text-card-foreground text-center">Criar Conta</h2>
          <p className="text-muted-foreground mt-1 mb-6 text-center text-sm">Junte-se à comunidade de aprendizagem cooperativista</p>

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button type="button" onClick={() => setUserType("aluno")}
              className={`p-4 rounded-xl border-2 transition-all text-center ${userType === "aluno" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}`}>
              <User className={`w-6 h-6 mx-auto mb-2 ${userType === "aluno" ? "text-primary" : "text-muted-foreground"}`} />
              <p className={`text-sm font-semibold ${userType === "aluno" ? "text-primary" : "text-card-foreground"}`}>Aluno</p>
              <p className="text-xs text-muted-foreground mt-1">Acesso aos cursos gerais</p>
            </button>
            <button type="button" onClick={() => setUserType("cooperado")}
              className={`p-4 rounded-xl border-2 transition-all text-center ${userType === "cooperado" ? "border-secondary bg-secondary/5" : "border-border hover:border-muted-foreground"}`}>
              <Shield className={`w-6 h-6 mx-auto mb-2 ${userType === "cooperado" ? "text-secondary" : "text-muted-foreground"}`} />
              <p className={`text-sm font-semibold ${userType === "cooperado" ? "text-secondary" : "text-card-foreground"}`}>Cooperado</p>
              <p className="text-xs text-muted-foreground mt-1">Acesso completo + exclusivos</p>
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleRegister}>
            {/* Photo picker */}
            <div className="flex flex-col items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="relative w-20 h-20 rounded-full border-4 border-primary/20 bg-primary/10 flex items-center justify-center overflow-hidden group cursor-pointer"
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

            <div>
              <label className="text-sm font-medium text-card-foreground mb-1.5 block">Nome completo *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-card-foreground mb-1.5 block">CPF *</label>
              <div className="relative">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
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
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-card-foreground mb-1.5 block">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-card-foreground mb-1.5 block">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                  className="w-full pl-10 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="rounded border-border mt-0.5" />
              <span>Concordo com os <a href="#" className="text-primary underline">Termos de Uso</a> e a <a href="#" className="text-primary underline">Política de Privacidade</a> (LGPD)</span>
            </label>

            <button type="submit" disabled={loading}
              className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando conta...</> : <>Criar Conta <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Já tem conta? <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
