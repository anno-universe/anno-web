import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
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
  /** Current user ID — for tag removal ownership check */
  currentUserId?: number | null;
  /** Current user's project role — for tag removal ownership check */
  userRole?: string | null;
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
  currentUserId,
  userRole,
  error,
  onDismissError,
}: AnnotationTopToolBarProps) {
  const dimensions =
    image.width && image.height ? `(${image.width} × ${image.height})` : null;

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b bg-card px-3">
      {/* Left: prev btn + image info + next btn */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={prevImageId == null || imagesLoading}
              onClick={() => prevImageId != null && onNavigate(prevImageId)}
              className="inline-flex items-center justify-center rounded p-0.5 hover:bg-muted hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Previous image</p>
          </TooltipContent>
        </Tooltip>

        <span className="font-medium text-foreground">{image.file_name}<span className="ml-1 text-muted-foreground tabular-nums">#{image.id}</span></span>
        {dimensions && (
          <span className="text-muted-foreground">{dimensions}</span>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={nextImageId == null || imagesLoading}
              onClick={() => nextImageId != null && onNavigate(nextImageId)}
              className="inline-flex items-center justify-center rounded p-0.5 hover:bg-muted hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Next image</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Right: tags + error dismiss */}
      <div className="flex items-center gap-3">
        <ImageTagBar
          imageTags={imageTags}
          projectTags={projectTags}
          onApplyTag={onApplyTag}
          onRemoveTag={onRemoveTag}
          currentUserId={currentUserId}
          userRole={userRole}
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
