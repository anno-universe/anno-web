export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    list: (limit: number, offset: number) =>
      ["projects", "list", { limit, offset }] as const,
    detail: (projectId: number) => ["projects", "detail", projectId] as const,
  },
  images: {
    list: (
      projectId: number,
      params: { limit: number; offset: number; tags: string[] }
    ) => ["projects", projectId, "images", params] as const,
    tags: (projectId: number) => ["projects", projectId, "tags", "active"] as const,
  },
  inference: {
    runs: (projectId: number, limit: number, offset: number) =>
      ["projects", projectId, "inference-runs", { limit, offset }] as const,
    run: (projectId: number, runId: number) =>
      ["projects", projectId, "inference-runs", runId] as const,
    providers: (projectId: number) =>
      ["projects", projectId, "inference-providers"] as const,
  },
  exports: {
    list: (projectId: number, limit: number, offset: number) =>
      ["projects", projectId, "exports", { limit, offset }] as const,
  },
};
