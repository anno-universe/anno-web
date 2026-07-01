import { useEffect, useState, useRef, type ImgHTMLAttributes } from "react";
import { apiGetBlob } from "@/api/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export function AuthenticatedImage({ src, alt, ...imgProps }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setError(false);
    setObjectUrl(null);

    let url: string | null = null;

    apiGetBlob(src)
      .then((blob) => {
        if (!mountedRef.current) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch(() => {
        if (mountedRef.current) setError(true);
      });

    return () => {
      mountedRef.current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground" style={{ width: imgProps.width, height: imgProps.height }}>
        Failed to load
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <Skeleton
        className="rounded-md"
        style={{ width: imgProps.width, height: imgProps.height }}
      />
    );
  }

  return <img src={objectUrl} alt={alt ?? ""} {...imgProps} />;
}
