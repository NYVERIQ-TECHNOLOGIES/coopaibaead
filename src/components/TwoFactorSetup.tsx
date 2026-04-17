import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, KeyRound, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Factor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
}

export default function TwoFactorSetup() {
  const { toast } = useToast();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);

  // Enrollment state
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const loadFactors = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      setFactors([...(data.totp ?? [])] as Factor[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `App ${new Date().toLocaleDateString("pt-BR")}`,
    });
    if (error) {
      toast({ title: "Erro ao iniciar 2FA", description: error.message, variant: "destructive" });
      setEnrolling(false);
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  };

  const verifyEnroll = async () => {
    if (!factorId || !code) return;
    setVerifying(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) {
      toast({ title: "Erro", description: chErr?.message, variant: "destructive" });
      setVerifying(false);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code,
    });
    setVerifying(false);
    if (error) {
      toast({ title: "Código inválido", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "2FA ativado com sucesso!" });
    setEnrolling(false);
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
    setCode("");
    loadFactors();
  };

  const cancelEnroll = async () => {
    if (factorId) await supabase.auth.mfa.unenroll({ factorId });
    setEnrolling(false);
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
    setCode("");
  };

  const removeFactor = async (id: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "2FA removido" });
    loadFactors();
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      {factors.length === 0 && !enrolling && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A autenticação de dois fatores adiciona uma camada extra de segurança usando um app
            como Google Authenticator, Authy ou 1Password.
          </p>
          <Button onClick={startEnroll} className="gap-2">
            <ShieldCheck className="w-4 h-4" /> Ativar autenticação de 2 fatores
          </Button>
        </div>
      )}

      {enrolling && qrCode && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-lg border border-border p-4 bg-muted/20">
          <div>
            <h4 className="font-medium text-foreground mb-1">1. Escaneie o QR Code</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Abra seu app autenticador e escaneie o código abaixo.
            </p>
            <div className="bg-white p-3 rounded-lg w-fit mx-auto" dangerouslySetInnerHTML={{ __html: qrCode }} />
          </div>
          {secret && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ou digite manualmente:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded select-all">{secret}</code>
            </div>
          )}
          <div>
            <Label>2. Digite o código de 6 dígitos</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              className="font-mono text-center tracking-widest text-lg"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelEnroll} className="flex-1">Cancelar</Button>
            <Button onClick={verifyEnroll} disabled={code.length !== 6 || verifying} className="flex-1 gap-2">
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Verificar e ativar
            </Button>
          </div>
        </motion.div>
      )}

      {factors.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-foreground font-medium">Fatores ativos:</p>
          {factors.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border border-border p-3 bg-card">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{f.friendly_name || "App autenticador"}</p>
                  <p className="text-xs text-muted-foreground">TOTP • {f.status === "verified" ? "Ativo" : f.status}</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeFactor(f.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
