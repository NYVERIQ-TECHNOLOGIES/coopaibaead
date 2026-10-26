import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

export function validateNewPassword(current: string, next: string, confirm: string): string | null {
  if (!current) return "Informe a senha atual (a senha temporária que você usou para entrar).";
  if (next.length < 8) return "A nova senha deve ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return "A nova senha deve ter letras e números.";
  if (next === current) return "A nova senha precisa ser diferente da senha temporária.";
  if (next !== confirm) return "As senhas não conferem.";
  return null;
}

interface Props {
  onDone: () => void;
  onSignOut: () => void;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function ForcePasswordChange({ onDone, onSignOut }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateNewPassword(current, next, confirm);
    if (v) return setError(v);
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: next, current_password: current });
    setBusy(false);
    if (err) {
      const msg = err.message?.toLowerCase() ?? "";
      if (msg.includes("current") || msg.includes("invalid")) setError("A senha atual está incorreta.");
      else if (msg.includes("same") || msg.includes("different")) setError("A nova senha precisa ser diferente da atual.");
      else if (msg.includes("weak") || msg.includes("pwned") || msg.includes("leaked"))
        setError("Essa senha é fraca ou já vazou na internet. Escolha outra.");
      else setError("Não foi possível trocar a senha. Tente novamente.");
      return;
    }
    onDone();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="max-w-sm w-full space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg font-semibold">🔐 Atualize sua senha</h1>
          <p className="text-sm text-muted-foreground">
            Para garantir mais segurança à sua conta, precisamos que você altere sua senha de acesso. Crie uma nova
            senha pessoal para continuar utilizando a plataforma EAD da Coopaiba.
          </p>
        </div>
        <PasswordField
          id="fp-current"
          label="Senha atual (temporária)"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <PasswordField
          id="fp-new"
          label="Nova senha"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres, com letras e números."
        />
        <PasswordField
          id="fp-confirm"
          label="Confirmar nova senha"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar nova senha
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onSignOut}>
          Sair da conta
        </Button>
      </form>
    </div>
  );
}
