import axios, { type AxiosRequestConfig } from "axios";
import { tokenStorage } from "@/lib/auth/tokenStorage";
import type { TokenRefreshOutput } from "@/types/auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Custom param serializer: arrays become repeated keys (tag=a&tag=b),
 * matching Django's `request.GET.getlist('tag')` convention.
 */
function paramsSerializer(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        parts.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`
        );
      }
    } else {
      parts.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
      );
    }
  }
  return parts.join("&");
}

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  paramsSerializer,
});

interface RetryableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string> | null = null;
let isRedirectingToLogin = false;

function redirectToLogin() {
  if (isRedirectingToLogin || window.location.pathname === "/login") return;
  isRedirectingToLogin = true;
  window.location.href = "/login";
}

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const { data } = await axios.post<TokenRefreshOutput>(
        `${BASE_URL}/api/token/refresh`,
        { refresh: refreshToken }
      );

      if (!data.access) {
        throw new Error("Refresh token expired");
      }

      tokenStorage.setTokens(
        data.access,
        data.refresh,
        tokenStorage.getUsername() || ""
      );
      return data.access;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

// ---- Request interceptor: attach access token ----
api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token && config.headers) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// ---- Response interceptor: handle 401 -> refresh ----
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    // Don't retry if it's already a refresh request
    if (originalRequest?.url?.includes("/api/token/refresh")) {
      tokenStorage.clearTokens();
      redirectToLogin();
      return Promise.reject(error);
    }

    // Only handle 401
    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const accessToken = await refreshAccessToken();
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers["Authorization"] = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      tokenStorage.clearTokens();
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  }
);

// ---- Typed helpers ----

export type ApiRequestOptions = Pick<AxiosRequestConfig, "signal">;

export async function apiGet<T>(
  url: string,
  params?: Record<string, unknown>,
  options?: ApiRequestOptions
): Promise<T> {
  const { data } = await api.get<T>(url, { params, ...options });
  return data;
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  const { data } = await api.post<T>(url, body, options);
  return data;
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  const { data } = await api.patch<T>(url, body, options);
  return data;
}

export async function apiDelete(
  url: string,
  options?: ApiRequestOptions
): Promise<void> {
  await api.delete(url, options);
}

export async function apiGetBlob(
  url: string,
  options?: ApiRequestOptions
): Promise<Blob> {
  const { data } = await api.get<Blob>(url, {
    responseType: "blob",
    ...options,
  });
  return data;
}

export async function apiPostForm<T>(
  url: string,
  formData: FormData,
  options?: ApiRequestOptions
): Promise<T> {
  const { data } = await api.post<T>(url, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    ...options,
  });
  return data;
}
