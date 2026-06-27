import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useOutletContext, useNavigate } from "react-router";
import { getImages } from "@/api/images";
import { AuthenticatedImage } from "@/components/image/AuthenticatedImage";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  PaginatedTable,
  type Column,
  type PaginationState,
} from "@/components/shared/PaginatedTable";
import { getThumbnailUrl } from "@/api/images";
import { Upload } from "lucide-react";
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
          {img.file_name}
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
      key: "actions",
      header: "",
      className: "w-24",
      render: (img) => (
        <button
          type="button"
          onClick={() => onAnnotate(img.id)}
          className="cursor-pointer rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Annotate
        </button>
      ),
    },
  ];
}

export default function ImagesPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const navigate = useNavigate();
  const { project } = useOutletContext<ProjectContext>();

  const [images, setImages] = useState<Image2DOutput[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    count: 0,
    limit: DEFAULT_LIMIT,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  const handleAnnotate = useCallback(
    (imageId: number) => {
      navigate(`/projects/${pid}/images/${imageId}/annotate`);
    },
    [navigate, pid],
  );

  async function fetchImages(limit: number, offset: number) {
    setLoading(true);
    setError("");
    try {
      const imageData = await getImages(pid, { limit, offset });
      setImages(imageData.items);
      setPagination({
        count: imageData.count,
        limit: imageData.limit,
        offset: imageData.offset,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load images");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchImages(DEFAULT_LIMIT, 0);
  }, [pid]);

  function handlePageChange(offset: number, limit: number) {
    fetchImages(limit, offset);
  }

  if (loading && images.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && images.length === 0) {
    return (
      <ErrorAlert
        message={error}
        onRetry={() => fetchImages(pagination.limit, pagination.offset)}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pagination.count} {pagination.count === 1 ? "image" : "images"}
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

      {!loading && pagination.count === 0 ? (
        <EmptyState message="No images yet." />
      ) : (
        <PaginatedTable
          columns={imageColumns(pid, handleAnnotate)}
          rows={images}
          pagination={pagination}
          onPageChange={handlePageChange}
          isLoading={loading}
          getRowKey={(img) => img.id}
        />
      )}
    </div>
  );
}
