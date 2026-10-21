import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, Copy, ExternalLink, Plus, Search, Video, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { callMeeting, loadMeetingRoles, loadPeople, meetingUrl, statusText, when, type Meeting } from "@/components/meetings/data";

const initial = { title: "", description: "", start: "", end: "", access_type: "restrito", scope: "convite", course_id: "", provider: "nativo", allow_responsible_add_students: false, allow_recording: true, allow_screen_share: true, h24: true, h1: true, startReminder: true };
export default function Meetings() {
  const { user, role } = useAuth();
  const admin = role === "admin";
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [responsibles, setResponsibles] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todas");
  const [dateFilter, setDateFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [participantFilter, setParticipantFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Meeting | null>(null);

  const { data: meetings = [], isLoading } = useQuery({ queryKey: ["meetings"], queryFn: async () => {
    const { data, error } = await supabase.from("meetings").select("*").order("start_at", { ascending: false }).limit(500);
    if (error) throw error; return (data ?? []) as Meeting[];
  }, refetchInterval: 15000 });
  const { data: googleLinks = {} } = useQuery({ queryKey: ["meeting-google-links"], queryFn: async () => {
    // RLS devolve somente as reuniões em que o usuário pode entrar (meeting_can_enter).
    const { data, error } = await db.from("meeting_google_links").select("meeting_id,meet_url");
    if (error) throw error;
    return Object.fromEntries((data ?? []).map(r => [r.meeting_id, r.meet_url])) as Record<string, string>;
  }, refetchInterval: 15000 });
  const { data: people = [] } = useQuery({ queryKey: ["meeting-people"], enabled: admin, queryFn: loadPeople });
  const { data: courses = [] } = useQuery({ queryKey: ["meeting-courses"], enabled: admin, queryFn: async () => {
    const { data } = await supabase.from("courses").select("id,title").order("title").limit(1000); return data ?? [];
  } });
  const { data: allResponsibles = [] } = useQuery({ queryKey: ["meeting-responsibles"], queryFn: async () => {
    const { data } = await supabase.from("meeting_responsibles").select("meeting_id,user_id"); return data ?? [];
  } });
  const { data: allParticipants = [] } = useQuery({ queryKey: ["meeting-participants"], queryFn: async () => {
    const { data } = await supabase.from("meeting_participants").select("meeting_id,user_id,status"); return data ?? [];
  } });
  const { data: roles = [] } = useQuery({ queryKey: ["meeting-roles"], enabled: admin, queryFn: loadMeetingRoles });
  const { data: detailSessions = [] } = useQuery({ queryKey: ["meeting-sessions", detail?.id], enabled: !!detail, queryFn: async () => {
    const { data } = await supabase.from("meeting_sessions").select("*").eq("meeting_id", detail?.id ?? "").order("joined_at", { ascending: false }); return data ?? [];
  }, refetchInterval: 15000 });
  const { data: detailAudit = [] } = useQuery({ queryKey: ["meeting-audit", detail?.id], enabled: !!detail, queryFn: async () => {
    const { data } = await supabase.from("meeting_audit").select("*").eq("meeting_id", detail?.id ?? "").order("created_at", { ascending: false }); return data ?? [];
  } });
  const { data: detailRecordings = [] } = useQuery({ queryKey: ["meeting-recordings", detail?.id], enabled: !!detail, queryFn: async () => {
    const { data } = await supabase.from("meeting_recordings").select("*").eq("meeting_id", detail?.id ?? ""); return data ?? [];
  } });
  const names = useMemo(() => Object.fromEntries(people.map(p => [p.user_id, p.full_name])), [people]);
  const studentIds = useMemo(() => new Set(roles.filter(r => r.role === "aluno" || r.role === "cooperado").map(r => r.user_id)), [roles]);
  const managerIds = useMemo(() => new Set(roles.filter(r => r.role === "admin" || r.role === "moderador" || r.role === "professor").map(r => r.user_id)), [roles]);
  const possibleResponsibles = useMemo(() => people.filter(p => managerIds.has(p.user_id)), [people, managerIds]);
  const filteredPeople = useMemo(() => people.filter(p => studentIds.has(p.user_id) && [p.full_name,p.cpf,p.enrollment_number,p.email].some(v => v?.toLowerCase().includes(search.toLowerCase()))), [people,studentIds,search]);
  const visible = meetings.filter(m => (filter === "todas" || m.status === filter) && (!dateFilter || m.start_at.slice(0,10) === dateFilter) && (!responsibleFilter || allResponsibles.some(r => r.meeting_id === m.id && r.user_id === responsibleFilter)) && (!participantFilter || allParticipants.some(p => p.meeting_id === m.id && p.user_id === participantFilter)));
  const meetUrlOf = (m: Meeting) => (m.provider === "google_meet" ? googleLinks[m.id] ?? null : null);
  const refresh = () => { ["meetings","meeting-google-links","meeting-responsibles","meeting-participants","notifications"].forEach(key => void qc.invalidateQueries({ queryKey: [key] })); };
  const startCreate = () => { setEditing(null); setForm({ ...initial, start: toLocal(new Date().toISOString()) }); setSelected([]); setResponsibles([]); setOpen(true); };
  const isManagerOf = (m: Meeting) => admin || allResponsibles.some(r => r.meeting_id === m.id && r.user_id === user?.id);
  async function enterGoogleMeeting(m: Meeting) {
    const url = meetUrlOf(m);
    if (url) return window.open(url, "_blank", "noopener,noreferrer");
    const { data } = await db.from("meeting_google_links").select("meet_url").eq("meeting_id", m.id).maybeSingle();
    if (data?.meet_url) return window.open(data.meet_url, "_blank", "noopener,noreferrer");
    toast.warning("A sala do Google Meet desta reunião ainda não foi criada pelo responsável.");
  }
  useEffect(() => { if (admin && params.get("nova") === "1") { startCreate(); setParams({}, { replace: true }); } }, [admin, params, setParams]);
  const startEdit = (m: Meeting) => {
    setEditing(m); setForm({ title:m.title, description:m.description ?? "", start:toLocal(m.start_at), end:toLocal(m.end_at), access_type:m.access_type, scope:m.scope, course_id:m.course_id ?? "", provider: "nativo", allow_responsible_add_students:m.allow_responsible_add_students, allow_recording:m.allow_recording, allow_screen_share:m.allow_screen_share, h24: !!(m.reminders as Record<string,boolean>)?.h24, h1: !!(m.reminders as Record<string,boolean>)?.h1, startReminder: !!(m.reminders as Record<string,boolean>)?.start });
    setSelected(allParticipants.filter(p => p.meeting_id === m.id && p.status !== "removido").map(p => p.user_id));
    setResponsibles(allResponsibles.filter(r => r.meeting_id === m.id).map(r => r.user_id)); setOpen(true);
  };
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!user || !form.title.trim() || !form.start || (form.end && new Date(form.end) <= new Date(form.start))) return toast.error("Confira título e horários da reunião.");
    if (!responsibles.length) return toast.error("Escolha ao menos um responsável.");
    setBusy(true);
    try {
      const body = { title: form.title.trim(), description: form.description.trim(), start_at: new Date(form.start).toISOString(), end_at: form.end ? new Date(form.end).toISOString() : new Date(new Date(form.start).getTime() + 60*60000).toISOString(), access_type: form.access_type, scope: form.scope, course_id: form.scope === "curso" ? form.course_id || null : null, provider: "nativo", allow_responsible_add_students: form.allow_responsible_add_students, allow_recording: form.allow_recording, allow_screen_share: form.allow_screen_share, reminders: { h24:form.h24, h1:form.h1, start:form.startReminder }, updated_at: new Date().toISOString() };
      if (form.scope === "curso" && !form.course_id) throw new Error("Selecione o curso.");
      const res = editing ? await db.from("meetings").update(body).eq("id", editing.id).select("id").single() : await db.from("meetings").insert({ ...body, created_by: user.id }).select("id").single();
      if (res.error || !res.data) throw res.error ?? new Error("Não foi possível salvar.");
      const mid = res.data.id;
      const previousR = allResponsibles.filter(r => r.meeting_id === mid).map(r => r.user_id);
      const removeR = previousR.filter(id => !responsibles.includes(id));
      if (removeR.length) { const { error } = await supabase.from("meeting_responsibles").delete().eq("meeting_id",mid).in("user_id",removeR); if (error) throw error; }
      const addR = responsibles.filter(id => !previousR.includes(id));
      if (addR.length) { const { error } = await supabase.from("meeting_responsibles").insert(addR.map(id => ({ meeting_id: mid,user_id:id }))); if (error) throw error; }
      const old = allParticipants.filter(p => p.meeting_id === mid);
      const removed = old.filter(p => p.status !== "removido" && !selected.includes(p.user_id));
      if (removed.length) { const { error } = await supabase.from("meeting_participants").update({ status:"removido" }).eq("meeting_id",mid).in("user_id",removed.map(p => p.user_id)); if (error) throw error; }
      const add = selected.filter(id => !old.some(p => p.user_id === id));
      if (add.length) { const { error } = await supabase.from("meeting_participants").insert(add.map(id => ({ meeting_id:mid,user_id:id,invited_by:user.id }))); if (error) throw error; }
      const restore = selected.filter(id => old.some(p => p.user_id === id && p.status === "removido"));
      if (restore.length) { const { error } = await supabase.from("meeting_participants").update({ status:"convidado" }).eq("meeting_id",mid).in("user_id",restore); if (error) throw error; }
      if (form.provider === "google_meet" && !googleLinks[mid]) {
        const { data: g, error: gerr } = await supabase.functions.invoke("meeting-create-meet", { body: { meetingId: mid } });
        if (gerr || g?.error) toast.warning(g?.code === "google_calendar_api_disabled" || g?.code === "google_permission_denied" ? `A reunião foi salva, mas a sala do Google Meet não foi criada. ${g.error}` : "A reunião foi salva, mas não foi possível criar a sala do Google Meet. Conecte a conta Google e use o botão \"Criar sala no Google Meet\" no cartão da reunião para tentar novamente.", { duration: 12000 });
        else toast.success("Sala do Google Meet criada.");
      } else if (form.provider === "google_meet" && editing) {
        const { data: g } = await supabase.functions.invoke("meeting-create-meet", { body: { meetingId: mid, action: "update" } });
        if (g?.error) toast.warning("Reunião salva, mas não foi possível atualizar o evento no Google Agenda.");
      }
      toast.success(editing ? "Reunião atualizada." : "Reunião criada e convites enviados."); setOpen(false); refresh();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }
  async function act(m: Meeting, action: string) {
    if (!confirm(action === "excluir" ? "Excluir esta reunião e todo o histórico?" : `Deseja ${action} esta reunião?`)) return;
    try {
      if (action === "excluir") {
        if (m.provider === "google_meet") await supabase.functions.invoke("meeting-create-meet", { body: { meetingId: m.id, action: "cancel" } });
        const { error } = await supabase.from("meetings").delete().eq("id",m.id); if (error) throw error;
      }
      else if (action === "regenerar link") { const { error } = await supabase.from("meetings").update({ meeting_token:crypto.randomUUID() }).eq("id",m.id); if (error) throw error; }
      else await callMeeting("meeting_set_state", { _id:m.id,_action:action });
      if (action === "cancelar" && m.provider === "google_meet") {
        const { data: g } = await supabase.functions.invoke("meeting-create-meet", { body: { meetingId: m.id, action: "cancel" } });
        if (g?.warning) toast.warning(g.warning);
      }
      toast.success("Reunião atualizada."); refresh(); setDetail(null);
    } catch (err) { toast.error((err as Error).message); }
  }
  const copy = async (m: Meeting) => {
    const url = meetUrlOf(m);
    if (m.provider === "google_meet") {
      if (!url) return toast.warning("A sala do Google Meet ainda não foi criada. O responsável deve criá-la antes de copiar o link.");
      await navigator.clipboard.writeText(url);
    } else await navigator.clipboard.writeText(meetingUrl(m.meeting_token));
    toast.success("Link copiado.");
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-3 items-center justify-between"><div><h1 className="text-2xl font-bold">{admin ? "Reuniões" : "Minhas reuniões"}</h1><p className="text-sm text-muted-foreground">{admin ? "Agenda e histórico de reuniões" : "Reuniões das quais você participa"}</p></div>{admin && <Button onClick={startCreate}><Plus className="h-4 w-4 mr-2"/>Nova reunião</Button>}</div>
    {admin && <GoogleConnectCard status={googleStatus} loading={googleLoading} onChanged={() => { refreshGoogle(); }} />}
    <div className="flex flex-wrap gap-2 items-center"><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-44" aria-label="Filtrar status"><SelectValue/></SelectTrigger><SelectContent>{["todas","agendada","em_andamento","encerrada","cancelada"].map(s => <SelectItem key={s} value={s}>{statusText[s] ?? "Todas"}</SelectItem>)}</SelectContent></Select><Input className="w-44" type="date" aria-label="Filtrar data" value={dateFilter} onChange={e => setDateFilter(e.target.value)}/>{admin && <><Select value={responsibleFilter || "all"} onValueChange={v => setResponsibleFilter(v === "all" ? "" : v)}><SelectTrigger className="w-48"><SelectValue placeholder="Responsável"/></SelectTrigger><SelectContent><SelectItem value="all">Todos responsáveis</SelectItem>{possibleResponsibles.map(p => <SelectItem value={p.user_id} key={p.user_id}>{p.full_name}</SelectItem>)}</SelectContent></Select><Select value={participantFilter || "all"} onValueChange={v => setParticipantFilter(v === "all" ? "" : v)}><SelectTrigger className="w-48"><SelectValue placeholder="Participante"/></SelectTrigger><SelectContent><SelectItem value="all">Todos participantes</SelectItem>{people.filter(p => studentIds.has(p.user_id)).map(p => <SelectItem value={p.user_id} key={p.user_id}>{p.full_name}</SelectItem>)}</SelectContent></Select></>}</div>
    {isLoading ? <p>Carregando reuniões…</p> : visible.length === 0 ? <div className="py-16 border-t border-border text-center text-muted-foreground">Nenhuma reunião encontrada.</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map(m => <Card key={m.id} className="rounded-lg"><CardContent className="p-5 space-y-3"><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-semibold min-w-0 flex-1 basis-40 break-words">{m.title}</h2><div className="flex flex-wrap gap-1 shrink-0"><Badge variant={m.status === "em_andamento" ? "default" : "secondary"} className="whitespace-nowrap">{statusText[m.status]}</Badge><Badge variant="outline" className="whitespace-nowrap">{m.provider === "google_meet" ? "Google Meet" : "Sem Google Meet"}</Badge></div></div><p className="text-sm text-muted-foreground line-clamp-2">{m.description || "Sem descrição"}</p><div className="text-sm flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary"/>{when(m.start_at)}</div><p className="text-xs text-muted-foreground">Responsável: {allResponsibles.filter(r => r.meeting_id === m.id).map(r => names[r.user_id] ?? "Responsável").join(", ") || "—"}</p><div className="flex flex-wrap gap-2 pt-1">{meetUrlOf(m) ? <Button size="sm" asChild><a href={meetUrlOf(m) as string} target="_blank" rel="noopener noreferrer"><Video className="h-4 w-4 mr-1"/>Entrar na reunião</a></Button> : m.provider === "google_meet" ? (isManagerOf(m) ? <Button size="sm" onClick={() => void createMeetFor(m)}><Video className="h-4 w-4 mr-1"/>Criar sala no Google Meet</Button> : <Button size="sm" variant="outline" onClick={() => void enterGoogleMeeting(m)}><Video className="h-4 w-4 mr-1"/>Entrar na reunião</Button>) : <Button size="sm" asChild><Link to={`/reuniao/${m.meeting_token}`}><Video className="h-4 w-4 mr-1"/>Entrar na reunião</Link></Button>}{(admin || allResponsibles.some(r => r.meeting_id === m.id && r.user_id === user?.id)) && <><Button size="icon" variant="outline" title="Copiar link" aria-label="Copiar link" onClick={() => void copy(m)}><Copy className="h-4 w-4"/></Button><Button size="sm" variant="outline" onClick={() => setDetail(m)}>Detalhes</Button></>}</div>{admin && <div className="flex flex-wrap gap-2 border-t border-border pt-3"><Button size="sm" variant="ghost" onClick={() => startEdit(m)}>Editar</Button>{m.status === "agendada" && <Button size="sm" variant="ghost" onClick={() => void act(m,"cancelar")}>Cancelar</Button>}{m.provider !== "google_meet" && <Button size="icon" variant="ghost" title="Regenerar link" aria-label="Regenerar link" onClick={() => void act(m,"regenerar link")}><RotateCcw className="h-4 w-4"/></Button>}<Button size="icon" variant="ghost" title="Excluir" aria-label="Excluir" onClick={() => void act(m,"excluir")}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>}</CardContent></Card>)}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Editar reunião" : "Nova reunião"}</DialogTitle></DialogHeader><form onSubmit={e => void save(e)} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2 space-y-1"><Label htmlFor="mtitle">Título</Label><Input id="mtitle" required value={form.title} onChange={e => setForm({...form,title:e.target.value})}/></div><div className="sm:col-span-2 space-y-1"><Label htmlFor="mdesc">Descrição</Label><Textarea id="mdesc" value={form.description} onChange={e => setForm({...form,description:e.target.value})}/></div><div className="space-y-1"><Label htmlFor="mstart">Início <span className="text-xs text-muted-foreground font-normal">(preenchido com a hora atual)</span></Label><Input id="mstart" type="datetime-local" required value={form.start} onChange={e => setForm({...form,start:e.target.value})}/></div><div className="space-y-1"><Label htmlFor="mend">Término previsto <span className="text-xs text-muted-foreground font-normal">(opcional — padrão 1h)</span></Label><Input id="mend" type="datetime-local" value={form.end} onChange={e => setForm({...form,end:e.target.value})}/></div></div>
    <div className="space-y-2"><Label>Responsáveis</Label><div className="max-h-32 overflow-auto border border-border rounded-md p-2 space-y-1">{possibleResponsibles.map(p => <label key={p.user_id} className="flex items-center gap-2 text-sm p-1"><Checkbox checked={responsibles.includes(p.user_id)} onCheckedChange={v => setResponsibles(v ? [...responsibles,p.user_id] : responsibles.filter(id => id !== p.user_id))}/>{p.full_name}</label>)}</div></div>
    <div className="grid sm:grid-cols-2 gap-4"><div className="space-y-1"><Label>Método de realização</Label><Select value={form.provider} onValueChange={v => setForm({...form,provider:v})}><SelectTrigger aria-label="Método de realização"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="google_meet">Google Meet (padrão)</SelectItem><SelectItem value="nativo">Outra forma — sem Google Meet (opcional)</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">{form.provider === "google_meet" ? (googleStatus?.connected ? `Google Meet integrado${googleStatus.email ? ` (${googleStatus.email})` : ""}. A sala será criada automaticamente ao salvar.` : "Google Meet é o método padrão e obrigatório do fluxo principal. Conecte sua conta Google (card acima) para que a sala possa ser criada.") : "A reunião será realizada fora do Google Meet, na sala da plataforma, sem link do Meet."}</p></div><div className="space-y-1"><Label>Política do link</Label><Select value={form.access_type} onValueChange={v => setForm({...form,access_type:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="restrito">Restrito a convidados</SelectItem><SelectItem value="aprovacao">Solicitar aprovação</SelectItem><SelectItem value="aberto">Aberto a usuários cadastrados</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label>Tipo de reunião</Label><Select value={form.scope} onValueChange={v => setForm({...form,scope:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="convite">Por convite</SelectItem><SelectItem value="curso">Restrita a curso</SelectItem><SelectItem value="link">Por link</SelectItem></SelectContent></Select></div>{form.scope === "curso" && <div className="sm:col-span-2"><Label>Curso</Label><Select value={form.course_id} onValueChange={v => setForm({...form,course_id:v})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent></Select></div>}</div>
    <div className="grid sm:grid-cols-2 gap-2">{[["allow_responsible_add_students","Responsável pode adicionar alunos"],["allow_recording","Permitir gravação"],["allow_screen_share","Permitir compartilhar tela"],["h24","Lembrete 24 horas antes"],["h1","Lembrete 1 hora antes"],["startReminder","Avisar no início"]].map(([key,label]) => <label key={key} className="flex gap-2 items-center text-sm"><Checkbox checked={!!form[key as keyof typeof form]} onCheckedChange={v => setForm({...form,[key]:!!v})}/>{label}</label>)}</div>
    <div className="space-y-2"><div className="flex flex-wrap justify-between gap-2"><Label>Participantes ({selected.length})</Label><div className="flex gap-2"><Button type="button" variant="link" size="sm" onClick={() => setSelected([...new Set([...selected,...filteredPeople.map(p => p.user_id)])])}>Selecionar todos exibidos</Button><Button type="button" variant="link" size="sm" onClick={() => setSelected([])}>Remover todos</Button></div></div><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" placeholder="Nome, CPF ou matrícula" value={search} onChange={e => setSearch(e.target.value)}/></div><div className="max-h-48 overflow-y-auto border border-border rounded-md p-2">{filteredPeople.map(p => <label key={p.user_id} className="flex items-center gap-2 p-2 text-sm hover:bg-muted/50"><Checkbox checked={selected.includes(p.user_id)} onCheckedChange={v => setSelected(v ? [...selected,p.user_id] : selected.filter(id => id !== p.user_id))}/><span className="truncate">{p.full_name} · {p.enrollment_number ?? p.cpf ?? ""}</span></label>)}{filteredPeople.length === 0 && <p className="text-sm text-muted-foreground p-3">Nenhum aluno encontrado.</p>}</div></div><div className="flex justify-end"><Button disabled={busy} type="submit">{busy ? "Salvando…" : "Salvar reunião"}</Button></div></form></DialogContent></Dialog>
    <Dialog open={!!detail} onOpenChange={v => !v && setDetail(null)}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader>{detail && <div className="space-y-5 text-sm"><p>{detail.description}</p><p>Início: {when(detail.start_at)} · Término: {when(detail.end_at)}</p><p>Responsáveis: {allResponsibles.filter(r => r.meeting_id === detail.id).map(r => names[r.user_id]).join(", ")}</p><p>Participantes: {allParticipants.filter(p => p.meeting_id === detail.id && p.status !== "removido").map(p => names[p.user_id]).join(", ") || "Nenhum"}</p><p>Método de realização: {detail.provider === "google_meet" ? (meetUrlOf(detail) ? "Google Meet" : (detail.status === "encerrada" || detail.status === "cancelada" ? "Google Meet (link restrito após o encerramento)" : "Google Meet (sala ainda não criada)")) : "Outra forma — sem Google Meet (sala da plataforma)"}</p><div className="flex gap-2"><Button onClick={() => void copy(detail)} variant="outline"><Copy className="h-4 w-4 mr-2"/>Copiar link</Button>{meetUrlOf(detail) ? <Button asChild variant="outline"><a href={meetUrlOf(detail) as string} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2"/>Abrir no Google Meet</a></Button> : detail.provider === "google_meet" ? (isManagerOf(detail) ? <Button variant="outline" onClick={() => void createMeetFor(detail)}><ExternalLink className="h-4 w-4 mr-2"/>Criar sala do Google Meet</Button> : null) : <Button asChild variant="outline"><Link to={`/reuniao/${detail.meeting_token}`}><ExternalLink className="h-4 w-4 mr-2"/>Abrir sala</Link></Button>}</div><section><h3 className="font-semibold mb-2">Presença</h3>{detailSessions.length ? detailSessions.map(s => <p key={s.id} className="py-1 border-b border-border">{names[s.user_id] ?? s.user_id} · {when(s.joined_at)} · {s.left_at ? when(s.left_at) : "Online"} · {Math.round(s.duration_seconds / 60)} min</p>) : <p className="text-muted-foreground">Sem presença registrada.</p>}</section><section><h3 className="font-semibold mb-2">Gravações</h3>{detailRecordings.length ? detailRecordings.map(r => <p key={r.id}>{r.file_name} · {r.storage_type === "local" ? "Salva no computador do responsável (não disponível aqui)" : "Armazenamento externo"}</p>) : <p className="text-muted-foreground">Sem gravações registradas.</p>}</section><section><h3 className="font-semibold mb-2">Histórico de alterações</h3>{detailAudit.map(a => <p key={a.id} className="py-1 border-b border-border">{when(a.created_at)} · {a.action} · {names[a.actor_id ?? ""] ?? "Sistema"}</p>)}</section></div>}</DialogContent></Dialog>
  </div>;
}
function toLocal(iso: string) { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16); }
