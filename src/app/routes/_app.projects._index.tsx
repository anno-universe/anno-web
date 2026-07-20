import { useState } from "react";
import { Link } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getProjects } from "@/api/projects";
import { CreateProjectDialog } from "@/components/project/CreateProjectDialog";
import { ProjectRoleBadge } from "@/components/project/ProjectRoleBadge";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import {
  PaginatedTable,
  type Column,
  type PaginationState,
} from "@/components/shared/PaginatedTable";
import { formatRelativeTime } from "@/lib/utils/date";
import { queryKeys } from "@/lib/queryKeys";
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
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(limit, offset),
    queryFn: ({ signal }) => getProjects({ limit, offset }, { signal }),
    placeholderData: keepPreviousData,
  });

  const projects = projectsQuery.data?.items ?? [];
  const pagination: PaginationState = {
    count: projectsQuery.data?.count ?? 0,
    limit: projectsQuery.data?.limit ?? limit,
    offset: projectsQuery.data?.offset ?? offset,
  };

  function handlePageChange(nextOffset: number, nextLimit: number) {
    setOffset(nextOffset);
    setLimit(nextLimit);
  }

  if (projectsQuery.isPending) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <SkeletonTable rows={6} />
      </div>
    );
  }

  if (projectsQuery.isError && projects.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <ErrorAlert
          message={projectsQuery.error.message}
          onRetry={() => projectsQuery.refetch()}
        />
      </div>
    );
  }

  if (!projectsQuery.isFetching && pagination.count === 0) {
    return (
      <div className="py-20">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>Create your first project to get started.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setShowCreate(true)}>Create your first project</Button>
          </EmptyContent>
        </Empty>
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
        isLoading={projectsQuery.isFetching}
        getRowKey={(p) => p.id}
      />

      <CreateProjectDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
