const ACCESS_KEY = "anno_access";
const REFRESH_KEY = "anno_refresh";
const USERNAME_KEY = "anno_username";

export const tokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },

  getUsername(): string | null {
    return localStorage.getItem(USERNAME_KEY);
  },

  setTokens(access: string, refresh: string, username: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USERNAME_KEY, username);
  },

  clearTokens(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USERNAME_KEY);
  },
};
