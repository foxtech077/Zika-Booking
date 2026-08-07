import { z } from "zod";

// ── Password rule (BR-1.3) ───────────────────────────────────────────────────
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// ── Registration ─────────────────────────────────────────────────────────────
export const registerSchema = z
  .object({
    firstName: z.string().min(1, "First name is required").max(100),
    lastName: z.string().min(1, "Last name is required").max(100),
    email: z.string().email("Please enter a valid email address").toLowerCase(),
    password: passwordSchema,
    confirmPassword: z.string(),
    businessName: z.string().min(1, "Business name is required").max(255).optional(),
    phone: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/, "Phone number must be in international format (e.g. +254712345678)")
      .optional()
      .or(z.literal("")),
    country: z
      .string()
      .length(2, "Please select your country")
      .toUpperCase()
      .optional(),
    acceptedTerms: z.boolean().optional(),
    acceptedPrivacy: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// ── Login ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ── Resend verification ───────────────────────────────────────────────────────
export const resendVerificationSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

// ── Forgot password ───────────────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address").toLowerCase(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ── Reset password ────────────────────────────────────────────────────────────
export const resetPasswordSchema = z
  .object({
    token: z.string().length(64, "Invalid token"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ── Google OAuth ──────────────────────────────────────────────────────────────
export const googleOAuthSchema = z.object({
  idToken: z.string().min(1),
  businessName: z.string().max(255).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone must be in international format")
    .optional(),
});

export type GoogleOAuthInput = z.infer<typeof googleOAuthSchema>;

// ── Apple OAuth ───────────────────────────────────────────────────────────────
export const appleOAuthSchema = z.object({
  authorizationCode: z.string().min(1),
  identityToken: z.string().min(1),
  businessName: z.string().max(255).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone must be in international format")
    .optional(),
});

export type AppleOAuthInput = z.infer<typeof appleOAuthSchema>;

// ── Admin login ───────────────────────────────────────────────────────────────
export const adminLoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

// ── TOTP ──────────────────────────────────────────────────────────────────────
export const totpCodeSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be numeric"),
});

export type TotpCodeInput = z.infer<typeof totpCodeSchema>;

export const recoveryCodeSchema = z.object({
  code: z.string().min(1),
});

export type RecoveryCodeInput = z.infer<typeof recoveryCodeSchema>;
