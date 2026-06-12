"use client";

import { api } from "@/lib/api";
import type { ApiResponse, AuthResponse } from "@zika/types";

/**
 * Pure helper that talks to the backend and returns a normalized result.
 *
 * Returns an object:
 *   { success: true, data: AuthResponse }  – on a successful login
 *   { success: false, code?: string, message: string } – on any error
 *
 * The calling component decides how to route / display errors.
 */
export async function processGoogleLogin(
  idToken: string
): Promise<
  | { success: true; data: AuthResponse }
  | { success: false; code?: string; message: string; idToken: string }
> {
  try {
    const res = await api.post<ApiResponse<AuthResponse>>(
      "/auth/oauth/google",
      { idToken }
    );

    if (!res.data.success) {
      // Force the catch‑block to treat this as an error
      throw res.data;
    }

    return { success: true, data: res.data.data };
  } catch (err: any) {
    const backendError = err.response?.data?.error;
    const message = backendError?.message ?? "Sign in with Google failed. Please try again.";
    const code = backendError?.code;
    // Preserve the idToken so the component can forward it when needed
    return { success: false, code, message, idToken };
  }
}
