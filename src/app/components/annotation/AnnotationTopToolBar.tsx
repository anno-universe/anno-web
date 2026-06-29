import { ChevronLeft, ChevronRight } from "lucide-react";
import { ImageTagBar } from "./ImageTagBar";
import type { Image2DOutput } from "@/types/image";
import type { TagOutput, ImageTagOutput } from "@/types/tag";

interface AnnotationTopToolBarProps {
  image: Image2DOutput;
  prevImageId?: number;
  nextImageId?: number;
  onNavigate: (imageId: number) => void;
  imagesLoading?: boolean;
  imageTags: ImageTagOutput[];
  projectTags: TagOutput[];
  onApplyTag: (tagId: number) => void;
  onRemoveTag: (tagId: number) => void;
  error?: string;
  onDismissError: () => void;
}

/**
 * Top toolbar for the annotation page.
 * Shows image filename, dimensions, prev/next navigation,
 * tag management, and error dismissal.
 */
export function AnnotationTopToolBar({
  image,
  prevImageId,
  nextImageId,
  onNavigate,
  imagesLoading = false,
  imageTags,
  projectTags,
  onApplyTag,
  onRemoveTag,
  error,
  onDismissError,
}: AnnotationTopToolBarProps) {
  const dimensions =
    image.width && image.height ? `(${image.width} × ${image.height})` : null;

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b bg-card px-3">
      {/* Left: prev btn + image info + next btn */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <button
          type="button"
          disabled={prevImageId == null || imagesLoading}
          onClick={() => prevImageId != null && onNavigate(prevImageId)}
          className="inline-flex items-center justify-center rounded p-0.5 hover:bg-muted hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-30"
          title="Previous image"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="font-medium text-foreground">{image.file_name}</span>
        {dimensions && (
          <span className="text-muted-foreground">{dimensions}</span>
        )}

        <button
          type="button"
          disabled={nextImageId == null || imagesLoading}
          onClick={() => nextImageId != null && onNavigate(nextImageId)}
          className="inline-flex items-center justify-center rounded p-0.5 hover:bg-muted hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-30"
          title="Next image"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Right: tags + error dismiss */}
      <div className="flex items-center gap-3">
        <ImageTagBar
          imageTags={imageTags}
          projectTags={projectTags}
          onApplyTag={onApplyTag}
          onRemoveTag={onRemoveTag}
        />
        {error && (
          <button
            onClick={onDismissError}
            className="text-xs text-destructive hover:underline"
          >
            {error} (dismiss)
          </button>
        )}
      </div>
    </div>
  );
}
