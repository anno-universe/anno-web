import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { apiGetBlob } from "@/api/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export function AuthenticatedImage({ src, alt, ...imgProps }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let objectUrl: string | null = null;

    setError(false);
    setObjectUrl(null);

    apiGetBlob(src, { signal: controller.signal })
      .then((blob) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setObjectUrl(objectUrl);
      })
      .catch(() => {
        if (!disposed && !controller.signal.aborted) setError(true);
      });

    return () => {
      disposed = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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
