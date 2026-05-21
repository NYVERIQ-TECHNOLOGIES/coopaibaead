import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History, Loader2 } from "lucide-react";

const ACTION_LABEL: Record<string, string> = {
  gerado: "Certificado gerado",
  disponibilizado: "Disponibilizado para retirada",
  retirado: "Retirado presencialmente",
  cancelado: "Cancelado",
  reemitido: "Reemitido",
};

const ACTION_STYLE: Record<string, string> = {
  gerado: "bg-primary/10 text-primary",
  disponibilizado: "bg-secondary/10 text-secondary",
  retirado: "bg-success/10 text-success",
  cancelado: "bg-destructive/10 text-destructive",
  reemitido: "bg-accent/10 text-accent-foreground",
};

interface Props {
  certificateId: string | null;
  certificateCode?: string;
  onClose: () => void;
}

export default function CertificateAuditDialog({ certificateId, certificateCode, onClose }: Props) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["certificate-audit", certificateId],
    queryFn: async () => {
      if (!certificateId) return [];
      const { data } = await supabase
        .from("certificate_audit_log")
        .select("*")
        .eq("certificate_id", certificateId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!certificateId,
  });

  return (
    <Dialog open={!!certificateId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" /> Histórico do certificado
          </DialogTitle>
          <DialogDescription>
            {certificateCode ? `Movimentações de ${certificateCode}` : "Movimentações registradas"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando histórico...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma movimentação registrada para este certificado.
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {logs.map((log: any) => (
              <div key={log.id} className="border border-border rounded-lg p-3 bg-card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${ACTION_STYLE[log.action] || "bg-muted"}`}>
                    {ACTION_LABEL[log.action] || log.action}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {log.actor_name && (
                  <p className="text-sm text-foreground mt-2">
                    <span className="text-muted-foreground">Responsável:</span> {log.actor_name}
                  </p>
                )}
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    {Object.entries(log.details).map(([k, v]) => (
                      <div key={k}>
                        <span className="font-medium">{k}:</span> {String(v)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
