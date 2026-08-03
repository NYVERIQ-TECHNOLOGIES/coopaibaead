import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserRoundCog } from "lucide-react";

// Routes that should never trigger the modal
const EXCLUDED_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/p/", "/certificados/validar"];

type Missing = { cpf: boolean; data_nascimento: boolean; phone: boolean };

function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}
function maskDate(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2})(\d)/, "$1/$2");
}

function validateCPF(cpf: string) {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10]);
}

export function CompleteProfileModal() {
  const { user, loading, role } = useAuth();
  const location = useLocation();
  const [missing, setMissing] = useState<Missing | null>(null);
  const [open, setOpen] = useState(false);
  const [cpf, setCpf] = useState("");
  const [dataNasc, setDataNasc] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Missing, string>>>({});

  const excluded = EXCLUDED_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (loading || !user || excluded || role === "admin") return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("cpf, data_nascimento, phone, is_test_user")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      // Exceção: usuários de teste ignoram totalmente a validação de cadastro
      if ((data as { is_test_user?: boolean }).is_test_user) {
        setMissing(null);
        setOpen(false);
        return;
      }
      const m: Missing = {
        cpf: !data.cpf || data.cpf.trim().length === 0,
        data_nascimento: !data.data_nascimento,
        phone: !data.phone || data.phone.trim().length === 0,
      };
      if (m.cpf || m.data_nascimento || m.phone) {
        setMissing(m);
        setOpen(true);
      } else {
        setMissing(null);
        setOpen(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, excluded, location.pathname, role]);

  if (!missing || !open) return null;

  const handleSave = async () => {
    const newErrors: Partial<Record<keyof Missing, string>> = {};
    let cpfIso: string | null = null;
    let dataIso: string | null = null;
    let phoneIso: string | null = null;

    if (missing.cpf) {
      if (!validateCPF(cpf)) newErrors.cpf = "CPF inválido";
      else cpfIso = cpf.replace(/\D/g, "");
    }
    if (missing.data_nascimento) {
      const parts = dataNasc.split("/");
      if (parts.length !== 3 || parts[2].length !== 4) {
        newErrors.data_nascimento = "Data inválida (DD/MM/AAAA)";
      } else {
        const [dd, mm, yyyy] = parts.map((p) => parseInt(p, 10));
        const dt = new Date(yyyy, mm - 1, dd);
        if (
          isNaN(dt.getTime()) ||
          dt.getFullYear() !== yyyy ||
          dt.getMonth() !== mm - 1 ||
          dt.getDate() !== dd
        ) {
          newErrors.data_nascimento = "Data inválida";
        } else if (dt > new Date()) {
          newErrors.data_nascimento = "Data não pode ser futura";
        } else {
          dataIso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        }
      }
    }
    if (missing.phone) {
      const clean = phone.replace(/\D/g, "");
      if (clean.length < 10 || clean.length > 11) newErrors.phone = "Telefone inválido";
      else phoneIso = clean;
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    const { error } = await supabase.rpc("complete_profile_info", {
      _cpf: cpfIso,
      _data_nascimento: dataIso,
      _phone: phoneIso,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cadastro atualizado", description: "Suas informações foram salvas com sucesso." });
    setOpen(false);
    setMissing(null);
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* bloqueado */ }}>
      <DialogContent
        className="sm:max-w-md animate-in fade-in-0 zoom-in-95"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <UserRoundCog className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Complete seu cadastro</DialogTitle>
          <DialogDescription className="text-center">
            Para continuar utilizando a plataforma, precisamos que você complete algumas informações obrigatórias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {missing.cpf && (
            <div className="space-y-1.5">
              <Label htmlFor="cpm-cpf">CPF</Label>
              <Input
                id="cpm-cpf"
                value={cpf}
                onChange={(e) => setCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
              {errors.cpf && <p className="text-xs text-destructive">{errors.cpf}</p>}
            </div>
          )}
          {missing.data_nascimento && (
            <div className="space-y-1.5">
              <Label htmlFor="cpm-dn">Data de nascimento</Label>
              <Input
                id="cpm-dn"
                value={dataNasc}
                onChange={(e) => setDataNasc(maskDate(e.target.value))}
                placeholder="DD/MM/AAAA"
                inputMode="numeric"
              />
              {errors.data_nascimento && (
                <p className="text-xs text-destructive">{errors.data_nascimento}</p>
              )}
            </div>
          )}
          {missing.phone && (
            <div className="space-y-1.5">
              <Label htmlFor="cpm-phone">Telefone / WhatsApp</Label>
              <Input
                id="cpm-phone"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                inputMode="numeric"
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar informações"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
