import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CheckCircle2, LinkIcon, LogOut } from "lucide-react";

const CONNECTOR_ID = "google_calendar";

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
}

function waitForOAuthCompletion(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      ) return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") return resolve();
      popup.close();
      reject(new Error(event.data?.reason ?? "A conexão com o Google falhou."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("A janela foi fechada antes de concluir."));
    }, 500);
  });
}

export function useGoogleStatus() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("google-connection-status", {
      body: { action: "status" },
    });
    if (error) setStatus({ configured: false, connected: false, email: null });
    else setStatus(data as GoogleStatus);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return { status, loading, refresh };
}

export default function GoogleConnectCard({
  status,
  loading,
  onChanged,
}: {
  status: GoogleStatus | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function connect() {
    const popup = window.open("", "google-oauth", "width=600,height=720");
    if (!popup) {
      toast.error("Pop-up bloqueado. Libere os pop-ups e tente novamente.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-connect-start", {
        body: { origin: window.location.origin },
      });
      if (error) throw error;
      if (!data?.authorizationUrl) throw new Error("URL de autorização não recebida.");
      const completion = waitForOAuthCompletion(popup);
      popup.location.href = data.authorizationUrl;
      await completion;
      toast.success("Conta Google conectada.");
      onChanged();
    } catch (e) {
      popup.close();
      toast.error((e as Error).message ?? "Não foi possível conectar.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    const { error } = await supabase.functions.invoke("google-connection-status", {
      body: { action: "disconnect" },
    });
    setBusy(false);
    if (error) toast.error("Não foi possível desconectar.");
    else { toast.success("Conta Google desconectada."); onChanged(); }
  }

  if (loading) return <Skeleton className="h-24 w-full rounded-2xl" />;

  if (status && !status.configured) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          A integração com o Google ainda não foi configurada nesta plataforma. Você pode criar aulas ao vivo
          usando um link de reunião existente.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <LinkIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm">Conta Google</p>
            {status?.connected ? (
              <p className="text-xs text-muted-foreground truncate">{status.email ?? "conta conectada"}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Conecte para criar reuniões do Google Meet automaticamente.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status?.connected && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Conectada
            </Badge>
          )}
          {status?.connected ? (
            <Button size="sm" variant="outline" onClick={disconnect} disabled={busy}>
              <LogOut className="h-4 w-4 mr-1" /> Desconectar
            </Button>
          ) : (
            <Button size="sm" onClick={connect} disabled={busy}>
              {busy ? "Conectando…" : "Conectar Google"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
