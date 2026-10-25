import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ForcePasswordChange from "@/components/ForcePasswordChange";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Props {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function LoadErrorScreen({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold">Não foi possível carregar</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex flex-col gap-2">
          <Button onClick={onRetry}>Tentar novamente</Button>
          <Button variant="outline" onClick={onSignOut}>
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { session, role, loading, dataReady, loadError, mustChangePassword, retry, signOut } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!session) return <Navigate to="/login" replace />;

  // Senha temporária: o servidor bloqueia os dados até a troca, então pedir a nova senha aqui
  if (mustChangePassword) {
    return <ForcePasswordChange onDone={retry} onSignOut={signOut} />;
  }

  // Falha recuperável no carregamento dos dados: mostrar erro com nova tentativa
  if (loadError) {
    return <LoadErrorScreen message={loadError} onRetry={retry} onSignOut={signOut} />;
  }

  // Esperar a role ser carregada antes de avaliar permissões
  if (allowedRoles) {
    if (!role) {
      // Dados carregados, mas a conta não tem papel cadastrado: não girar para sempre
      if (dataReady) {
        return (
          <LoadErrorScreen
            message="Sua conta ainda não tem uma permissão de acesso cadastrada. Fale com a secretaria da cooperativa para liberar seu acesso."
            onRetry={retry}
            onSignOut={signOut}
          />
        );
      }
      return <LoadingScreen />;
    }
    if (!allowedRoles.includes(role)) {
      // Redirecionar para a home apropriada do papel atual
      const home =
        role === "admin" || role === "moderador"
          ? "/app"
          : role === "professor"
            ? "/professor"
            : "/student";
      return <Navigate to={home} replace />;
    }
  }

  return <>{children}</>;
}
