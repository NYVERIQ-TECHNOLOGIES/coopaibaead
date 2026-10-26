import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface State {
  hasError: boolean;
}

/**
 * Última linha de defesa contra tela branca: qualquer erro de renderização
 * recuperável mostra uma mensagem amigável com opção de tentar novamente,
 * em vez de deixar a página em branco.
 */
export default class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro de renderização capturado:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-lg font-semibold">Não foi possível carregar esta página</h1>
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar esta página. Verifique sua conexão e tente novamente.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={this.handleReload}>Tentar novamente</Button>
            <Button variant="outline" onClick={this.handleRetry}>
              Voltar sem recarregar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
