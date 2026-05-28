import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { maskPhone } from "@/lib/estados-br";
import { maskCPF, isValidCPF, onlyDigits } from "@/lib/cpf";
import { Sparkles, CheckCircle2, ArrowLeft } from "lucide-react";

export default function CooperadosEventuaisDetalhe() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const [camp, setCamp] = useState<any>(null);
  const [cursos, setCursos] = useState<any[]>([]);
  const [minhaInscricao, setMinhaInscricao] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [protocoloGerado, setProtocoloGerado] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome: "", cpf: "", telefone: "", endereco: "", termo: false,
  });

  const load = async () => {
    if (!id) return;
    const { data: c } = await supabase.from("cooperados_eventuais_campanhas").select("*").eq("id", id).maybeSingle();
    setCamp(c);
    const { data: vinc } = await supabase
      .from("cooperados_eventuais_cursos")
      .select("curso_id, courses:curso_id (id, title, description, image, duration)")
      .eq("campanha_id", id);
    setCursos((vinc as any)?.map((v: any) => v.courses).filter(Boolean) || []);
    if (user) {
      const { data: insc } = await supabase
        .from("cooperados_eventuais_inscricoes").select("*")
        .eq("campanha_id", id).eq("usuario_id", user.id).maybeSingle();
      setMinhaInscricao(insc);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!id) return;
    const ch = supabase
      .channel(`camp-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cooperados_eventuais_campanhas", filter: `id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "cooperados_eventuais_inscricoes", filter: `campanha_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [id, user?.id]);

  useEffect(() => {
    if (profile && !form.nome) {
      setForm((f) => ({ ...f, nome: profile.full_name || "", cpf: (profile as any).cpf ? maskCPF((profile as any).cpf) : "" }));
    }
    if (user?.email && !form.email) setForm((f) => ({ ...f, email: user.email || "" }));
    // eslint-disable-next-line
  }, [profile, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.termo) return toast.error("Confirme o termo de participação");
    if (!isValidCPF(form.cpf)) return toast.error("CPF inválido");
    if (form.nome.trim().length < 2) return toast.error("Informe seu nome completo");
    if (!form.rg.trim()) return toast.error("Informe o RG");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return toast.error("E-mail inválido");
    if (onlyDigits(form.telefone).length < 10) return toast.error("Telefone inválido");
    if (!form.cidade.trim()) return toast.error("Informe a cidade");
    if (!form.estado) return toast.error("Selecione o estado");

    setSubmitting(true);
    const { data, error } = await supabase.rpc("inscrever_cooperado_eventual", {
      _campanha_id: id!,
      _nome: form.nome,
      _cpf: onlyDigits(form.cpf),
      _rg: form.rg,
      _email: form.email,
      _telefone: form.telefone,
      _cidade: form.cidade,
      _estado: form.estado,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Erro ao realizar inscrição");
      return;
    }
    const resp = data as any;
    setProtocoloGerado(resp?.protocolo || null);
    toast.success("Inscrição realizada com sucesso!");
    load();
  };

  if (loading) return <div className="container mx-auto p-8">Carregando…</div>;
  if (!camp) return <div className="container mx-auto p-8">Campanha não encontrada.</div>;

  const pct = Math.min(100, Math.round((camp.vagas_ocupadas / camp.limite_vagas) * 100));
  const disponiveis = Math.max(0, camp.limite_vagas - camp.vagas_ocupadas);
  const expirada = new Date(camp.data_fim + "T23:59:59") < new Date();
  const encerrada = camp.status !== "ativa" || disponiveis === 0 || expirada;
  const jaInscrito = !!minhaInscricao && minhaInscricao.status !== "cancelada";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button asChild variant="ghost" className="mb-4">
        <Link to="/cooperados-eventuais"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Link>
      </Button>

      <div className="rounded-2xl gradient-primary p-8 text-primary-foreground shadow-glow mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-7 h-7" />
          <h1 className="font-heading text-2xl font-bold">{camp.nome}</h1>
        </div>
        {camp.descricao && <p className="text-primary-foreground/90">{camp.descricao}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-6 text-center">
          <div className="text-3xl font-bold text-primary">{camp.limite_vagas}</div>
          <div className="text-sm text-muted-foreground">Total de Vagas</div>
        </CardContent></Card>
        <Card><CardContent className="p-6 text-center">
          <div className="text-3xl font-bold text-primary">{camp.vagas_ocupadas}</div>
          <div className="text-sm text-muted-foreground">Inscrições Realizadas</div>
        </CardContent></Card>
        <Card><CardContent className="p-6 text-center">
          <div className="text-3xl font-bold text-primary">{disponiveis}</div>
          <div className="text-sm text-muted-foreground">Vagas Disponíveis</div>
        </CardContent></Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold">{pct}% preenchido</span>
            <span className="text-muted-foreground">{camp.vagas_ocupadas} de {camp.limite_vagas} vagas ocupadas</span>
          </div>
          <Progress value={pct} className="h-3" />
        </CardContent>
      </Card>

      {jaInscrito || protocoloGerado ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="w-6 h-6" />
              Inscrição confirmada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Você já está inscrito nesta campanha e tem acesso aos cursos disponíveis.</p>
            <div className="rounded-lg bg-muted p-4">
              <div className="text-xs text-muted-foreground">Protocolo</div>
              <div className="font-mono text-lg font-bold">{protocoloGerado || minhaInscricao?.protocolo}</div>
              {minhaInscricao && (
                <div className="text-xs text-muted-foreground mt-2">
                  Status: <Badge variant="secondary">{minhaInscricao.status}</Badge>
                </div>
              )}
            </div>

            {cursos.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Cursos Disponíveis</h3>
                <div className="grid gap-3">
                  {cursos.map((cu) => (
                    <Card key={cu.id}>
                      <CardContent className="p-4 flex gap-4 items-center">
                        {cu.image && <img src={cu.image} alt="" className="w-16 h-16 object-cover rounded-lg" />}
                        <div className="flex-1">
                          <div className="font-semibold">{cu.title}</div>
                          {cu.duration && <div className="text-xs text-muted-foreground">{cu.duration}</div>}
                        </div>
                        <Button asChild size="sm">
                          <Link to={`/courses/${cu.id}`}>Iniciar Curso</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : encerrada ? (
        <Card><CardContent className="py-10 text-center">
          <h2 className="font-heading text-xl font-bold mb-2">Inscrições Encerradas</h2>
          <p className="text-muted-foreground">
            {disponiveis === 0
              ? `${camp.limite_vagas} de ${camp.limite_vagas} vagas preenchidas`
              : "Prazo de inscrição encerrado."}
          </p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Formulário de Inscrição</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Nome Completo *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} required placeholder="000.000.000-00" />
              </div>
              <div>
                <Label>RG *</Label>
                <Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} required />
              </div>
              <div>
                <Label>E-mail *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <Label>Telefone / WhatsApp *</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })} required placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label>Cidade *</Label>
                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} required />
              </div>
              <div>
                <Label>Estado *</Label>
                <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BR.map((e) => <SelectItem key={e.uf} value={e.uf}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex items-start gap-2 pt-2">
                <Checkbox id="termo" checked={form.termo} onCheckedChange={(v) => setForm({ ...form, termo: !!v })} />
                <Label htmlFor="termo" className="text-sm leading-snug cursor-pointer">
                  Declaro que as informações fornecidas são verdadeiras e concordo com os termos do
                  Programa de Cooperados Eventuais.
                </Label>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? "Enviando…" : "REALIZAR INSCRIÇÃO"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
