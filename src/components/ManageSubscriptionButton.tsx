import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useToast } from "@/hooks/use-toast";

interface Props {
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default" | "lg";
  label?: string;
  className?: string;
}

export function ManageSubscriptionButton({
  variant = "outline",
  size = "default",
  label = "Gerenciar assinatura",
  className,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: window.location.href,
        },
      });
      if (error || !data?.url) {
        throw new Error(error?.message || (data as { error?: string })?.error || "Falha ao abrir portal");
      }
      window.open(data.url as string, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({
        title: "Não foi possível abrir o portal",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={open} disabled={loading} className={className}>
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
      {label}
    </Button>
  );
}
