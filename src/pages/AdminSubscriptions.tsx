import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CreditCard, Users, Building2, DollarSign, TrendingUp, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/components/StatCard";
import AdminPlans from "@/pages/AdminPlans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Sub = {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: string;
  environment: string;
  current_period_end: string | null;
  started_at: string | null;
  created_at: string;
  cancel_at_period_end: boolean;
};

type Purchase = {
  id: string;
  user_id: string;
  course_id: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  environment: string;
};

type Plan = { id: string; name: string; price: number; interval: string };
type Profile = { user_id: string; full_name: string; cooperativa: string | null };
type Course = { id: string; title: string };

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "active" || s === "trialing" || s === "paid") return "default";
  if (s === "canceled" || s === "unpaid") return "destructive";
  if (s === "past_due") return "secondary";
  return "outline";
};

export default function AdminSubscriptions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "subscriptions";
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [courses, setCourses] = useState<Record<string, Course>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && t !== tab) setTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [subsRes, purchRes, plansRes] = await Promise.all([
        supabase.from("user_subscriptions").select("*").order("created_at", { ascending: false }),
        supabase.from("purchases").select("*").order("created_at", { ascending: false }),
        supabase.from("subscription_plans").select("id, name, price, interval"),
      ]);
      const subsData = (subsRes.data ?? []) as Sub[];
      const purchData = (purchRes.data ?? []) as Purchase[];
      setSubs(subsData);
      setPurchases(purchData);
      setPlans((plansRes.data ?? []) as Plan[]);

      const userIds = Array.from(new Set([
        ...subsData.map((s) => s.user_id),
        ...purchData.map((p) => p.user_id),
      ]));
      const courseIds = Array.from(new Set(purchData.map((p) => p.course_id).filter(Boolean)));

      const [profRes, courseRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("user_id, full_name, cooperativa").in("user_id", userIds)
          : Promise.resolve({ data: [] as Profile[] }),
        courseIds.length
          ? supabase.from("courses").select("id, title").in("id", courseIds)
          : Promise.resolve({ data: [] as Course[] }),
      ]);
      const pMap: Record<string, Profile> = {};
      (profRes.data as Profile[] | null)?.forEach((p) => { pMap[p.user_id] = p; });
      setProfiles(pMap);
      const cMap: Record<string, Course> = {};
      (courseRes.data as Course[] | null)?.forEach((c) => { cMap[c.id] = c; });
      setCourses(cMap);
      setLoading(false);
    })();
  }, []);

  const planMap = useMemo(() => {
    const m: Record<string, Plan> = {};
    plans.forEach((p) => { m[p.id] = p; });
    return m;
  }, [plans]);

  const stats = useMemo(() => {
    const activeSubs = subs.filter((s) => ["active", "trialing"].includes(s.status));
    const mrr = activeSubs.reduce((sum, s) => {
      const plan = s.plan_id ? planMap[s.plan_id] : null;
      if (!plan) return sum;
      const price = Number(plan.price) || 0;
      return sum + (plan.interval === "year" ? price / 12 : price);
    }, 0);
    const paidPurchases = purchases.filter((p) => p.status === "paid");
    const grossPurchases = paidPurchases.reduce((s, p) => s + Number(p.amount || 0), 0);
    const uniqueSubscribers = new Set(activeSubs.map((s) => s.user_id)).size;
    const uniqueCoops = new Set(
      activeSubs
        .map((s) => profiles[s.user_id]?.cooperativa)
        .filter((c): c is string => !!c && c.trim().length > 0)
    ).size;
    return {
      mrr, grossPurchases, uniqueSubscribers, uniqueCoops,
      totalActive: activeSubs.length,
      totalCanceled: subs.filter((s) => s.status === "canceled").length,
    };
  }, [subs, purchases, planMap, profiles]);

  const coopBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; users: Set<string> }>();
    subs
      .filter((s) => ["active", "trialing"].includes(s.status))
      .forEach((s) => {
        const coop = profiles[s.user_id]?.cooperativa?.trim() || "Sem cooperativa";
        const entry = map.get(coop) ?? { count: 0, users: new Set() };
        entry.count += 1;
        entry.users.add(s.user_id);
        map.set(coop, entry);
      });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, subscriptions: v.count, students: v.users.size }))
      .sort((a, b) => b.subscriptions - a.subscriptions);
  }, [subs, profiles]);

  const filteredSubs = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return subs;
    return subs.filter((s) => {
      const p = profiles[s.user_id];
      return (
        p?.full_name?.toLowerCase().includes(q) ||
        p?.cooperativa?.toLowerCase().includes(q) ||
        planMap[s.plan_id ?? ""]?.name?.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q)
      );
    });
  }, [subs, profiles, planMap, search]);

  const filteredPurchases = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return purchases;
    return purchases.filter((p) => {
      const prof = profiles[p.user_id];
      return (
        prof?.full_name?.toLowerCase().includes(q) ||
        prof?.cooperativa?.toLowerCase().includes(q) ||
        courses[p.course_id]?.title?.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q)
      );
    });
  }, [purchases, profiles, courses, search]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl font-bold text-foreground">Assinaturas</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral de pagamentos, assinantes e cooperativas
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="MRR estimado" value={fmtBRL(stats.mrr)} icon={TrendingUp} gradient="primary" />
        <StatCard title="Receita avulsa (cursos)" value={fmtBRL(stats.grossPurchases)} icon={DollarSign} gradient="secondary" />
        <StatCard title="Assinantes ativos" value={stats.uniqueSubscribers} change={`${stats.totalActive} assinaturas`} changeType="positive" icon={Users} gradient="accent" />
        <StatCard title="Cooperativas" value={stats.uniqueCoops} change={`${stats.totalCanceled} canceladas`} changeType="neutral" icon={Building2} gradient="primary" />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por aluno, cooperativa, plano ou curso..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">Assinaturas ({filteredSubs.length})</TabsTrigger>
          <TabsTrigger value="purchases">Pagamentos ({filteredPurchases.length})</TabsTrigger>
          <TabsTrigger value="cooperativas">Cooperativas ({coopBreakdown.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader><CardTitle className="text-lg">Assinaturas</CardTitle></CardHeader>
            <CardContent>
              {filteredSubs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma assinatura encontrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Cooperativa</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Próx. cobrança</TableHead>
                        <TableHead>Ambiente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubs.map((s) => {
                        const p = profiles[s.user_id];
                        const plan = s.plan_id ? planMap[s.plan_id] : null;
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{p?.full_name ?? "—"}</TableCell>
                            <TableCell>{p?.cooperativa ?? "—"}</TableCell>
                            <TableCell>{plan ? `${plan.name} (${fmtBRL(Number(plan.price))}/${plan.interval === "year" ? "ano" : "mês"})` : "—"}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                              {s.cancel_at_period_end && <span className="ml-2 text-xs text-muted-foreground">cancela ao fim</span>}
                            </TableCell>
                            <TableCell>{fmtDate(s.started_at ?? s.created_at)}</TableCell>
                            <TableCell>{fmtDate(s.current_period_end)}</TableCell>
                            <TableCell><Badge variant="outline">{s.environment}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases">
          <Card>
            <CardHeader><CardTitle className="text-lg">Pagamentos avulsos (cursos)</CardTitle></CardHeader>
            <CardContent>
              {filteredPurchases.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum pagamento encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Cooperativa</TableHead>
                        <TableHead>Curso</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pago em</TableHead>
                        <TableHead>Ambiente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPurchases.map((p) => {
                        const prof = profiles[p.user_id];
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{prof?.full_name ?? "—"}</TableCell>
                            <TableCell>{prof?.cooperativa ?? "—"}</TableCell>
                            <TableCell>{courses[p.course_id]?.title ?? "—"}</TableCell>
                            <TableCell>{fmtBRL(Number(p.amount))}</TableCell>
                            <TableCell><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TableCell>
                            <TableCell>{fmtDate(p.paid_at ?? p.created_at)}</TableCell>
                            <TableCell><Badge variant="outline">{p.environment}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cooperativas">
          <Card>
            <CardHeader><CardTitle className="text-lg">Cooperativas com assinantes ativos</CardTitle></CardHeader>
            <CardContent>
              {coopBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma cooperativa com assinaturas ativas.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cooperativa</TableHead>
                      <TableHead className="text-right">Alunos assinantes</TableHead>
                      <TableHead className="text-right">Assinaturas ativas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coopBreakdown.map((c) => (
                      <TableRow key={c.name}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" /> {c.name}
                        </TableCell>
                        <TableCell className="text-right">{c.students}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="default" className="gap-1">
                            <CreditCard className="w-3 h-3" /> {c.subscriptions}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
