import { Link, useMatches, useLocation } from "react-router";
import { ChevronRight } from "lucide-react";
import { useBreadcrumbContext } from "@/lib/breadcrumb";

export interface BreadcrumbHandle {
  /** Static label for this route segment. */
  breadcrumb?: string;
  /** Key into the dynamic breadcrumb context. When set, the resolved label
   *  comes from `useSetBreadcrumb(dynamicKey, label)`. */
  dynamicKey?: string;
}

interface BreadcrumbItem {
  label: string;
  path: string;
  isLast: boolean;
}

export function Breadcrumbs() {
  const matches = useMatches();
  const { pathname } = useLocation();
  const { labels } = useBreadcrumbContext();

  const items: BreadcrumbItem[] = [];

  // Synthetic "Projects" link for all project-scoped pages.
  if (pathname.startsWith("/projects/")) {
    items.push({ label: "Projects", path: "/projects", isLast: false });
  }

  // Find the annotate match (flat route) so we can insert missing
  // intermediate segments that aren't in the match tree.
  const annotateMatch = matches.find((m) => {
    const h = m.handle as BreadcrumbHandle | undefined;
    return h?.dynamicKey === "image";
  });

  // Insert synthetic project + Images segments for flat annotate routes.
  if (annotateMatch) {
    const { projectId } = annotateMatch.params;
    if (projectId) {
      const projectLabel =
        labels["project"] || "Project";
      items.push({
        label: projectLabel,
        path: `/projects/${projectId}`,
        isLast: false,
      });
      const savedSearch = sessionStorage.getItem(
        `images_search_${projectId}`,
      );
      items.push({
        label: "Images",
        path: savedSearch
          ? `/projects/${projectId}/images?${savedSearch}`
          : `/projects/${projectId}/images`,
        isLast: false,
      });
    }
  }

  // Build from route matches — filter to routes that contribute a breadcrumb.
  const contributing = matches.filter((m) => {
    const h = m.handle as BreadcrumbHandle | undefined;
    return h?.breadcrumb || h?.dynamicKey;
  });

  for (const match of contributing) {
    const handle = match.handle as BreadcrumbHandle | undefined;
    const isLast =
      match.pathname === pathname &&
      match === contributing[contributing.length - 1];

    // Resolve label: dynamic context → static handle → fallback
    let label = "";
    if (handle?.dynamicKey && labels[handle.dynamicKey]) {
      label = labels[handle.dynamicKey];
    } else if (handle?.breadcrumb) {
      label = handle.breadcrumb;
    } else if (handle?.dynamicKey === "project" && match.params.projectId) {
      label = "Project";
    } else if (handle?.dynamicKey === "image" && match.params.imageId) {
      label = "Image";
    } else {
      label = "...";
    }

    items.push({ label, path: match.pathname, isLast });
  }

  // Only render when there's a meaningful hierarchy (2+ levels).
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex h-8 shrink-0 items-center gap-1.5 border-b bg-card px-4 text-xs text-muted-foreground"
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3 w-3 text-border" />}
          {item.isLast ? (
            <span className="font-medium text-foreground">{item.label}</span>
          ) : (
            <Link
              to={item.path}
              className="hover:text-foreground hover:underline transition-colors"
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
