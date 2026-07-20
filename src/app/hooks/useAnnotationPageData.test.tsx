import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAnnotationPageData } from "./useAnnotationPageData";
import { getProject } from "@/api/projects";
import { getImage } from "@/api/images";
import { getAnnotations } from "@/api/annotations";
import { getOperations } from "@/api/operations";
import { getImageTags, getProjectTags } from "@/api/tags";

vi.mock("@/api/projects", () => ({ getProject: vi.fn() }));
vi.mock("@/api/images", () => ({ getImage: vi.fn() }));
vi.mock("@/api/annotations", () => ({ getAnnotations: vi.fn() }));
vi.mock("@/api/operations", () => ({ getOperations: vi.fn() }));
vi.mock("@/api/tags", () => ({
  getImageTags: vi.fn(),
  getProjectTags: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("useAnnotationPageData", () => {
  beforeEach(() => {
    vi.mocked(getProject).mockResolvedValue({ id: 1, name: "Project" } as never);
    vi.mocked(getOperations).mockResolvedValue({ items: [] } as never);
    vi.mocked(getProjectTags).mockResolvedValue({ items: [] } as never);
    vi.mocked(getImageTags).mockResolvedValue([]);
  });

  it("does not commit the previous image response after navigation", async () => {
    const firstImage = deferred<never>();
    const secondImage = deferred<never>();
    const firstAnnotations = deferred<never>();
    const secondAnnotations = deferred<never>();

    vi.mocked(getImage)
      .mockReturnValueOnce(firstImage.promise)
      .mockReturnValueOnce(secondImage.promise);
    vi.mocked(getAnnotations)
      .mockReturnValueOnce(firstAnnotations.promise)
      .mockReturnValueOnce(secondAnnotations.promise);

    const { result, rerender } = renderHook(
      ({ imageId }) => useAnnotationPageData(1, imageId),
      { initialProps: { imageId: 1 } }
    );
    rerender({ imageId: 2 });

    secondImage.resolve({ id: 2, file_name: "second.png" } as never);
    secondAnnotations.resolve({ items: [{ id: 20 }] } as never);

    await waitFor(() => expect(result.current.image?.id).toBe(2));

    firstImage.resolve({ id: 1, file_name: "first.png" } as never);
    firstAnnotations.resolve({ items: [{ id: 10 }] } as never);
    await Promise.resolve();

    expect(result.current.image?.id).toBe(2);
    expect(result.current.annotations.map((annotation) => annotation.id)).toEqual([20]);
  });
});
