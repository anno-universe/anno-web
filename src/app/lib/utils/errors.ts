import type { ApiError } from "@/types/api";

export function normalizeError(error: unknown): ApiError {
  if (error && typeof error === "object" && "response" in error) {
    const axiosErr = error as {
      response?: {
        status?: number;
        data?: Record<string, unknown>;
      };
      message?: string;
    };
    const status = axiosErr.response?.status ?? 0;
    const data = axiosErr.response?.data;
    return {
      status,
      message:
        (data?.detail as string) ||
        (data?.message as string) ||
        (data?.error as string) ||
        axiosErr.message ||
        "An error occurred",
      detail: data?.detail as string | undefined,
      fields: data?.fields as Record<string, string> | undefined,
    };
  }

  if (error instanceof Error) {
    return { status: 0, message: error.message };
  }

  return { status: 0, message: "An unknown error occurred" };
}
