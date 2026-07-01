import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getProjects } from "@/api/projects";
import { CreateProjectDialog } from "@/components/project/CreateProjectDialog";
import { ProjectRoleBadge } from "@/components/project/ProjectRoleBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  PaginatedTable,
  type Column,
  type PaginationState,
} from "@/components/shared/PaginatedTable";
import { formatRelativeTime } from "@/lib/utils/date";
import type { ProjectOutput } from "@/types/project";

const DEFAULT_LIMIT = 20;

const COLUMNS: Column<ProjectOutput>[] = [
  {
    key: "name",
    header: "Name",
    render: (p) => (
      <Link
        to={`/projects/${p.id}`}
        className="font-medium text-foreground hover:text-primary hover:underline"
      >
        {p.name}<span className="ml-1 text-muted-foreground tabular-nums">#{p.id}</span>
      </Link>
    ),
  },
  {
    key: "description",
    header: "Description",
    className: "max-w-xs truncate text-muted-foreground",
    render: (p) => (
      <span className="block max-w-xs truncate">
        {p.description || "—"}
      </span>
    ),
  },
  {
    key: "role",
    header: "Role",
    className: "w-28",
    render: (p) => <ProjectRoleBadge role={p.my_role} />,
  },
  {
    key: "updated",
    header: "Updated",
    className: "w-36 text-muted-foreground",
    render: (p) => formatRelativeTime(p.updated_at),
  },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectOutput[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    count: 0,
    limit: DEFAULT_LIMIT,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  async function fetchProjects(limit: number, offset: number) {
    setLoading(true);
    setError("");
    try {
      const data = await getProjects({ limit, offset });
      setProjects(data.items);
      setPagination({ count: data.count, limit: data.limit, offset: data.offset });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects(DEFAULT_LIMIT, 0);
  }, []);

  function handlePageChange(offset: number, limit: number) {
    fetchProjects(limit, offset);
  }

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && projects.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <ErrorAlert
          message={error}
          onRetry={() => fetchProjects(pagination.limit, pagination.offset)}
        />
      </div>
    );
  }

  if (!loading && pagination.count === 0) {
    return (
      <div className="py-20">
        <EmptyState
          message="No projects yet."
          action={{
            label: "Create your first project",
            onClick: () => setShowCreate(true),
          }}
        />
        <CreateProjectDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-foreground">Projects</h1>
        <Button onClick={() => setShowCreate(true)}>Create Project</Button>
      </div>

      <PaginatedTable
        columns={COLUMNS}
        rows={projects}
        pagination={pagination}
        onPageChange={handlePageChange}
        isLoading={loading}
        getRowKey={(p) => p.id}
      />

      <CreateProjectDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
