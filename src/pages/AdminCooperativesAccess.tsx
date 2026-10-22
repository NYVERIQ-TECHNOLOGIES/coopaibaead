import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, KeyRound, Search, Copy, Download, Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const roleLabels = { aluno: "Aluno", cooperado: "Cooperado", professor: "Professor", moderador: "Moderador", admin: "Administrador" };
type Role = keyof typeof roleLabels;
type Coop = { id: string; name: string; active: boolean };
type Delivery = { name: string; identifier: string; link: string };

function CooperativeRow({ coop, onSave }: { coop: Coop; onSave: (id: string, name: string, active: boolean) => Promise<void> }) {
  const [name, setName] = useState(coop.name);
  const [busy, setBusy] = useState(false);
  const save = async (active: boolean) => { setBusy(true); try { await onSave(coop.id, name, active); } finally { setBusy(false); } };
  return <div className="flex flex-wrap items-center gap-3 border-b border-border py-3">
    <Input aria-label={`Nome de ${coop.name}`} value={name} maxLength={120} onChange={e => setName(e.target.value)} className="min-w-0 flex-1 basis-44" />
    <Switch aria-label={`Ativar ${coop.name}`} checked={coop.active} disabled={busy} onCheckedChange={save} />
    <Button variant="ghost" size="icon" aria-label={`Salvar ${coop.name}`} title="Salvar nome" disabled={busy || name.trim() === coop.name} onClick={() => save(coop.active)}><Save className="h-4 w-4" /></Button>
  </div>;
}

