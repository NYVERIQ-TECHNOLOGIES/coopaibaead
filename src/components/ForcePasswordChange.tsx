import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2 } from "lucide-react";

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
          <h1 className="text-lg font-semibold">Crie sua nova senha</h1>
          <p className="text-sm text-muted-foreground">
            Por segurança, troque a senha temporária no primeiro acesso para continuar usando a plataforma.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fp-current">Senha atual (temporária)</Label>
          <Input id="fp-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fp-new">Nova senha</Label>
          <Input id="fp-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres, com letras e números.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fp-confirm">Confirmar nova senha</Label>
          <Input id="fp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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
