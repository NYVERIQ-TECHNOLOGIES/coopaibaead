import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { isPaymentsConfigured } from "@/lib/stripe";
import LiveChat from "@/components/live/LiveChat";
import { toast } from "sonner";
import { CalendarClock, Lock, MessageSquare, Radio, ShoppingCart, Users, Video } from "lucide-react";

type LiveItem = {
  id: string;
  title: string;
  description: string | null;
  course_id: string;
  course_title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  provider: string;
  open_minutes_before: number;
  teacher_name: string;
  online_count: number;
  payment_required: boolean;
  price: number | null;
  promotional_price: number | null;
};

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function StatusBadge({ status }: { status: string }) {
  if (status === "ao_vivo") {
    return <Badge className="gap-1 animate-pulse"><Radio className="h-3 w-3" /> AO VIVO</Badge>;
  }
  if (status === "encerrada") return <Badge variant="secondary">Encerrada</Badge>;
  return <Badge variant="outline">Agendada</Badge>;
}

export default function MyLiveClasses() {
  const navigate = useNavigate();
  const [chatOf, setChatOf] = useState<LiveItem | null>(null);
  const [buying, setBuying] = useState<LiveItem | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["my-live-classes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("live_my_classes");
      if (error) throw error;
      return (data ?? []) as LiveItem[];
    },
    refetchInterval: 20000,
  });

  const live = useMemo(() => data.filter((c) => c.status === "ao_vivo"), [data]);
  const upcoming = useMemo(
    () => data.filter((c) => c.status === "agendada" && new Date(c.scheduled_at).getTime() > Date.now() - 3600_000),
    [data],
  );
  const past = useMemo(
    () => data.filter((c) => c.status === "encerrada" || (c.status === "agendada" && new Date(c.scheduled_at).getTime() <= Date.now() - 3600_000)),
    [data],
  );

  async function enter(item: LiveItem) {
    if (item.payment_required) return setBuying(item);
    if (item.provider !== "nativo") {
      // Aula com reunião externa (ex.: Google Meet): valida matrícula e presença
      // pela RPC e abre o link oficial em nova aba.
      const { data, error } = await supabase.rpc("entrar_aula_ao_vivo", { _live_class_id: item.id });
      if (error) return toast.error(error.message);
      const url = (data as { meet_url?: string })?.meet_url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(`/live/${item.id}`);
  }

  function ClassCard({ item }: { item: LiveItem }) {
    const opensAt = new Date(item.scheduled_at).getTime() - (item.open_minutes_before ?? 15) * 60000;
    const canEnter = item.status === "ao_vivo" || Date.now() >= opensAt;
    const finalPrice = item.promotional_price ?? item.price ?? 0;

    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold truncate">{item.title}</h3>
                <StatusBadge status={item.status} />
                {item.payment_required && (
                  <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" /> Pagamento</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {item.course_title} · {item.teacher_name}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {new Date(item.scheduled_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                {" · "}{item.duration_minutes} min
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Users className="h-3.5 w-3.5" /> {item.online_count}
            </div>
          </div>

          {item.payment_required ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
              <div className="text-sm">
                <span className="font-semibold">{fmtBRL(Number(finalPrice))}</span>
                <span className="text-muted-foreground"> · acesso ao curso e às aulas ao vivo</span>
              </div>
              <Button size="sm" disabled={!isPaymentsConfigured()} onClick={() => setBuying(item)}>
                <ShoppingCart className="h-4 w-4 mr-1" /> Pagar e entrar
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => enter(item)} disabled={!canEnter || item.status === "encerrada"}>
                <Video className="h-4 w-4 mr-1" />
                {item.status === "ao_vivo" ? "Assistir agora" : canEnter ? "Entrar na sala" : "Em breve"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setChatOf(item)}>
                <MessageSquare className="h-4 w-4 mr-1" /> Chat
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function Section({ title, items }: { title: string; items: LiveItem[] }) {
    if (items.length === 0) return null;
    return (
      <section className="space-y-3">
        <h2 className="font-heading font-bold text-lg">{title}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((i) => <ClassCard key={i.id} item={i} />)}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Radio className="h-6 w-6 text-primary" /> Minhas aulas ao vivo
        </h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe as transmissões dos seus cursos, veja quem está online e converse no chat.
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : data.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          Você ainda não tem aulas ao vivo disponíveis.
        </CardContent></Card>
      ) : (
        <>
          <Section title="No ar agora" items={live} />
          <Section title="Próximas aulas" items={upcoming} />
          <Section title="Anteriores" items={past} />
        </>
      )}

      <Dialog open={!!chatOf} onOpenChange={(o) => !o && setChatOf(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Chat · {chatOf?.title}</DialogTitle></DialogHeader>
          <div className="h-[60vh]">
            {chatOf && <LiveChat liveClassId={chatOf.id} canModerate={false} />}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!buying} onOpenChange={(o) => !o && setBuying(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Pagar aula: {buying?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[80vh] p-2">
            {buying && (
              <StripeEmbeddedCheckout
                courseId={buying.course_id}
                returnUrl={`${window.location.origin}/live/${buying.id}?session_id={CHECKOUT_SESSION_ID}`}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
