import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { BookOpen, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { SignaturePad, SignaturePadHandle } from "@/components/SignaturePad";
import { isValidCPF, maskCPF, onlyDigits } from "@/lib/cpf";
import logoImg from "@/assets/logo-coopaiba.png";
import { Progress } from "@/components/ui/progress";


const isIframe = () => typeof window !== "undefined" && window.self !== window.top;

const REDIRECT_DELAY_MS = 3000;

type Tipo = "digitada" | "checkin";

export default function PresencaAssinar() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [evento, setEvento] = useState<any>(null);
  const [cursos, setCursos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ horario: string } | null>(null);
  const [redirecting, setRedirecting] = useState<{ nome: string; progress: number } | null>(null);
  const [tipo, setTipo] = useState<Tipo>("digitada");
  const [form, setForm] = useState({ nome: "", cpf: "", assinaturaTexto: "" });
  const sigRef = useRef<SignaturePadHandle>(null);

  const storageKey = `presenca:${codigo}`;

  const goToCourses = (list: any[]) => {
    if (!list || list.length === 0) return false;
    // Se embutido em iframe, abre na janela principal
    const target = list.length === 1 ? `/courses/${list[0].id}` : `/courses`;
    if (isIframe()) {
      window.top?.location.assign(target);
    } else {
      navigate(target);
    }
    return true;
  };

  useEffect(() => {
    (async () => {
      try { await supabase.rpc("encerrar_eventos_vencidos" as any); } catch {}
      const [{ data: ev }, { data: cs }] = await Promise.all([
        supabase.rpc("get_evento_publico", { _codigo: codigo! }),
        supabase.rpc("get_evento_cursos_publico" as any, { _codigo: codigo! }),
      ]);
      const eventoData = Array.isArray(ev) ? ev[0] : ev;
      const cursosData = (cs as any[]) ?? [];
      setEvento(eventoData ?? null);
      setCursos(cursosData);

      // Se já registrou presença neste dispositivo, vai direto pro curso
      if (eventoData && typeof window !== "undefined" && localStorage.getItem(storageKey)) {
        if (goToCourses(cursosData)) return;
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);


  /* Envia altura do documento para o parent quando embutido em iframe */
  useEffect(() => {
    if (!isIframe()) return;
    document.documentElement.classList.add("in-iframe");
    const send = () => {
      window.parent.postMessage({ type: "presenca-resize", height: document.documentElement.scrollHeight }, "*");
    };
    send();
    const ro = new ResizeObserver(send);
    ro.observe(document.documentElement);
    return () => {
      ro.disconnect();
      document.documentElement.classList.remove("in-iframe");
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evento) return;
    if (!form.nome.trim() || form.nome.trim().length < 2) {
      return toast({ title: "Informe seu nome completo", variant: "destructive" });
    }
    if (!form.cpf || !isValidCPF(form.cpf)) {
      return toast({ title: "CPF inválido", variant: "destructive" });
    }


    let assinaturaBase64: string | null = null;
    let assinaturaTexto: string | null = null;
    setSubmitting(true);

    try {
      if (tipo === "digitada") {
        if (!form.assinaturaTexto.trim()) {
          setSubmitting(false);
          return toast({ title: "Digite sua assinatura", variant: "destructive" });
        }
        assinaturaTexto = form.assinaturaTexto.trim();
      }

      const { data, error } = await supabase.functions.invoke("registrar-presenca", {
        body: {
          codigo: evento.codigo,
          nome: form.nome.trim(),
          cpf: onlyDigits(form.cpf),
          matricula: null,
          tipo,
          assinaturaBase64,
          assinaturaTexto,
        },
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      try { localStorage.setItem(storageKey, String(Date.now())); } catch {}
      // Redireciona automaticamente para o(s) curso(s) vinculado(s)
      if (goToCourses(cursos)) return;
      setDone({ horario: result.horario });
    } catch (err: any) {
      toast({ title: "Erro ao registrar", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <h1 className="text-xl font-heading font-bold text-foreground">Evento não encontrado</h1>
          <p className="text-muted-foreground mt-2">Verifique o código ou QR Code.</p>
        </div>
      </div>
    );
  }

  if (evento.status !== "aberto") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-heading font-bold text-foreground">{evento.nome}</h1>
          <p className="text-muted-foreground mt-2">Este evento foi encerrado e não está mais aceitando assinaturas.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-elevated">
          <CheckCircle2 className="w-16 h-16 mx-auto text-success mb-4" />
          <h1 className="text-2xl font-heading font-bold text-card-foreground">Presença registrada!</h1>
          <p className="text-muted-foreground mt-2">{evento.nome}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Horário: {new Date(done.horario).toLocaleString("pt-BR")}
          </p>
          {cursos.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-card-foreground">Acesse os cursos deste evento:</p>
              {cursos.map((c) => (
                <Button
                  key={c.id}
                  className="w-full justify-start"
                  onClick={() => {
                    const url = `/courses/${c.id}`;
                    if (isIframe()) window.top?.location.assign(url);
                    else navigate(url);
                  }}
                >
                  <BookOpen className="w-4 h-4 mr-2" /> {c.title}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <img src={logoImg} alt="Coopaiba" className="w-10 h-10 rounded-lg" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Coopaiba Dia de Campo</p>
            <h1 className="font-heading font-bold text-foreground">{evento.nome}</h1>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 mb-4 text-sm space-y-1">
          <p className="text-muted-foreground capitalize"><strong className="text-card-foreground">Tipo:</strong> {evento.tipo}</p>
          <p className="text-muted-foreground"><strong className="text-card-foreground">Data:</strong> {new Date(evento.data).toLocaleDateString("pt-BR")} {evento.horario ? `· ${evento.horario.slice(0,5)}` : ""}</p>
          {evento.local && <p className="text-muted-foreground"><strong className="text-card-foreground">Local:</strong> {evento.local}</p>}
          {evento.responsavel && <p className="text-muted-foreground"><strong className="text-card-foreground">Responsável:</strong> {evento.responsavel}</p>}
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <Label>Nome completo *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required className="h-12 text-base" />
          </div>
          <div>
            <Label>CPF *</Label>
            <Input
              inputMode="numeric"
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
              placeholder="000.000.000-00"
              required
              className="h-12 text-base"
            />
          </div>

          <div>
            <Label>Forma de assinatura</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(["digitada","checkin"] as Tipo[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`py-2 px-2 rounded-lg border text-sm capitalize transition-colors ${tipo === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground"}`}
                >
                  {t === "checkin" ? "Check-in" : t}
                </button>
              ))}
            </div>
          </div>


          {tipo === "digitada" && (
            <div>
              <Label>Digite seu nome como assinatura</Label>
              <Input
                value={form.assinaturaTexto}
                onChange={(e) => setForm({ ...form, assinaturaTexto: e.target.value })}
                className="h-14 font-heading text-xl italic"
                placeholder="Sua assinatura"
              />
            </div>
          )}
          {tipo === "checkin" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 text-sm text-foreground">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              Confirmação simples de presença, sem assinatura gráfica.
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Ao confirmar, você autoriza o registro dos dados acima conforme a LGPD para fins de controle de presença.
          </p>

          <Button type="submit" disabled={submitting} className="w-full h-12 text-base">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Presença"}
          </Button>
        </form>
      </div>
    </div>
  );
}
