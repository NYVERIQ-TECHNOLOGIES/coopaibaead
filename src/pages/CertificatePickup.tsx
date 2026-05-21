import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, MapPin, Clock, Phone, FileText, Award, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { CERT_STATUS_LABEL, CERT_STATUS_STYLE, PickupInfo } from "@/lib/certificates";

export default function CertificatePickup() {
  const { code } = useParams<{ code: string }>();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "moderador";

  const { data: cert, isLoading } = useQuery({
    queryKey: ["cert-pickup", code, user?.id],
    queryFn: async () => {
      const q = supabase
        .from("certificates")
        .select("*, courses(title, duration), profiles!certificates_user_id_fkey(full_name, cpf)")
        .eq("code", code!)
        .maybeSingle();
      const { data } = await q;
      return data;
    },
    enabled: !!code && !!user,
  });

  const { data: pickup } = useQuery<PickupInfo>({
    queryKey: ["cert-pickup-info"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "cert_pickup_info").maybeSingle();
      return (data?.value as PickupInfo) || {};
    },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!cert) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-muted-foreground">Certificado não encontrado ou você não tem acesso a ele.</p>
        <Link to="/certificates" className="text-primary underline mt-2 inline-block">Voltar</Link>
      </div>
    );
  }

  const ownerName = (cert as any).profiles?.full_name || cert.student_name_snapshot || "—";
  const ownerCpf = (cert as any).profiles?.cpf || cert.student_cpf_snapshot || "—";
  const courseTitle = (cert as any).courses?.title || cert.course_title_snapshot || "—";
  const courseDuration = (cert as any).courses?.duration || cert.course_duration_snapshot || "—";

  const isCancelled = cert.status === "cancelado";
  const isRetirado = cert.status === "retirado";
  const isAvailable = cert.status === "disponivel_retirada" || cert.status === "emitido";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/certificates" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="gradient-primary p-6 text-primary-foreground">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-heading font-bold">Informações para Retirada</h1>
              <p className="text-primary-foreground/80 text-sm">Certificado: <span className="font-mono">{cert.code}</span></p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 mt-2 text-xs font-semibold px-3 py-1 rounded-full bg-background/95 border ${CERT_STATUS_STYLE[cert.status] || ""}`}>
            {isAvailable && <CheckCircle className="w-3 h-3" />}
            {isRetirado && <CheckCircle className="w-3 h-3" />}
            {isCancelled && <XCircle className="w-3 h-3" />}
            {CERT_STATUS_LABEL[cert.status] || cert.status}
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Aviso */}
          {isAvailable && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm text-foreground space-y-1">
                <p className="font-semibold">Seu certificado já está disponível para retirada presencial na Cooperativa Coopaíba.</p>
                <p className="text-muted-foreground">Dirija-se à sede da cooperativa portando documento oficial com foto para receber seu certificado. Em caso de dúvidas, entre em contato com nossa equipe de atendimento.</p>
                <p className="text-muted-foreground italic">Por questões de segurança e autenticidade, não é permitido o download, compartilhamento, envio por e-mail ou impressão do certificado pelo aluno.</p>
              </div>
            </div>
          )}

          {isRetirado && (
            <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
              <p className="font-semibold text-success mb-1">Certificado já retirado</p>
              <p className="text-muted-foreground">
                Retirado em {cert.pickup_registered_at ? new Date(cert.pickup_registered_at).toLocaleString("pt-BR") : "—"}
                {cert.pickup_attendant_name && <> · atendente: {cert.pickup_attendant_name}</>}
              </p>
            </div>
          )}

          {isCancelled && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="font-semibold text-destructive mb-1">Certificado cancelado</p>
              {cert.cancellation_reason && <p className="text-muted-foreground">Motivo: {cert.cancellation_reason}</p>}
            </div>
          )}

          {/* Dados do certificado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Info label="Cooperado" value={ownerName} />
            <Info label="CPF" value={ownerCpf} />
            <Info label="Curso" value={courseTitle} />
            <Info label="Carga horária" value={courseDuration} />
            <Info label="Data de conclusão" value={cert.completed_at ? new Date(cert.completed_at).toLocaleDateString("pt-BR") : "—"} />
            <Info label="Data de emissão" value={cert.issued_at ? new Date(cert.issued_at).toLocaleDateString("pt-BR") : "—"} />
            <Info label="Número do certificado" value={cert.code} mono />
            <Info label="Status" value={CERT_STATUS_LABEL[cert.status] || cert.status} />
          </div>

          {/* Local de retirada */}
          <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Local de Retirada</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Cooperativa</p>
                <p className="text-foreground">{pickup?.cooperativa_nome || "Cooperativa Coopaíba"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Endereço</p>
                <p className="text-foreground">{pickup?.endereco || "Endereço não cadastrado"}{pickup?.cidade && <> — {pickup.cidade}</>}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> Horário de atendimento</p>
                <p className="text-foreground">{pickup?.horario || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone</p>
                <p className="text-foreground">{pickup?.telefone || "—"}</p>
              </div>
            </div>
          </div>

          {/* Documentos */}
          <div className="rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3"><FileText className="w-4 h-4 text-primary" /> Documentos Necessários</h3>
            <ul className="space-y-1.5 text-sm">
              {(pickup?.documentos_necessarios?.length ? pickup.documentos_necessarios : ["Documento oficial com foto", "CPF (caso não conste no documento)"]).map((d, i) => (
                <li key={i} className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" /> {d}</li>
              ))}
            </ul>
          </div>

          {isStaff && (
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm">
              <p className="text-muted-foreground">
                <strong>Painel administrativo:</strong> use a página de Certificados para registrar a retirada presencial, imprimir ou cancelar este certificado.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">{label}</p>
      <p className={`text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
