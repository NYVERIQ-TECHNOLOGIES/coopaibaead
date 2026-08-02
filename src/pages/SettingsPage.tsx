import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Settings, User, Lock, Bell, Palette, Globe, Save, Eye, EyeOff, ShieldCheck, IdCard, Trash2, AlertTriangle, CreditCard, Sun, Moon, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import TwoFactorSetup from "@/components/TwoFactorSetup";
import SubscriptionStatusCard from "@/components/SubscriptionStatusCard";

// IMPORTANT: Section is defined OUTSIDE the SettingsPage component to prevent
// React from unmounting/remounting it on every parent re-render, which was
// causing inputs to lose focus on every keystroke.
const Section = ({
  title,
  desc,
  icon: Icon,
  children,
}: {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border bg-card p-6 space-y-5">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
    {children}
  </div>
);

// CPF mask: 000.000.000-00
const formatCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

// CPF validation (check digits)
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

export default function SettingsPage() {
  const { profile, user, role } = useAuth();
  const { theme, setTheme } = useTheme();
  const isAdmin = role === "admin";
  const navigate = useNavigate();
  const { toast } = useToast();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [cooperativa, setCooperativa] = useState(profile?.cooperativa || "");
  const [cpf, setCpf] = useState("");
  const [cpfLocked, setCpfLocked] = useState(false);
  const [confirmCpfOpen, setConfirmCpfOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const [notifEmail, setNotifEmail] = useState(true);
  const [notifCourse, setNotifCourse] = useState(true);
  const [notifCert, setNotifCert] = useState(true);

  const [welcomeVideoUrl, setWelcomeVideoUrl] = useState("");
  const [savingWelcome, setSavingWelcome] = useState(false);
  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("app_settings").select("value").eq("key", "dashboard_welcome_video").maybeSingle()
      .then(({ data }) => {
        const v = (data?.value as any)?.url || "";
        setWelcomeVideoUrl(v);
      });
  }, [isAdmin]);
  const saveWelcomeVideo = async () => {
    setSavingWelcome(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: "dashboard_welcome_video",
      value: { url: welcomeVideoUrl.trim() } as any,
      updated_by: user?.id,
    });
    setSavingWelcome(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Vídeo de boas-vindas atualizado" });
    }
  };
  // ---- Cooperativas (admin) ----
  const [coops, setCoops] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [newCoop, setNewCoop] = useState("");
  const [savingCoop, setSavingCoop] = useState(false);

  const loadCoops = useCallback(async () => {
    const { data } = await supabase.from("cooperativas").select("id, name, active").order("name");
    setCoops(data || []);
  }, []);

  useEffect(() => {
    if (isAdmin) loadCoops();
  }, [isAdmin, loadCoops]);

  const addCoop = async () => {
    const name = newCoop.trim();
    if (name.length < 2) {
      toast({ title: "Nome inválido", description: "Informe o nome da cooperativa.", variant: "destructive" });
      return;
    }
    if (name.length > 120) {
      toast({ title: "Nome muito longo", description: "Máximo de 120 caracteres.", variant: "destructive" });
      return;
    }
    if (coops.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Já cadastrada", description: "Essa cooperativa já existe.", variant: "destructive" });
      return;
    }
    setSavingCoop(true);
    const { error } = await supabase.from("cooperativas").insert({ name, active: true });
    setSavingCoop(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setNewCoop("");
    toast({ title: "Cooperativa cadastrada", description: "Já aparece na página de cadastro." });
    loadCoops();
  };

  const toggleCoop = async (id: string, active: boolean) => {
    const { error } = await supabase.from("cooperativas").update({ active }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setCoops((cs) => cs.map((c) => (c.id === id ? { ...c, active } : c)));
  };

  const removeCoop = async (id: string) => {
    const { error } = await supabase.from("cooperativas").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setCoops((cs) => cs.filter((c) => c.id !== id));
    toast({ title: "Cooperativa removida" });
  };

  const resetWelcomeSeen = () => {
    try { localStorage.removeItem("intro_seen_dashboard_v1"); } catch {}
    toast({ title: "Pronto", description: "O vídeo será exibido novamente no próximo acesso ao dashboard." });
  };

  // Load existing CPF from DB and lock the field if already set
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("cpf")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.cpf) {
          setCpf(formatCpf(data.cpf));
          setCpfLocked(true);
        }
      });
  }, [user]);

  // Stable handlers — prevent unnecessary re-renders that could affect focus
  const onFullNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFullName(e.target.value);
  }, []);
  const onCooperativaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCooperativa(e.target.value);
  }, []);
  const onCpfChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCpf(e.target.value));
  }, []);

  const saveProfile = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    // If CPF is filled and not yet locked → require confirmation first
    if (!cpfLocked && cpf.replace(/\D/g, "").length > 0) {
      if (!isValidCpf(cpf)) {
        toast({ title: "Digite um CPF válido.", variant: "destructive" });
        return;
      }
      setConfirmCpfOpen(true);
      return;
    }
    await persistProfile(false);
  };

  const persistProfile = async (includeCpf: boolean) => {
    if (!user) return;
    setSaving(true);
    const payload: { full_name: string; cooperativa: string; cpf?: string } = {
      full_name: fullName.trim(),
      cooperativa: cooperativa.trim(),
    };
    if (includeCpf) payload.cpf = cpf.replace(/\D/g, "");

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("user_id", user.id);
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    if (includeCpf) {
      setCpfLocked(true);
      toast({ title: "CPF salvo com sucesso." });
    } else {
      toast({ title: "Perfil atualizado com sucesso!" });
    }
  };

  const confirmAndSaveCpf = async () => {
    setConfirmCpfOpen(false);
    await persistProfile(true);
  };

  const changePassword = async () => {
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPw(false);
    if (error) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada com sucesso!" });
      setNewPassword("");
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-own-account");
      if (error || (data && (data as { error?: string }).error)) {
        const msg = error?.message || (data as { error?: string })?.error || "Erro ao excluir conta";
        toast({ title: "Erro", description: msg, variant: "destructive" });
        setDeleting(false);
        return;
      }
      toast({ title: "Conta excluída", description: "Sua conta foi removida permanentemente." });
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
      setDeleting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Settings className="w-7 h-7 text-primary" /> Configurações
        </h1>
        <p className="text-muted-foreground mt-1">Gerencie seu perfil e preferências da plataforma</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile" className="gap-2"><User className="w-4 h-4" /> Perfil</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Lock className="w-4 h-4" /> Segurança</TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2"><CreditCard className="w-4 h-4" /> Assinatura</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="w-4 h-4" /> Notificações</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2"><Palette className="w-4 h-4" /> Aparência</TabsTrigger>
          <TabsTrigger value="platform" className="gap-2"><Globe className="w-4 h-4" /> Plataforma</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Section title="Informações Pessoais" desc="Atualize seus dados de perfil" icon={User}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={onFullNameChange}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={user?.email || ""} disabled className="opacity-60" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cooperativa">Cooperativa</Label>
                <Input
                  id="cooperativa"
                  name="cooperativa"
                  type="text"
                  autoComplete="organization"
                  value={cooperativa}
                  onChange={onCooperativaChange}
                  placeholder="Nome da cooperativa"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpf" className="flex items-center gap-1.5">
                  <IdCard className="w-4 h-4" /> CPF
                </Label>
                <Input
                  id="cpf"
                  name="cpf"
                  type="text"
                  inputMode="numeric"
                  value={cpf}
                  onChange={onCpfChange}
                  disabled={cpfLocked}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className={cpfLocked ? "opacity-60 font-mono" : "font-mono"}
                />
                <p className="text-xs text-muted-foreground">
                  {cpfLocked
                    ? "Este CPF já foi confirmado e não pode mais ser editado."
                    : "Atenção: após confirmar, o CPF não poderá ser alterado."}
                </p>
              </div>
            </div>
            <Button onClick={saveProfile} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </Section>
        </TabsContent>

        <TabsContent value="security">
          <Section title="Alterar Senha" desc="Atualize sua senha de acesso" icon={Lock}>
            <div className="grid gap-4 max-w-md">
              <div className="relative space-y-1.5">
                <Label htmlFor="newPassword">Nova senha</Label>
                <Input
                  id="newPassword"
                  type={showPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-8 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <p className="text-xs text-muted-foreground mt-1">
                  Mínimo 8 caracteres. Senhas vazadas em violações conhecidas serão rejeitadas.
                </p>
              </div>
            </div>
            <Button onClick={changePassword} disabled={changingPw || newPassword.length < 8} className="gap-2">
              <Lock className="w-4 h-4" /> {changingPw ? "Alterando..." : "Alterar Senha"}
            </Button>
          </Section>

          <div className="mt-6">
            <Section title="Autenticação de 2 fatores" desc="Adicione uma camada extra de proteção à sua conta" icon={ShieldCheck}>
              <TwoFactorSetup />
            </Section>
          </div>

          <div className="mt-6">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Excluir Conta</h3>
                  <p className="text-sm text-muted-foreground">
                    Remove permanentemente sua conta e todos os dados associados. Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={() => { setConfirmText(""); setDeleteOpen(true); }}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" /> Excluir minha conta
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-4">
          <Section title="Plano atual" desc="Veja o status, gerencie cobrança ou faça upgrade" icon={CreditCard}>
            <SubscriptionStatusCard />
          </Section>
        </TabsContent>

        <TabsContent value="notifications">
          <Section title="Preferências de Notificação" desc="Configure como deseja receber notificações" icon={Bell}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Notificações por e-mail</p>
                  <p className="text-sm text-muted-foreground">Receber atualizações gerais por e-mail</p>
                </div>
                <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Novos cursos</p>
                  <p className="text-sm text-muted-foreground">Ser notificado quando novos cursos forem publicados</p>
                </div>
                <Switch checked={notifCourse} onCheckedChange={setNotifCourse} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Certificados</p>
                  <p className="text-sm text-muted-foreground">Notificar quando certificados estiverem disponíveis</p>
                </div>
                <Switch checked={notifCert} onCheckedChange={setNotifCert} />
              </div>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="appearance">
          <Section title="Tema da interface" desc="Escolha entre claro, escuro ou seguir o sistema" icon={Palette}>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { value: "light", label: "Claro", icon: Sun, hint: "Interface clara e elegante" },
                { value: "dark", label: "Escuro", icon: Moon, hint: "Grafite profundo, alto contraste" },
                { value: "system", label: "Automático", icon: Monitor, hint: "Segue o sistema operacional" },
              ].map(({ value, label, icon: Icon, hint }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    aria-pressed={active}
                    className={`rounded-lg border p-4 text-left transition-all hover-lift ${
                      active ? "border-primary bg-primary/5 shadow-glow" : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="font-heading font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
                  </button>
                );
              })}
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="platform">
          <Section title="Informações da Plataforma" desc="Detalhes sobre a Coopaiba EAD" icon={Globe}>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Plataforma</span>
                <span className="font-medium text-foreground">Coopaiba EAD</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Versão</span>
                <span className="font-medium text-foreground">1.0.0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Tipo de conta</span>
                <span className="font-medium text-foreground">Administrador</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Status</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Ativo
                </span>
              </div>
            </div>
          </Section>

          {isAdmin && (
            <Section title="Vídeo de boas-vindas (Dashboard)" desc="Exibido em modal na primeira vez que o usuário acessa o dashboard" icon={Globe}>
              <div className="space-y-3">
                <div>
                  <Label>URL do vídeo</Label>
                  <Input
                    value={welcomeVideoUrl}
                    onChange={(e) => setWelcomeVideoUrl(e.target.value)}
                    placeholder="YouTube, Vimeo ou link direto .mp4"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Deixe em branco para desativar o vídeo de boas-vindas.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveWelcomeVideo} disabled={savingWelcome} className="gap-2">
                    <Save className="w-4 h-4" /> {savingWelcome ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button variant="outline" onClick={resetWelcomeSeen}>
                    Exibir novamente para mim
                  </Button>
                </div>
              </div>
            </Section>
          )}

          {isAdmin && (
            <Section title="Cooperativas" desc="Cadastre as cooperativas exibidas no formulário de cadastro" icon={Globe}>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={newCoop}
                    onChange={(e) => setNewCoop(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCoop(); } }}
                    placeholder="Nome da nova cooperativa"
                    maxLength={120}
                  />
                  <Button onClick={addCoop} disabled={savingCoop} className="gap-2 sm:w-auto w-full">
                    <Save className="w-4 h-4" /> {savingCoop ? "Salvando..." : "Cadastrar"}
                  </Button>
                </div>

                <div className="rounded-2xl border border-border divide-y divide-border max-h-72 overflow-y-auto">
                  {coops.length === 0 && (
                    <p className="text-sm text-muted-foreground p-4">Nenhuma cooperativa cadastrada.</p>
                  )}
                  {coops.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3">
                      <span className="flex-1 text-sm text-foreground truncate">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={c.active}
                          onCheckedChange={(v) => toggleCoop(c.id, v)}
                          aria-label={`Ativar ${c.name}`}
                        />
                        <span className="text-xs text-muted-foreground w-14">{c.active ? "Ativa" : "Inativa"}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCoop(c.id)}
                          aria-label={`Remover ${c.name}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Apenas cooperativas ativas aparecem na página de cadastro.
                </p>
              </div>
            </Section>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmCpfOpen} onOpenChange={setConfirmCpfOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja continuar?</AlertDialogTitle>
            <AlertDialogDescription>
              Após confirmar este CPF, ele não poderá ser editado novamente. Verifique se o número está correto: <strong className="text-foreground">{cpf}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndSaveCpf}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setConfirmText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Excluir conta permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação <strong className="text-foreground">não pode ser desfeita</strong>. Sua conta, perfil e dados de acesso serão removidos permanentemente.
              <br /><br />
              Para confirmar, digite <strong className="text-foreground">EXCLUIR</strong> abaixo:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="EXCLUIR"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting || confirmText !== "EXCLUIR"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir conta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
