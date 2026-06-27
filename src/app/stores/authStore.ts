import { create } from "zustand";
import type { UserProfile } from "@/types/user";
import { tokenStorage } from "@/lib/auth/tokenStorage";
import { postTokenPair, postTokenRefresh } from "@/api/auth";
import { getMe, postRegister } from "@/api/users";

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (username: string, password: string) => {
    const tokens = await postTokenPair({ username, password });
    tokenStorage.setTokens(tokens.access, tokens.refresh, tokens.username);

    // Fetch user profile
    try {
      const user = await getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // If getMe fails, still set tokens (user can re-auth)
      set({ isAuthenticated: true, isLoading: false });
    }
  },

  register: async (username: string, email: string, password: string) => {
    await postRegister({ username, email, password });
    // After registration, log in automatically
    const tokens = await postTokenPair({ username, password });
    tokenStorage.setTokens(tokens.access, tokens.refresh, tokens.username);
    const user = await getMe();
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    tokenStorage.clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  initialize: async () => {
    const access = tokenStorage.getAccessToken();
    if (!access) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const user = await getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // Try refresh
      const refresh = tokenStorage.getRefreshToken();
      if (!refresh) {
        tokenStorage.clearTokens();
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      try {
        const tokens = await postTokenRefresh({ refresh });
        if (!tokens.access) {
          throw new Error("Refresh expired");
        }
        const username = tokenStorage.getUsername() || "";
        tokenStorage.setTokens(tokens.access, tokens.refresh, username);
        const user = await getMe();
        set({ user, isAuthenticated: true, isLoading: false });
      } catch {
        tokenStorage.clearTokens();
        set({ isLoading: false, isAuthenticated: false });
      }
    }
  },
}));
