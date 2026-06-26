import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Clock, Search, Copy, ShieldCheck } from "lucide-react";
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

type Pending = {
  id: string;
  full_name: string;
  cpf: string;
  email: string | null;
  cooperativa: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const formatCpf = (cpf: string) =>
  cpf.length === 11 ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : cpf;

export default function AdminCooperadosPendentes() {
  const [items, setItems] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const [savingSetting, setSavingSetting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [rejectTarget, setRejectTarget] = useState<Pending | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    const [listRes, settingRes] = await Promise.all([
      supabase
        .from("cooperado_pending_registrations")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("app_settings").select("value").eq("key", "cooperado_auto_approve").maybeSingle(),
    ]);
    if (listRes.error) toast.error(listRes.error.message);
    else setItems((listRes.data ?? []) as Pending[]);
    const v = settingRes.data?.value as { enabled?: boolean } | null;
    setAutoApprove(v?.enabled === true);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("pending-cooperados")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cooperado_pending_registrations" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleAutoApprove = async (next: boolean) => {
    setSavingSetting(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: "cooperado_auto_approve", value: { enabled: next } as never },
        { onConflict: "key" }
      );
    setSavingSetting(false);
    if (error) {
      toast.error("Falha ao salvar: " + error.message);
      return;
    }
    setAutoApprove(next);
    toast.success(next ? "Aprovação automática ativada" : "Aprovação automática desativada");
  };

  const approve = async (item: Pending) => {
    setActionId(item.id);
    const { data, error } = await supabase.functions.invoke("approve-cooperado-registration", {
      body: { registration_id: item.id, action: "approve" },
    });
    setActionId(null);
    if (error) return toast.error(error.message);
    if ((data as { error?: string })?.error) return toast.error((data as { error: string }).error);
    const link = (data as { recovery_link?: string })?.recovery_link;
    const loginEmail = (data as { login_email?: string })?.login_email;
    toast.success("Cooperado aprovado", {
      description: loginEmail ? `Login: ${loginEmail}` : undefined,
      action: link
        ? {
            label: "Copiar link de senha",
            onClick: () => {
              navigator.clipboard.writeText(link);
              toast.success("Link copiado");
            },
          }
        : undefined,
      duration: 15000,
    });
    load();
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setActionId(rejectTarget.id);
    const { data, error } = await supabase.functions.invoke("approve-cooperado-registration", {
      body: {
        registration_id: rejectTarget.id,
        action: "reject",
        rejection_reason: rejectReason || null,
      },
    });
    setActionId(null);
    setRejectTarget(null);
    setRejectReason("");
    if (error) return toast.error(error.message);
    if ((data as { error?: string })?.error) return toast.error((data as { error: string }).error);
    toast.success("Solicitação rejeitada");
    load();
  };

  const filtered = items.filter((i) => {
    if (i.status !== tab) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      i.full_name.toLowerCase().includes(q) ||
      i.cpf.includes(q.replace(/\D/g, "")) ||
      (i.email ?? "").toLowerCase().includes(q) ||
      (i.cooperativa ?? "").toLowerCase().includes(q)
    );
  });

  const counts = {
    pending: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-heading">Autorizar Cooperados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aprove ou rejeite solicitações de cadastro de novos cooperados.
          </p>
        </div>

        <Card className="p-4 md:min-w-[320px]">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-sm">Aprovação automática</p>
                <Switch
                  checked={autoApprove}
                  onCheckedChange={toggleAutoApprove}
                  disabled={savingSetting}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Quando ativada, novas solicitações são aprovadas e o acesso é liberado imediatamente,
                sem revisão manual.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CPF, e-mail ou cooperativa"
          className="pl-9"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-4 h-4" /> Pendentes <Badge variant="secondary">{counts.pending}</Badge>
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle2 className="w-4 h-4" /> Aprovados <Badge variant="secondary">{counts.approved}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="w-4 h-4" /> Rejeitados <Badge variant="secondary">{counts.rejected}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              Nenhuma solicitação {tab === "pending" ? "pendente" : tab === "approved" ? "aprovada" : "rejeitada"}.
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{item.full_name}</p>
                        <Badge variant="outline">{formatCpf(item.cpf)}</Badge>
                        {item.cooperativa && <Badge variant="secondary">{item.cooperativa}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {item.email || "Sem e-mail informado"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Solicitado em {new Date(item.created_at).toLocaleString("pt-BR")}
                        {item.reviewed_at && ` • Revisado em ${new Date(item.reviewed_at).toLocaleString("pt-BR")}`}
                      </p>
                      {item.rejection_reason && (
                        <p className="text-xs text-destructive">Motivo: {item.rejection_reason}</p>
                      )}
                    </div>

                    {item.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => approve(item)}
                          disabled={actionId === item.id}
                        >
                          {actionId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectTarget(item)}
                          disabled={actionId === item.id}
                        >
                          <XCircle className="w-4 h-4" />
                          Rejeitar
                        </Button>
                      </div>
                    )}

                    {item.status === "approved" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `cpf${item.cpf}@cooperado.coopaiba.com.br`
                          );
                          toast.success("E-mail de login copiado");
                        }}
                      >
                        <Copy className="w-4 h-4" /> Copiar login
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              A solicitação de <strong>{rejectTarget?.full_name}</strong> será marcada como rejeitada.
              Você pode informar um motivo (opcional).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Motivo da rejeição (opcional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={reject}>Confirmar rejeição</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
