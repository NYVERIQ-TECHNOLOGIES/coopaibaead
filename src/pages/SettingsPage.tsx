import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, User, Lock, Bell, Palette, Globe, Save, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { profile, user } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [cooperativa, setCooperativa] = useState(profile?.cooperativa || "");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const [notifEmail, setNotifEmail] = useState(true);
  const [notifCourse, setNotifCourse] = useState(true);
  const [notifCert, setNotifCert] = useState(true);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, cooperativa })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado com sucesso!" });
    }
  };

  const changePassword = async () => {
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPw(false);
    if (error) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada com sucesso!" });
      setCurrentPassword("");
      setNewPassword("");
    }
  };

  const Section = ({ title, desc, icon: Icon, children }: { title: string; desc: string; icon: typeof User; children: React.ReactNode }) => (
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

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Settings className="w-7 h-7 text-primary" /> Configurações
        </h1>
        <p className="text-muted-foreground mt-1">Gerencie seu perfil e preferências da plataforma</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2"><User className="w-4 h-4" /> Perfil</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Lock className="w-4 h-4" /> Segurança</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="w-4 h-4" /> Notificações</TabsTrigger>
          <TabsTrigger value="platform" className="gap-2"><Globe className="w-4 h-4" /> Plataforma</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Section title="Informações Pessoais" desc="Atualize seus dados de perfil" icon={User}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nome completo</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={user?.email || ""} disabled className="opacity-60" />
              </div>
              <div>
                <Label>Cooperativa</Label>
                <Input value={cooperativa} onChange={(e) => setCooperativa(e.target.value)} placeholder="Nome da cooperativa" />
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
              <div className="relative">
                <Label>Nova senha</Label>
                <Input
                  type={showPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-8 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button onClick={changePassword} disabled={changingPw || newPassword.length < 6} className="gap-2">
              <Lock className="w-4 h-4" /> {changingPw ? "Alterando..." : "Alterar Senha"}
            </Button>
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
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
