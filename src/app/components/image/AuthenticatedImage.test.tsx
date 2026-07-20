import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedImage } from "./AuthenticatedImage";
import { apiGetBlob } from "@/api/client";

vi.mock("@/api/client", () => ({
  apiGetBlob: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("AuthenticatedImage", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((blob: Blob) => `blob:${blob.size}`),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("ignores a stale blob response after src changes", async () => {
    const first = deferred<Blob>();
    const second = deferred<Blob>();
    vi.mocked(apiGetBlob)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { rerender } = render(<AuthenticatedImage src="/first" alt="preview" />);
    rerender(<AuthenticatedImage src="/second" alt="preview" />);

    second.resolve(new Blob(["new"]));
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "blob:3"));

    first.resolve(new Blob(["old-image"]));
    await Promise.resolve();

    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:3");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
