import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { apiGet } from "./client";
import { tokenStorage } from "@/lib/auth/tokenStorage";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  tokenStorage.setTokens("expired-access", "valid-refresh", "tester");
});

describe("API token refresh", () => {
  it("shares one refresh request across concurrent 401 responses", async () => {
    let refreshCount = 0;

    server.use(
      http.get("/api/resource/:id", ({ request, params }) => {
        if (request.headers.get("authorization") !== "Bearer fresh-access") {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({ id: Number(params.id) });
      }),
      http.post("/api/token/refresh", async () => {
        refreshCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({
          access: "fresh-access",
          refresh: "next-refresh",
        });
      })
    );

    const results = await Promise.all([
      apiGet<{ id: number }>("/api/resource/1"),
      apiGet<{ id: number }>("/api/resource/2"),
      apiGet<{ id: number }>("/api/resource/3"),
    ]);

    expect(results.map((result) => result.id)).toEqual([1, 2, 3]);
    expect(refreshCount).toBe(1);
    expect(tokenStorage.getAccessToken()).toBe("fresh-access");
  });

  it("rejects every waiting request when the shared refresh fails", async () => {
    let refreshCount = 0;
    window.history.replaceState(null, "", "/login");

    server.use(
      http.get("/api/resource/:id", () => new HttpResponse(null, { status: 401 })),
      http.post("/api/token/refresh", () => {
        refreshCount += 1;
        return HttpResponse.json({ detail: "expired" }, { status: 401 });
      })
    );

    const results = await Promise.allSettled([
      apiGet("/api/resource/1"),
      apiGet("/api/resource/2"),
      apiGet("/api/resource/3"),
    ]);

    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(refreshCount).toBe(1);
    expect(tokenStorage.getAccessToken()).toBeNull();
  });
});
