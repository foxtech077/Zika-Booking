import type { PublicUser, AdminUser } from "./user";

// ── Request payloads ─────────────────────────────────────────────────────────

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  userType: "guest" | "provider";
  businessName?: string;
  country?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface GoogleOAuthPayload {
  idToken: string;
  userType?: "guest" | "provider";
  businessName?: string;
  country?: string;
}

export interface AppleOAuthPayload {
  authorizationCode: string;
  identityToken: string;
  userType?: "guest" | "provider";
  businessName?: string;
  country?: string;
}

export interface AdminLoginPayload {
  email: string;
  password: string;
}

export interface TotpVerifyPayload {
  code: string;
}

export interface TotpSetupConfirmPayload {
  code: string;
}

export interface WebAuthnVerifyPayload {
  credential: unknown;
}

export interface WebAuthnRegisterPayload {
  credential: unknown;
}

// ── Response payloads ────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface AdminAuthResponse {
  admin: AdminUser;
  sessionToken: string;
}

export interface TotpSetupResponse {
  qrCodeUri: string;
  secret: string;
  recoveryCodes: string[];
}

export interface WebAuthnChallengeResponse {
  challenge: string;
  options: unknown;
}

// ── JWT payload shapes ───────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;        // userId
  type: "guest" | "provider";
  status: string;
  jti: string;        // JWT ID (unique per token)
  iat: number;
  exp: number;
}

export interface AdminIntermediatePayload {
  sub: string;        // adminUserId
  role: string;
  step: "awaiting_totp" | "awaiting_webauthn";
  iat: number;
  exp: number;
}

export interface AdminSessionPayload {
  sub: string;        // adminUserId
  role: string;
  sessionId: string;
  countryScope?: string[];
  iat: number;
  exp: number;
}
