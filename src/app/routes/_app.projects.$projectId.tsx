import { useCallback, useEffect, useState } from "react";
import { Outlet, useParams, NavLink } from "react-router";
import { getProject } from "@/api/projects";
import { ProjectRoleBadge } from "@/components/project/ProjectRoleBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { useSetBreadcrumb } from "@/lib/breadcrumb";
import type { ProjectOutput } from "@/types/project";

export interface ProjectContext {
  project: ProjectOutput;
  refreshProject: () => void;
}

function tabClassName({ isActive }: { isActive: boolean }) {
  return isActive
    ? "rounded-md px-3 py-1.5 text-sm font-medium bg-muted text-foreground"
    : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted";
}

export default function ProjectLayout() {
  const { projectId } = useParams();
  const id = Number(projectId);

  const [project, setProject] = useState<ProjectOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getProject(id);
      setProject(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Register project name as a dynamic breadcrumb segment.
  useSetBreadcrumb("project", project?.name ?? null);

  // Only render Outlet when we have project data — children receive guaranteed project
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <ErrorAlert message={error} onRetry={fetchProject} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";
  const isWorker = project.my_role?.toLowerCase() === "worker";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {project.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <ProjectRoleBadge role={project.my_role} />
            {project.description && (
              <span className="text-sm text-muted-foreground">
                {project.description}
              </span>
            )}
          </div>
        </div>
      </div>

      {isWorker && (
        <div className="mb-6 rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          You are a worker in this project. You can annotate images but cannot
          modify project settings.
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-2 border-b pb-2 mb-6">
        <NavLink
          to={`/projects/${id}/images`}
          end
          className={tabClassName}
        >
          Images
        </NavLink>
        {isSupervisor && (
          <NavLink
            to={`/projects/${id}/members`}
            end
            className={tabClassName}
          >
            Members
          </NavLink>
        )}
        <NavLink
          to={`/projects/${id}/settings`}
          end
          className={tabClassName}
        >
          Settings
        </NavLink>
      </div>

      {/* Child content */}
      <Outlet context={{ project, refreshProject: fetchProject }} />
    </div>
  );
}
