import { apiPost } from "./client";
import type {
  TokenObtainPairInput,
  TokenObtainPairOutput,
  TokenRefreshInput,
  TokenRefreshOutput,
} from "@/types/auth";

export function postTokenPair(
  input: TokenObtainPairInput
): Promise<TokenObtainPairOutput> {
  return apiPost<TokenObtainPairOutput>("/api/token/pair", input);
}

export function postTokenRefresh(
  input: TokenRefreshInput
): Promise<TokenRefreshOutput> {
  return apiPost<TokenRefreshOutput>("/api/token/refresh", input);
}
