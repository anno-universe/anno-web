import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ImagesPage from "./_app.projects.$projectId.images._index";
import type { ProjectContext } from "./_app.projects.$projectId";
import { getImages } from "@/api/images";
import { getProjectTags } from "@/api/tags";
import type { PaginatedResponse } from "@/types/api";
import type { Image2DOutput } from "@/types/image";
import type { ProjectOutput } from "@/types/project";
import type { TagOutput } from "@/types/tag";

vi.mock("@/api/images", () => ({
  getImages: vi.fn(),
  getThumbnailUrl: vi.fn(() => "http://thumb.test/x.png"),
}));
vi.mock("@/api/tags", () => ({
  getProjectTags: vi.fn(),
}));
// The real component fetches an authed blob; stub it so rows render without network.
vi.mock("@/components/image/AuthenticatedImage", () => ({
  AuthenticatedImage: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));

const supervisorProject = {
  id: 1,
  my_role: "supervisor",
} as unknown as ProjectOutput;

const fooTag: TagOutput = {
  id: 1,
  project_id: 1,
  name: "foo",
  display_name: "Foo",
  color: "#3366cc",
  description: "",
  is_active: true,
  created_by_id: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function imagesResponse(
  items: Image2DOutput[],
  count: number,
): PaginatedResponse<Image2DOutput> {
  return { items, count, limit: 20, offset: 0 };
}

function renderPage(initialEntry: string, tags: TagOutput[] = []) {
  vi.mocked(getProjectTags).mockResolvedValue({
    items: tags,
    count: tags.length,
    limit: 200,
    offset: 0,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ctx: ProjectContext = {
    project: supervisorProject,
    refreshProject: () => {},
  };
  const router = createMemoryRouter(
    [
      {
        path: "/projects/:projectId",
        element: <Outlet context={ctx} />,
        children: [{ path: "images", element: <ImagesPage /> }],
      },
    ],
    { initialEntries: [initialEntry] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => cleanup());

describe("ImagesPage empty states", () => {
  it("shows the upload prompt when the project has no images and no tag filter", async () => {
    vi.mocked(getImages).mockResolvedValue(imagesResponse([], 0));

    renderPage("/projects/1/images");

    expect(await screen.findByText("No images yet")).toBeInTheDocument();
    expect(screen.queryByText("No items to display.")).not.toBeInTheDocument();
  });

  it("shows an empty list (not the upload prompt) when a tag filter matches no images", async () => {
    vi.mocked(getImages).mockResolvedValue(imagesResponse([], 0));

    renderPage("/projects/1/images?tag=foo", [fooTag]);

    // Empty list comes from PaginatedTable, not the "No images yet" upload card.
    expect(await screen.findByText("No items to display.")).toBeInTheDocument();
    expect(screen.queryByText("No images yet")).not.toBeInTheDocument();
    // The header upload action and the tag chip both stay available.
    expect(screen.getByText("Upload Images")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Foo" })).toBeInTheDocument();
  });

  it("renders image rows when images exist", async () => {
    const image = {
      id: 5,
      project_id: 1,
      file_name: "cat.png",
      width: 100,
      height: 80,
      annotation_count: 0,
      tags: [],
    } as unknown as Image2DOutput;
    vi.mocked(getImages).mockResolvedValue(imagesResponse([image], 1));

    renderPage("/projects/1/images");

    expect(
      await screen.findByRole("button", { name: /Annotate/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No images yet")).not.toBeInTheDocument();
    expect(screen.queryByText("No items to display.")).not.toBeInTheDocument();
  });
});
