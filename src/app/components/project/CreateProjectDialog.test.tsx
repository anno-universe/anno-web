import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { createProject } from "@/api/projects";
import { queryKeys } from "@/lib/queryKeys";
import type { PaginatedResponse } from "@/types/api";
import type { ProjectOutput } from "@/types/project";

vi.mock("@/api/projects", () => ({
  createProject: vi.fn(),
}));
// The label/annotation editors pull in radix widgets that need browser APIs
// jsdom lacks; this test only cares about the create → invalidate wiring.
vi.mock("./LabelMappingEditor", () => ({
  LabelMappingEditor: () => <div data-testid="label-mapping-editor" />,
}));
vi.mock("./AnnotationSettings", () => ({
  AnnotationSettings: () => <div data-testid="annotation-settings" />,
}));

const LIST_KEY = queryKeys.projects.list(20, 0);

function renderDialog(queryClient: QueryClient) {
  const router = createMemoryRouter(
    [
      { path: "/", element: <CreateProjectDialog open onClose={() => {}} /> },
      { path: "/projects/:id", element: <div>project detail</div> },
    ],
    { initialEntries: ["/"] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => cleanup());

describe("CreateProjectDialog cache invalidation", () => {
  it("invalidates the cached projects list after creating a project", async () => {
    const queryClient = new QueryClient({
      // Mirror production: a freshly fetched list stays fresh for 15s, so only
      // explicit invalidation — not staleness — can force the next refetch.
      defaultOptions: { queries: { retry: false, staleTime: 15_000 } },
    });
    // Seed a fresh /projects list cache entry, as if the page had been visited.
    queryClient.setQueryData<PaginatedResponse<ProjectOutput>>(LIST_KEY, {
      items: [],
      count: 0,
      limit: 20,
      offset: 0,
    });
    expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(false);

    vi.mocked(createProject).mockResolvedValue({ id: 42 } as ProjectOutput);

    renderDialog(queryClient);

    const nameInput = document.querySelector("#pname") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "My Project" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    // The list query is marked stale, so back-navigation will refetch it.
    await waitFor(() => {
      expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
    });
    expect(createProject).toHaveBeenCalledOnce();
  });
});
