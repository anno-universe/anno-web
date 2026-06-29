import axios from "axios";
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

// ---- Refresh queue ----
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
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
    const originalRequest = error.config;

    // Don't retry if it's already a refresh request
    if (originalRequest?.url?.includes("/api/token/refresh")) {
      tokenStorage.clearTokens();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    // Only handle 401
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Queue concurrent requests while refreshing
    if (isRefreshing) {
      return new Promise((resolve) => {
        addRefreshSubscriber((token: string) => {
          originalRequest.headers["Authorization"] = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const { data } = await axios.post<TokenRefreshOutput>(
        `${BASE_URL}/api/token/refresh`,
        { refresh: refreshToken }
      );

      // access can be null when refresh is also expired
      if (!data.access) {
        throw new Error("Refresh token expired");
      }

      const username =
        tokenStorage.getUsername() || "";

      tokenStorage.setTokens(data.access, data.refresh, username);

      isRefreshing = false;
      onRefreshed(data.access);

      originalRequest.headers["Authorization"] = `Bearer ${data.access}`;
      return api(originalRequest);
    } catch (refreshError) {
      isRefreshing = false;
      refreshSubscribers = [];
      tokenStorage.clearTokens();
      window.location.href = "/login";
      return Promise.reject(refreshError);
    }
  }
);

// ---- Typed helpers ----

export async function apiGet<T>(
  url: string,
  params?: Record<string, unknown>
): Promise<T> {
  const { data } = await api.get<T>(url, { params });
  return data;
}

export async function apiPost<T>(
  url: string,
  body?: unknown
): Promise<T> {
  const { data } = await api.post<T>(url, body);
  return data;
}

export async function apiPatch<T>(
  url: string,
  body?: unknown
): Promise<T> {
  const { data } = await api.patch<T>(url, body);
  return data;
}

export async function apiDelete(url: string): Promise<void> {
  await api.delete(url);
}

export async function apiGetBlob(url: string): Promise<Blob> {
  const { data } = await api.get<Blob>(url, {
    responseType: "blob",
  });
  return data;
}

export async function apiPostForm<T>(
  url: string,
  formData: FormData
): Promise<T> {
  const { data } = await api.post<T>(url, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
