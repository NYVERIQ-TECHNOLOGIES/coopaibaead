export type CertStatus = "pendente" | "disponivel_retirada" | "retirado" | "cancelado" | "emitido";

export const CERT_STATUS_LABEL: Record<string, string> = {
  pendente: "Em processamento",
  emitido: "Disponível para retirada",
  disponivel_retirada: "Disponível para retirada",
  retirado: "Retirado",
  cancelado: "Cancelado",
};

export const CERT_STATUS_STYLE: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/30",
  emitido: "bg-primary/10 text-primary border-primary/30",
  disponivel_retirada: "bg-primary/10 text-primary border-primary/30",
  retirado: "bg-success/10 text-success border-success/30",
  cancelado: "bg-destructive/10 text-destructive border-destructive/30",
};

export interface PickupInfo {
  cooperativa_nome?: string;
  endereco?: string;
  cidade?: string;
  horario?: string;
  telefone?: string;
  documentos_necessarios?: string[];
}
