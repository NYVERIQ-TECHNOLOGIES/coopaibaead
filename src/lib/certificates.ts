export type CertStatus = "pendente" | "disponivel_retirada" | "retirado" | "cancelado" | "emitido" | "erro";

export const CERT_STATUS_LABEL: Record<string, string> = {
  pendente: "Em processamento",
  emitido: "Disponível para download",
  disponivel_retirada: "Disponível para retirada na cooperativa",
  retirado: "Retirado",
  cancelado: "Cancelado",
  erro: "Erro na emissão",
};

export const CERT_STATUS_STYLE: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/30",
  emitido: "bg-success/10 text-success border-success/30",
  disponivel_retirada: "bg-primary/10 text-primary border-primary/30",
  retirado: "bg-success/10 text-success border-success/30",
  cancelado: "bg-destructive/10 text-destructive border-destructive/30",
  erro: "bg-destructive/10 text-destructive border-destructive/30",
};

export const CERT_STATUS_MESSAGE: Record<string, string> = {
  pendente: "Seu certificado está sendo emitido. Atualize a página em instantes.",
  emitido: "Seu certificado já está disponível para download.",
  disponivel_retirada: "Seu certificado está disponível para retirada na cooperativa. Compareça à secretaria para assinatura do comprovante de conclusão.",
  retirado: "Certificado retirado presencialmente.",
  cancelado: "Este certificado foi cancelado.",
  erro: "Ocorreu um erro na emissão do certificado. Entre em contato com a administração.",
};

export interface PickupInfo {
  cooperativa_nome?: string;
  endereco?: string;
  cidade?: string;
  horario?: string;
  telefone?: string;
  documentos_necessarios?: string[];
}
