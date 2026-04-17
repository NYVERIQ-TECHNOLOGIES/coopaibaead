import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage";

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  path: string | null | undefined;
  bucket?: string;
  fallback?: string;
}

/**
 * Renders an <img> using a short-lived signed URL from the given bucket.
 * Accepts either a raw storage path or a legacy public URL.
 */
export default function SignedImage({ path, bucket = "media", fallback, alt = "", ...props }: Props) {
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (!path) {
      setSrc(fallback);
      return;
    }
    getSignedUrl(path, bucket).then((url) => {
      if (active) setSrc(url || fallback);
    });
    return () => {
      active = false;
    };
  }, [path, bucket, fallback]);

  if (!src) return null;
  return <img src={src} alt={alt} {...props} />;
}
