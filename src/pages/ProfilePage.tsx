import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  User, Camera, Save, Loader2, Shield, GraduationCap, Award,
  Mail, IdCard, Phone, CalendarDays, KeyRound, CheckCircle2, Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

type ProfileRow = {
  enrollment_number: string | null;
  phone: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type EnrollmentRow = {
  id: string;
  course_id: string;
  progress: number;
  status: string;
  enrolled_at: string;
  courses: { title: string; duration: string | null } | null;
};

type CertificateRow = {
  id: string;
  code: string;
  course_id: string | null;
  status: string;
  delivery_mode: string;
  issued_at: string | null;
  course_title_snapshot: string | null;
};

const maskCpf = (cpf?: string | null) => {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
};

const certStatusLabel = (s: string) =>
  ({
    pendente: "Solicitado",
    emitido: "Emitido",
    disponivel_retirada: "Pronto para retirada",
    retirado: "Retirado",
    cancelado: "Cancelado",
    erro: "Erro na emissão",
  } as Record<string, string>)[s] || s;

const certStatusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" =>
  s === "cancelado" || s === "erro" ? "destructive" : s === "pendente" ? "outline" : "secondary";

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

export default function ProfilePage() {
  const { profile, user, role } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [cooperativa, setCooperativa] = useState(profile?.cooperativa || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [phone, setPhone] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [bio, setBio] = useState("");
  const [areaAtuacao, setAreaAtuacao] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const isProfessor = role === "professor";
  const [row, setRow] = useState<ProfileRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Security
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);

  // Progress
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("enrollment_number, phone, cpf, data_nascimento, is_active, created_at, bio, area_atuacao, especialidade")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setRow(data as ProfileRow);
      setPhone(data.phone || "");
      setNascimento(data.data_nascimento || "");
      setBio((data as any).bio || "");
      setAreaAtuacao((data as any).area_atuacao || "");
      setEspecialidade((data as any).especialidade || "");
    }
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const loadProgress = useCallback(async () => {
    if (!user) return;
    setLoadingProgress(true);
    const [{ data: enr }, { data: certs }] = await Promise.all([
      supabase
        .from("enrollments")
        .select("id, course_id, progress, status, enrolled_at, courses(title, duration)")
        .eq("user_id", user.id)
        .order("enrolled_at", { ascending: false }),
      supabase
        .from("certificates")
        .select("id, code, status, delivery_mode, issued_at, course_id, course_title_snapshot")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    const rows = (enr as any[]) || [];
    const courseIds = rows.map((r) => r.course_id).filter(Boolean);
    let computed: Record<string, number> = {};

    if (courseIds.length) {
      const [{ data: modules }, { data: completions }] = await Promise.all([
        supabase
          .from("course_modules")
          .select("id, course_id, course_lessons(id)")
          .in("course_id", courseIds),
        supabase.from("lesson_completions").select("lesson_id").eq("user_id", user.id),
      ]);
      const doneSet = new Set(((completions as any[]) || []).map((c) => c.lesson_id));
      const perCourse: Record<string, { total: number; done: number }> = {};
      ((modules as any[]) || []).forEach((m) => {
        const acc = (perCourse[m.course_id] ||= { total: 0, done: 0 });
        (m.course_lessons || []).forEach((l: any) => {
          acc.total += 1;
          if (doneSet.has(l.id)) acc.done += 1;
        });
      });
      computed = Object.fromEntries(
        Object.entries(perCourse).map(([cid, v]) => [
          cid,
          v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
        ])
      );
    }

    const certByCourse = new Set(((certs as any[]) || []).map((c) => c.course_id).filter(Boolean));

    setEnrollments(
      rows.map((r) => {
        const auto = computed[r.course_id] ?? 0;
        const concluded = r.status === "concluido" || certByCourse.has(r.course_id);
        return {
          ...r,
          progress: concluded ? 100 : Math.max(r.progress ?? 0, auto),
        } as EnrollmentRow;
      })
    );
    setCertificates(((certs as any[]) || []) as CertificateRow[]);
    setLoadingProgress(false);
  }, [user]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);


  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(publicUrl);
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
      toast({ title: "Foto atualizada!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar foto", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast({ title: "Informe seu nome completo", variant: "destructive" });
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
      toast({ title: "Telefone inválido", description: "Informe DDD + número.", variant: "destructive" });
      return;
    }
    if (!row?.data_nascimento && nascimento && new Date(nascimento) > new Date()) {
      toast({ title: "Data de nascimento inválida", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      full_name: fullName.trim(),
      cooperativa: cooperativa.trim() || null,
      phone: phoneDigits || null,
    };
    if (isProfessor) {
      payload.bio = bio.trim() || null;
      payload.area_atuacao = areaAtuacao.trim() || null;
      payload.especialidade = especialidade.trim() || null;
    }
    if (!row?.data_nascimento && nascimento) payload.data_nascimento = nascimento;
    const { error } = await supabase.from("profiles").update(payload as any).eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado com sucesso!" });
      loadProfile();
    }
  };

  const changePassword = async () => {
    if (!user?.email) return;
    if (!currentPassword) {
      toast({ title: "Informe sua senha atual", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "A senha deve ter ao menos 8 caracteres", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast({ title: "A senha deve conter letras e números", variant: "destructive" });
      return;
    }
    if (newPassword === currentPassword) {
      toast({ title: "A nova senha deve ser diferente da atual", variant: "destructive" });
      return;
    }
    setChanging(true);
    // Reautenticação: confirma a senha atual antes de permitir a troca
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (reauthError) {
      setChanging(false);
      toast({ title: "Senha atual incorreta", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChanging(false);
    if (error) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } else {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Senha alterada com sucesso!" });
    }
  };

  const concluidos = enrollments.filter((e) => e.progress >= 100 || e.status === "concluido").length;
  const roleLabel: Record<string, string> = {
    admin: "Administrador", moderador: "Moderador", cooperado: "Cooperado", aluno: "Aluno",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            <Avatar className="w-24 h-24 border-4 border-primary/20">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName} /> : null}
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploading
                ? <Loader2 className="w-6 h-6 text-primary-foreground animate-spin" />
                : <Camera className="w-6 h-6 text-primary-foreground" />}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
            <h1 className="text-2xl font-heading font-bold text-foreground truncate">
              {fullName || "Meu Perfil"}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-2 truncate">
              <Mail className="w-4 h-4 shrink-0" /> {user?.email}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              {role && <Badge variant="secondary">{roleLabel[role] || role}</Badge>}
              {row?.enrollment_number && (
                <Badge variant="outline" className="font-mono">{row.enrollment_number}</Badge>
              )}
              {row?.is_active === false && <Badge variant="destructive">Inativo</Badge>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
            <div className="rounded-xl border border-border bg-background/60 px-4 py-3 text-center">
              <p className="text-xl font-bold text-foreground">{enrollments.length}</p>
              <p className="text-xs text-muted-foreground">Cursos</p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 px-4 py-3 text-center">
              <p className="text-xl font-bold text-foreground">{certificates.length}</p>
              <p className="text-xs text-muted-foreground">Certificados</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="dados">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dados" className="gap-2"><User className="w-4 h-4" /> Dados pessoais</TabsTrigger>
          <TabsTrigger value="seguranca" className="gap-2"><Shield className="w-4 h-4" /> Segurança</TabsTrigger>
          <TabsTrigger value="progresso" className="gap-2"><GraduationCap className="w-4 h-4" /> Meu progresso</TabsTrigger>
        </TabsList>

        {/* Dados pessoais */}
        <TabsContent value="dados" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="flex items-center gap-2"><IdCard className="w-4 h-4" /> Número de matrícula</Label>
                <Input value={row?.enrollment_number || "—"} disabled className="opacity-60 font-mono" />
              </div>
              <div>
                <Label>Nome completo</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
              </div>
              <div>
                <Label className="flex items-center gap-2"><Mail className="w-4 h-4" /> E-mail de acesso</Label>
                <Input value={user?.email || ""} disabled className="opacity-60" />
              </div>
              <div>
                <Label>CPF</Label>
                <Input value={maskCpf(row?.cpf)} disabled className="opacity-60 font-mono" />
                <p className="text-xs text-muted-foreground mt-1">
                  O CPF não pode ser alterado. Fale com a secretaria em caso de erro.
                </p>
              </div>
              <div>
                <Label className="flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Data de nascimento</Label>
                {row?.data_nascimento ? (
                  <Input value={fmtDate(row.data_nascimento)} disabled className="opacity-60" />
                ) : (
                  <Input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
                )}
              </div>
              <div>
                <Label className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Cooperativa</Label>
                <Input
                  value={cooperativa}
                  onChange={(e) => setCooperativa(e.target.value)}
                  placeholder="Nome da cooperativa"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2"><Phone className="w-4 h-4" /> WhatsApp / Celular</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(75) 99999-9999"
                  type="tel"
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Usado para notificar quando seu certificado estiver disponível para retirada.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-muted-foreground">
                Membro desde {fmtDate(row?.created_at)}
              </p>
              <Button onClick={saveProfile} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Segurança */}
        <TabsContent value="seguranca" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-6 max-w-xl">
            <div>
              <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" /> Alterar senha
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Confirme sua senha atual e use ao menos 8 caracteres, com letras e números.
              </p>
            </div>
            <div className="grid gap-4">
              <div>
                <Label>Senha atual</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label>Confirmar nova senha</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button onClick={changePassword} disabled={changing} className="gap-2 w-fit">
                {changing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {changing ? "Alterando..." : "Alterar senha"}
              </Button>
            </div>

            <div className="border-t border-border pt-4 space-y-1 text-sm">
              <p className="text-muted-foreground">E-mail de acesso</p>
              <p className="font-medium text-foreground break-all">{user?.email}</p>
              <p className="text-xs text-muted-foreground">
                Para alterar o e-mail de acesso, solicite à secretaria.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Progresso */}
        <TabsContent value="progresso" className="mt-4 space-y-6">
          {loadingProgress ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-primary" /> Meus cursos
                  </h2>
                  <Badge variant="secondary">{concluidos} concluído(s)</Badge>
                </div>
                {enrollments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Você ainda não está matriculado em nenhum curso.</p>
                ) : (
                  <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                    {enrollments.map((e) => (
                      <div key={e.id} className="space-y-2 rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {e.courses?.title || "Curso"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Matrícula em {fmtDate(e.enrolled_at)}
                              {e.courses?.duration ? ` · ${e.courses.duration}` : ""}
                            </p>
                          </div>
                          {e.progress >= 100 ? (
                            <Badge className="gap-1 shrink-0">
                              <CheckCircle2 className="w-3 h-3" /> Concluído
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0">{e.progress}%</Badge>
                          )}
                        </div>
                        <Progress value={e.progress} className="h-2" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" /> Meus certificados
                </h2>
                {certificates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum certificado solicitado até o momento.</p>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {certificates.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-border p-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {c.course_title_snapshot || "Curso"}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">{c.code}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.issued_at ? `Emitido em ${fmtDate(c.issued_at)}` : "Aguardando emissão"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant={certStatusVariant(c.status)}>{certStatusLabel(c.status)}</Badge>
                          <Badge variant={c.delivery_mode === "download" ? "default" : "outline"}>
                            {c.delivery_mode === "download" ? "Download liberado" : "Retirada na cooperativa"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
