import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Copy, ExternalLink, Loader2, MapPin, QrCode } from "lucide-react";

interface Props {
  course: { id: string; title: string } | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function LinkRow({ label, url, hint }: { label: string; url: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <div className="mt-2 flex items-center gap-2">
        <Input readOnly value={url} className="h-9 text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button
          size="sm"
          variant="outline"
          onClick={() => { navigator.clipboard.writeText(url); toast({ title: "Link copiado!" }); }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
        </Button>
      </div>
    </div>
  );
}

export default function DiaDeCampoDialog({ course, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [showQR, setShowQR] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    data: new Date().toISOString().slice(0, 10),
    local: "",
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const directUrl = course ? `${origin}/curso/${course.id}/entrar` : "";

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["dia-de-campo-eventos", course?.id],
    enabled: !!course?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presenca_evento_cursos" as any)
        .select("evento_id, presenca_eventos:evento_id(id, codigo, nome, data, local, status, tipo)")
        .eq("curso_id", course!.id);
      if (error) throw error;
      return ((data as any[]) || [])
        .map((r) => r.presenca_eventos)
        .filter(Boolean)
        .sort((a: any, b: any) => (a.data < b.data ? 1 : -1));
    },
  });

  const criar = async () => {
    if (!course) return;
    setCreating(true);
    const nome = form.nome.trim() || `Dia de Campo — ${course.title}`;
    const { data, error } = await supabase
      .from("presenca_eventos")
      .insert({
        nome,
        tipo: "dia_de_campo",
        data: form.data,
        local: form.local || null,
        course_id: course.id,
        created_by: user?.id,
      } as any)
      .select()
      .single();

    if (error) {
      setCreating(false);
      toast({ title: "Erro ao criar evento", description: error.message, variant: "destructive" });
      return;
    }

    const { error: linkErr } = await supabase
      .from("presenca_evento_cursos" as any)
      .insert({ evento_id: data.id, curso_id: course.id });
    setCreating(false);
    if (linkErr) {
      toast({ title: "Evento criado, mas falhou ao vincular o curso", description: linkErr.message, variant: "destructive" });
    } else {
      toast({ title: "Dia de Campo criado", description: `Código: ${data.codigo}` });
    }
    setForm((f) => ({ ...f, nome: "", local: "" }));
    qc.invalidateQueries({ queryKey: ["dia-de-campo-eventos", course.id] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Dia de Campo — {course?.title}</DialogTitle>
          <DialogDescription>
            Gere o link de presença do evento e o link de acesso direto ao curso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <LinkRow
            label="Link de acesso direto ao curso"
            hint="Quem abrir e estiver logado é matriculado automaticamente neste curso."
            url={directUrl}
          />

          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-semibold text-foreground">Novo evento de Dia de Campo</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Nome do evento</Label>
                <Input
                  placeholder={course ? `Dia de Campo — ${course.title}` : ""}
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Local</Label>
                <Input value={form.local} onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))} />
              </div>
            </div>
            <Button className="mt-3 w-full sm:w-auto" onClick={criar} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
              Criar evento e gerar link
            </Button>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Eventos vinculados a este curso</p>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : eventos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento vinculado ainda.</p>
            ) : (
              eventos.map((e: any) => {
                const url = `${origin}/p/${e.codigo}`;
                return (
                  <div key={e.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{e.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(`${e.data}T12:00:00`).toLocaleDateString("pt-BR")} · {e.codigo} · {e.status}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowQR(showQR === e.id ? null : e.id)}>
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/presenca/${e.id}`} onClick={() => onOpenChange(false)}>Abrir</Link>
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <LinkRow label="Link de presença (público)" url={url} />
                    </div>
                    {showQR === e.id && (
                      <div className="mt-3 flex justify-center rounded-xl bg-white p-4">
                        <QRCodeCanvas value={url} size={160} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
