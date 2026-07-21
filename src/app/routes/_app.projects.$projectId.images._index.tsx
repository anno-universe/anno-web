import { useEffect, useCallback } from "react";
import { Link, useParams, useOutletContext, useNavigate, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getImages } from "@/api/images";
import { getProjectTags } from "@/api/tags";
import { AuthenticatedImage } from "@/components/image/AuthenticatedImage";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTableWithThumbs } from "@/components/shared/SkeletonTable";
import {
  PaginatedTable,
  type Column,
} from "@/components/shared/PaginatedTable";
import { getThumbnailUrl } from "@/api/images";
import { Upload, PenTool } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import type { Image2DOutput } from "@/types/image";
import type { ProjectContext } from "./_app.projects.$projectId";

const DEFAULT_LIMIT = 20;

function imageColumns(
  projectId: number,
  onAnnotate: (imageId: number) => void,
): Column<Image2DOutput>[] {
  return [
    {
      key: "thumbnail",
      header: "",
      className: "w-20",
      render: (img) => (
        <div className="h-12 w-16 overflow-hidden rounded border bg-muted">
          <AuthenticatedImage
            src={getThumbnailUrl(projectId, img.id, 120, 90)}
            alt={img.file_name}
            className="h-full w-full object-cover"
          />
        </div>
      ),
    },
    {
      key: "file_name",
      header: "Filename",
      render: (img) => (
        <Link
          to={`/projects/${projectId}/images/${img.id}/annotate`}
          className="font-medium text-foreground hover:text-primary hover:underline"
        >
          {img.file_name}<span className="ml-1 text-muted-foreground tabular-nums">#{img.id}</span>
        </Link>
      ),
    },
    {
      key: "dimensions",
      header: "Dimensions",
      className: "w-36 text-muted-foreground",
      render: (img) =>
        img.width && img.height ? `${img.width} × ${img.height}` : "—",
    },
    {
      key: "annotations",
      header: "Annotations",
      className: "w-28 text-center",
      render: (img) => (
        <span className="text-sm tabular-nums">{img.annotation_count ?? 0}</span>
      ),
    },
    {
      key: "tags",
      header: "Tags",
      className: "w-44",
      render: (img) =>
        img.tags && img.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {img.tags.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-tight"
                style={{
                  borderColor: t.tag_color,
                  backgroundColor: `${t.tag_color}18`,
                  color: t.tag_color,
                }}
              >
                {t.tag_display_name || t.tag_name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "w-28",
      render: (img) => (
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => onAnnotate(img.id)}
        >
          <PenTool className="size-3" />
          Annotate
        </Button>
      ),
    },
  ];
}

export default function ImagesPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const navigate = useNavigate();
  const { project } = useOutletContext<ProjectContext>();

  // Derive pagination + tag filter from URL search params
  const [searchParams, setSearchParams] = useSearchParams();
  const offset =
    parseInt(searchParams.get("offset") || "0", 10) || 0;
  const limit =
    parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) ||
    DEFAULT_LIMIT;
  const tagFilter = (searchParams.get("tag") || "")
    .split(",")
    .filter(Boolean);

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  const imagesQuery = useQuery({
    queryKey: queryKeys.images.list(pid, { limit, offset, tags: tagFilter }),
    queryFn: ({ signal }) => {
      const params: Record<string, unknown> = { limit, offset };
      if (tagFilter.length > 0) params.tag = tagFilter.join(",");
      return getImages(pid, params, { signal });
    },
    placeholderData: keepPreviousData,
  });

  const tagsQuery = useQuery({
    queryKey: queryKeys.images.tags(pid),
    queryFn: ({ signal }) =>
      getProjectTags(pid, { limit: 200, is_active: true }, { signal }),
  });

  const images = imagesQuery.data?.items ?? [];
  const count = imagesQuery.data?.count ?? 0;
  const serverLimit = imagesQuery.data?.limit ?? limit;
  const serverOffset = imagesQuery.data?.offset ?? offset;
  const projectTags = tagsQuery.data?.items ?? [];

  const handleAnnotate = useCallback(
    (imageId: number) => {
      navigate(`/projects/${pid}/images/${imageId}/annotate`);
    },
    [navigate, pid],
  );

  // Persist search params so the breadcrumb "Images" link can restore them
  useEffect(() => {
    const qs = searchParams.toString();
    if (qs) {
      sessionStorage.setItem(`images_search_${pid}`, qs);
    } else {
      sessionStorage.removeItem(`images_search_${pid}`);
    }
  }, [pid, searchParams]);

  function handlePageChange(newOffset: number, newLimit: number) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("offset", String(newOffset));
        next.set("limit", String(newLimit));
        return next;
      },
      { replace: true },
    );
  }

  if (imagesQuery.isPending) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <SkeletonTableWithThumbs rows={6} />
      </div>
    );
  }

  if (imagesQuery.isError && images.length === 0) {
    return (
      <ErrorAlert
        message={imagesQuery.error.message}
        onRetry={() => imagesQuery.refetch()}
      />
    );
  }

  return (
    <div>
      {/* Tag filter — multi-select toggle chips */}
      {projectTags.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">
            Filter by tag:
          </span>
          {projectTags.map((tag) => {
            const selected = tagFilter.includes(tag.name);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  setSearchParams(
                    (prev) => {
                      const next = new URLSearchParams(prev);
                      const current = (next.get("tag") || "")
                        .split(",")
                        .filter(Boolean);
                      if (selected) {
                        const updated = current.filter(
                          (t) => t !== tag.name,
                        );
                        if (updated.length > 0) {
                          next.set("tag", updated.join(","));
                        } else {
                          next.delete("tag");
                        }
                      } else {
                        next.set(
                          "tag",
                          [...current, tag.name].join(","),
                        );
                      }
                      next.delete("offset"); // reset to first page
                      return next;
                    },
                    { replace: true },
                  );
                }}
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  selected
                    ? "border-transparent text-white"
                    : "border-input bg-background text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
                style={
                  selected
                    ? { backgroundColor: tag.color, borderColor: tag.color }
                    : undefined
                }
              >
                {tag.display_name || tag.name}
              </button>
            );
          })}
          {tagFilter.length > 0 && (
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={() => {
                setSearchParams(
                  (prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete("tag");
                    next.delete("offset");
                    return next;
                  },
                  { replace: true },
                );
              }}
              className="ml-1 text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {count} {count === 1 ? "image" : "images"}
        </p>
        {isSupervisor && (
          <Link
            to={`/projects/${pid}/upload`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Images
          </Link>
        )}
      </div>

      {!imagesQuery.isFetching && count === 0 && tagFilter.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No images yet</EmptyTitle>
            <EmptyDescription>
              {isSupervisor
                ? "Upload images to start annotating."
                : "Ask a supervisor to upload images to annotate."}
            </EmptyDescription>
          </EmptyHeader>
          {isSupervisor && (
            <EmptyContent>
              <Button asChild>
                <Link to={`/projects/${pid}/upload`}>Upload images</Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <PaginatedTable
          columns={imageColumns(pid, handleAnnotate)}
          rows={images}
          pagination={{ count, limit: serverLimit, offset: serverOffset }}
          onPageChange={handlePageChange}
          isLoading={imagesQuery.isFetching}
          getRowKey={(img) => img.id}
        />
      )}
    </div>
  );
}
