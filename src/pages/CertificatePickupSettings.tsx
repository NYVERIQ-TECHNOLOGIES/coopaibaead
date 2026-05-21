import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { MapPin, Clock, Phone, FileText, Plus, X, Save, Building2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { PickupInfo } from "@/lib/certificates";

export default function CertificatePickupSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["cert-pickup-info"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "cert_pickup_info").maybeSingle();
      return (data?.value as PickupInfo) || {};
    },
  });

  const [form, setForm] = useState<PickupInfo>({});
  const [novoDoc, setNovoDoc] = useState("");

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (payload: PickupInfo) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "cert_pickup_info", value: payload as any, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cert-pickup-info"] });
      toast({ title: "Configurações salvas" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const addDoc = () => {
    const v = novoDoc.trim();
    if (!v) return;
    setForm((f) => ({ ...f, documentos_necessarios: [...(f.documentos_necessarios ?? []), v] }));
    setNovoDoc("");
  };

  const removeDoc = (i: number) => {
    setForm((f) => ({
      ...f,
      documentos_necessarios: (f.documentos_necessarios ?? []).filter((_, idx) => idx !== i),
    }));
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando…</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/certificates" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Certificados
      </Link>

      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold">Retirada Presencial de Certificados</h1>
        <p className="text-muted-foreground mt-1">Estas informações serão exibidas aos cooperados na tela "Informações para Retirada".</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-6 space-y-5 shadow-card">
        <h2 className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Cooperativa</h2>
        <div>
          <Label>Nome da cooperativa</Label>
          <Input value={form.cooperativa_nome ?? ""} onChange={(e) => setForm({ ...form, cooperativa_nome: e.target.value })}
            placeholder="Cooperativa Coopaíba" maxLength={120} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Endereço</Label>
            <Input value={form.endereco ?? ""} onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              placeholder="Rua, número, bairro" maxLength={200} />
          </div>
          <div>
            <Label>Cidade / Estado</Label>
            <Input value={form.cidade ?? ""} onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              placeholder="Cidade — UF" maxLength={120} />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Horário de atendimento</Label>
            <Input value={form.horario ?? ""} onChange={(e) => setForm({ ...form, horario: e.target.value })}
              placeholder="Seg a Sex, 8h às 17h" maxLength={120} />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Telefone</Label>
            <Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(00) 0000-0000" maxLength={40} />
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-card">
        <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Documentos necessários</h2>
        <p className="text-sm text-muted-foreground">Liste os documentos que o cooperado deve apresentar no momento da retirada.</p>

        <div className="space-y-2">
          {(form.documentos_necessarios ?? []).map((doc, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
              <span className="text-sm flex-1">{doc}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => removeDoc(i)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {(form.documentos_necessarios ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground italic">Nenhum documento cadastrado — serão exibidos os padrões.</p>
          )}
        </div>

        <div className="flex gap-2">
          <Input value={novoDoc} onChange={(e) => setNovoDoc(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDoc(); } }}
            placeholder="Ex.: RG ou CNH" maxLength={120} />
          <Button type="button" onClick={addDoc} variant="outline" className="gap-1">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>
      </motion.div>

      <div className="flex justify-end gap-2">
        <Button onClick={() => save.mutate(form)} disabled={save.isPending} className="gap-2">
          <Save className="w-4 h-4" /> {save.isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}
