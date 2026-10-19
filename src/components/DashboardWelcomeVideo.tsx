import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import IntroVideoModal from "./IntroVideoModal";

interface Props {
  /** Allows the parent to trigger a replay */
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function DashboardWelcomeVideo({ forceOpen, onClose }: Props) {
  const { data } = useQuery({
    queryKey: ["app_settings", "dashboard_welcome_video"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "dashboard_welcome_video")
        .maybeSingle();
      return data?.value as { url?: string } | null;
    },
  });

  const url = data?.url || "";
  if (!url) return null;

  return (
    <IntroVideoModal
      videoUrl={url}
      storageKey="intro_seen_dashboard_v1"
      forceOpen={forceOpen}
      onClose={onClose}
      title="Bem-vindo à Coopaiba EAD"
      description="Conheça em poucos minutos como aproveitar a plataforma."
    />
  );
}
