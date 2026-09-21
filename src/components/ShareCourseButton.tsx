import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ShareCourseButtonProps {
  courseId: string;
  title: string;
  description?: string | null;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  label?: string;
}

export default function ShareCourseButton({
  courseId,
  title,
  description,
  size = "sm",
  variant = "outline",
  className,
  label,
}: ShareCourseButtonProps) {
  const { toast } = useToast();

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/courses/${courseId}`;
    const shareData = {
      title,
      text: description ? `${title} — ${description}` : title,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!", description: "O link do curso foi copiado para a área de transferência." });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copiado!", description: url });
      } catch {
        toast({ title: "Não foi possível compartilhar", description: url, variant: "destructive" });
      }
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={handleShare}
      aria-label={`Compartilhar curso ${title}`}
    >
      <Share2 className={label ? "w-3.5 h-3.5 mr-1.5" : "w-3.5 h-3.5"} />
      {label}
    </Button>
  );
}
