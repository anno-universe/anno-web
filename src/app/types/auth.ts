export interface TokenObtainPairInput {
  username: string;
  password: string;
}

export interface TokenObtainPairOutput {
  username: string;
  access: string;
  refresh: string;
}

export interface TokenRefreshInput {
  refresh: string;
}

export interface TokenRefreshOutput {
  access: string | null;
  refresh: string;
}

export interface TokenVerifyInput {
  token: string;
}