export default function AdminCooperativesAccess() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newCoop, setNewCoop] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [coopFilter, setCoopFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState<{ user_id: string; name: string; role: Role } | null>(null);
  const [accessTarget, setAccessTarget] = useState<{ user_id: string; name: string } | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [recipient, setRecipient] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [rolesDraft, setRolesDraft] = useState<Record<string, Role>>({});
  const cooperatives = useQuery({ queryKey: ["admin-cooperatives"], queryFn: async () => {
    const { data, error } = await supabase.from("cooperativas").select("id, name, active").order("name");
    if (error) throw error; return data;
  } });
  const accounts = useQuery({ queryKey: ["admin-access-accounts"], queryFn: async () => {
    const profiles = [];
    const roles = [];
    for (let start = 0; ; start += 500) {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, cooperativa, cpf, cnpj, nire, is_active").order("user_id").range(start, start + 499);
      if (error) throw error; profiles.push(...(data ?? [])); if ((data?.length ?? 0) < 500) break;
    }
    for (let start = 0; ; start += 500) {
      const { data, error } = await supabase.from("user_roles").select("user_id, role").order("user_id").range(start, start + 499);
      if (error) throw error; roles.push(...(data ?? [])); if ((data?.length ?? 0) < 500) break;
    }
    return profiles.map(p => ({ ...p, roles: roles.filter(r => r.user_id === p.user_id).map(r => r.role) }));
  } });
  const fail = (error: unknown) => toast({ title: "Não foi possível concluir", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
  const saveCoop = async (id: string | null, name: string, active: boolean) => {
    if (name.trim().length < 2) { fail(new Error("Informe o nome da cooperativa.")); return; }
    if ((cooperatives.data ?? []).some(c => c.id !== id && c.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())) { fail(new Error("Essa cooperativa já existe.")); return; }
    const result = id ? await supabase.from("cooperativas").update({ name: name.trim(), active }).eq("id", id) : await supabase.from("cooperativas").insert({ name: name.trim(), active });
    if (result.error) { fail(new Error("Não foi possível salvar a cooperativa.")); return; }
    if (!id) setNewCoop("");
    await qc.invalidateQueries({ queryKey: ["admin-cooperatives"] });
    toast({ title: "Cooperativa salva" });
  };
  const changeRole = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user-role", { body: { user_id: pending.user_id, new_role: pending.role } });
      if (error || data?.error) throw new Error(data?.error || "Você não tem permissão para alterar esse papel.");
      await qc.invalidateQueries({ queryKey: ["admin-access-accounts"] });
      setRolesDraft({}); setPending(null); toast({ title: "Papel atualizado" });
    } catch (error) { fail(error); } finally { setBusy(false); }
  };
  const generateAccess = async () => {
    if (!accessTarget) return;
    setWorkingId(accessTarget.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-access-link", { body: { user_id: accessTarget.user_id } });
      if (error || data?.error || !data?.link) throw new Error(data?.error || "Não foi possível gerar o acesso para essa conta.");
      setDelivery(data); setRecipient(accessTarget.name.includes("COOPERAGRE") ? "ge3067700@gmail.com" : ""); setAccessTarget(null);
    } catch (error) { fail(error); } finally { setWorkingId(null); }
  };
  const message = delivery ? `COOPAIBA EAD\n${recipient ? `Destinatário: ${recipient}\n` : ""}Conta: ${delivery.name}\nLogin: ${delivery.identifier}\nDefina sua senha pelo link de uso único:\n${delivery.link}\nDepois, entre em https://coopaibaead.app/login com seu login e a senha escolhida. Não encaminhe este acesso a terceiros.` : "";
  const filtered = (accounts.data ?? []).filter(a => {
    const q = search.trim().toLocaleLowerCase();
    return (!q || `${a.full_name} ${a.cpf ?? ""} ${a.cnpj ?? ""} ${a.cooperativa ?? ""}`.toLocaleLowerCase().includes(q)) && (coopFilter === "all" || a.cooperativa === coopFilter) && (roleFilter === "all" || a.roles.includes(roleFilter as Role));
  });
  const coopNames = [...new Set((accounts.data ?? []).map(a => a.cooperativa).filter((name): name is string => Boolean(name)))].sort();
  return <div className="space-y-8">
    <section className="space-y-4">
      <h2 className="text-xl font-heading font-semibold flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Cooperativas</h2>
      <form className="flex gap-2 max-w-xl" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await saveCoop(null, newCoop, true); } finally { setBusy(false); } }}>
        <Input aria-label="Nova cooperativa" placeholder="Nome da cooperativa" value={newCoop} maxLength={120} onChange={e => setNewCoop(e.target.value)} required />
        <Button type="submit" disabled={busy || !newCoop.trim()}>Adicionar</Button>
      </form>
      {cooperatives.isLoading ? <p className="text-muted-foreground">Carregando cooperativas…</p> : cooperatives.isError ? <Button variant="outline" onClick={() => cooperatives.refetch()}>Tentar novamente</Button> : <div className="max-h-72 overflow-y-auto max-w-3xl">{(cooperatives.data ?? []).map(c => <CooperativeRow key={`${c.id}-${c.name}`} coop={c} onSave={saveCoop} />)}{!cooperatives.data?.length && <p className="text-muted-foreground">Nenhuma cooperativa cadastrada.</p>}</div>}
    </section>
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-heading font-semibold flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Contas, papéis e acessos</h2><Button variant="ghost" size="icon" aria-label="Atualizar contas" title="Atualizar contas" onClick={() => accounts.refetch()}><RefreshCw className="h-4 w-4" /></Button></div>
      <div className="grid gap-3 sm:grid-cols-3"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar contas" placeholder="Nome, CPF, CNPJ ou cooperativa" className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div>
        <Select value={coopFilter} onValueChange={v => { setCoopFilter(v); setPage(0); }}><SelectTrigger aria-label="Filtrar cooperativa"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as cooperativas</SelectItem>{coopNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select>
        <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(0); }}><SelectTrigger aria-label="Filtrar papel"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os papéis</SelectItem>{Object.entries(roleLabels).map(([r, n]) => <SelectItem key={r} value={r}>{n}</SelectItem>)}</SelectContent></Select>
      </div>
      {accounts.isLoading ? <p className="text-muted-foreground">Carregando contas…</p> : accounts.isError ? <Button variant="outline" onClick={() => accounts.refetch()}>Tentar novamente</Button> : <>
        <div className="divide-y divide-border">{filtered.slice(page * 15, (page + 1) * 15).map(a => <div key={a.user_id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_240px_auto] lg:items-center">
          <div className="min-w-0"><h3 className="font-semibold break-words">{a.full_name || "Sem nome"}</h3><p className="text-sm text-muted-foreground break-words">{a.cooperativa || "Sem cooperativa"}{a.cnpj ? ` · CNPJ ${a.cnpj} · NIRE ${a.nire || "—"}` : a.cpf ? ` · CPF ${a.cpf}` : ""}</p><div className="flex flex-wrap gap-1 mt-1">{a.roles.map(r => <Badge key={r} variant="outline">{roleLabels[r]}</Badge>)}{a.is_active === false && <Badge variant="secondary">Inativa</Badge>}</div></div>
          <div className="flex gap-2"><Select value={rolesDraft[a.user_id] || a.roles[0] || "aluno"} onValueChange={v => setRolesDraft(d => ({ ...d, [a.user_id]: v as Role }))}><SelectTrigger aria-label={`Papel de ${a.full_name}`}><SelectValue /></SelectTrigger><SelectContent>{Object.entries(roleLabels).map(([r, n]) => <SelectItem key={r} value={r}>{n}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" aria-label={`Salvar papel de ${a.full_name}`} title="Salvar papel" disabled={!rolesDraft[a.user_id]} onClick={() => setPending({ user_id: a.user_id, name: a.full_name || "Conta", role: rolesDraft[a.user_id] })}><Save className="h-4 w-4" /></Button></div>
          <Button variant="outline" disabled={workingId !== null || a.is_active === false} onClick={() => setAccessTarget({ user_id: a.user_id, name: a.full_name || "Conta" })}><KeyRound className="h-4 w-4 mr-2" /> Gerar acesso</Button>
        </div>)}</div>
        {!filtered.length && <p className="py-6 text-muted-foreground">Nenhuma conta encontrada.</p>}
        <div className="flex flex-wrap justify-between gap-3 items-center"><span className="text-sm text-muted-foreground">{filtered.length} contas · Página {page + 1} de {Math.max(1, Math.ceil(filtered.length / 15))}</span><div className="flex gap-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button><Button variant="outline" disabled={(page + 1) * 15 >= filtered.length} onClick={() => setPage(p => p + 1)}>Próxima</Button></div></div>
      </>}
    </section>
    <AlertDialog open={Boolean(pending)} onOpenChange={open => { if (!open && !busy) setPending(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Alterar papel?</AlertDialogTitle><AlertDialogDescription>{pending?.name} passará a ser {pending ? roleLabels[pending.role] : ""}. As permissões anteriores serão substituídas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><Button onClick={changeRole} disabled={busy}>{busy ? "Salvando…" : "Confirmar"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(accessTarget)} onOpenChange={open => { if (!open && !workingId) setAccessTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Gerar acesso para {accessTarget?.name}?</AlertDialogTitle><AlertDialogDescription>Será criado um link de uso único para definir uma senha. Links de recuperação anteriores deixarão de funcionar. Nenhum e-mail será enviado automaticamente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={Boolean(workingId)}>Cancelar</AlertDialogCancel><Button onClick={generateAccess} disabled={Boolean(workingId)}>{workingId ? "Gerando…" : "Gerar link"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={Boolean(delivery)} onOpenChange={open => { if (!open) { setDelivery(null); setRecipient(""); } }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Acesso de {delivery?.name}</DialogTitle><DialogDescription>Link de uso único e validade limitada. Compartilhe somente com o responsável. Não foi enviado por e-mail.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="access-recipient">Destinatário (opcional)</Label><Input id="access-recipient" value={recipient} onChange={e => setRecipient(e.target.value)} /><Textarea aria-label="Mensagem de acesso" readOnly value={message} rows={9} className="break-all" /></div><div className="flex flex-wrap gap-2"><Button onClick={async () => { try { await navigator.clipboard.writeText(message); toast({ title: "Acesso copiado" }); } catch { fail(new Error("Não foi possível copiar. Selecione a mensagem e copie manualmente.")); } }}><Copy className="h-4 w-4 mr-2" /> Copiar acesso</Button><Button variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([message], { type: "text/plain;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "acesso-coopaiba.txt"; a.click(); URL.revokeObjectURL(url); }}><Download className="h-4 w-4 mr-2" /> Baixar acesso</Button></div></DialogContent></Dialog>
  </div>;
}