import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CONNECTOR_ID = "google_calendar";

export default function GoogleReturn() {
  const [message, setMessage] = useState("Finalizando a conexão com o Google…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed") => {
      window.opener?.postMessage({ type, connectorId: CONNECTOR_ID }, window.location.origin);
      window.close();
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "A autorização não foi concluída.");
      notify("appUserConnectorOAuthFailed");
      return;
    }

    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        const reason =
          "Esta conexão ainda não pode ser usada: um administrador precisa habilitar o acesso offline no cliente do conector.";
        setMessage(reason);
        window.opener?.postMessage(
          { type: "appUserConnectorOAuthFailed", connectorId: CONNECTOR_ID, reason },
          window.location.origin,
        );
        return;
      }
      setMessage("A autorização terminou sem código de troca.");
      notify("appUserConnectorOAuthFailed");
      return;
    }

    void supabase.functions
      .invoke("google-connect-complete", { body: { code } })
      .then(({ error }) => {
        if (error) throw error;
        notify("appUserConnectorOAuthComplete");
      })
      .catch(() => {
        setMessage("Não foi possível concluir a conexão.");
        notify("appUserConnectorOAuthFailed");
      });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <p className="text-sm text-muted-foreground text-center max-w-sm">{message}</p>
    </main>
  );
}
