import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "coopaiba_cookie_consent_v1";

export default function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      // ignore
    }
  }, []);

  const decide = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-4 md:left-auto md:max-w-md z-50">
      <div className="bg-card border border-border rounded-2xl shadow-elevated p-5 flex gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Cookie className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 text-sm">
          <p className="font-semibold text-foreground">Sua privacidade importa</p>
          <p className="text-muted-foreground mt-1">
            Usamos cookies essenciais para autenticação e melhorar sua experiência. Veja nossa{" "}
            <Link to="/privacidade" className="text-primary hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => decide("rejected")}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-foreground hover:bg-muted"
            >
              Apenas essenciais
            </button>
            <button
              type="button"
              onClick={() => decide("accepted")}
              className="px-3 py-1.5 text-xs font-medium rounded-md gradient-primary text-primary-foreground hover:opacity-90"
            >
              Aceitar todos
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => decide("rejected")}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
