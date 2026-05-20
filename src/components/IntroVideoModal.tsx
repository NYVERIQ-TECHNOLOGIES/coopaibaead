import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { getSignedUrl } from "@/lib/storage";

interface IntroVideoModalProps {
  /** Direct video URL (.mp4/.webm), storage path, or YouTube/Vimeo URL */
  videoUrl: string;
  /** Unique key persisted in localStorage so the modal shows only once */
  storageKey: string;
  /** When true, ignore localStorage and force-show */
  forceOpen?: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
}

function toEmbedUrl(url: string): { embed: string | null; direct: string | null } {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let id = "";
      if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
      else if (u.pathname.startsWith("/watch")) id = u.searchParams.get("v") || "";
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/embed/")[1];
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/shorts/")[1];
      if (id) return { embed: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`, direct: null };
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) {
        return { embed: `https://player.vimeo.com/video/${id}?autoplay=1`, direct: null };
      }
    }
    // Direct file
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(u.pathname)) {
      return { embed: null, direct: url };
    }
    // Fallback: try iframe
    return { embed: url, direct: null };
  } catch {
    return { embed: null, direct: url };
  }
}

function looksLikeStoragePath(url: string) {
  if (!url) return false;
  // Raw storage path (no protocol) or signed/public storage URL
  if (!url.startsWith("http")) return true;
  return url.includes("/storage/v1/object/");
}

export default function IntroVideoModal({
  videoUrl,
  storageKey,
  forceOpen,
  onClose,
  title = "Introdução",
  description,
}: IntroVideoModalProps) {
  const [open, setOpen] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string>("");

  // Resolve storage paths to signed URLs; pass through external URLs
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!videoUrl) {
        setResolvedUrl("");
        return;
      }
      if (looksLikeStoragePath(videoUrl)) {
        try {
          const signed = await getSignedUrl(videoUrl, "media", 3600);
          if (!cancelled) setResolvedUrl(signed || videoUrl);
        } catch {
          if (!cancelled) setResolvedUrl(videoUrl);
        }
      } else {
        setResolvedUrl(videoUrl);
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [videoUrl]);

  const { embed, direct } = useMemo(() => toEmbedUrl(resolvedUrl), [resolvedUrl]);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      return;
    }
    if (!videoUrl) return;
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [videoUrl, storageKey, forceOpen]);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      try {
        localStorage.setItem(storageKey, "1");
      } catch {}
      onClose?.();
    }
  };

  if (!videoUrl) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="aspect-video w-full bg-black">
          {!resolvedUrl ? (
            <div className="w-full h-full flex items-center justify-center text-white/70 text-sm">
              Carregando vídeo...
            </div>
          ) : direct ? (
            <video src={direct} controls autoPlay className="w-full h-full" />
          ) : embed ? (
            <iframe
              src={embed}
              title={title}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : null}
        </div>
        <div className="flex justify-end gap-2 p-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="gap-2">
            <X className="w-4 h-4" /> Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
