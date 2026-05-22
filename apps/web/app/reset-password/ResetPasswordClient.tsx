"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { api, storeToken } from "@/lib/api";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import type { ApiResponse, AuthResponse } from "@zika/types";

type FieldErrors = { password?: string; confirmPassword?: string; general?: string };

export function ResetPasswordClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<FieldErrors>({});

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined, general: undefined }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<AuthResponse & { message: string }>>("/auth/reset-password", { token, ...form });
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: (data) => {
      storeToken(data.tokens.accessToken);
      router.replace(data.user.userType === "provider" ? "/listings" : "/traveller");
    },
    onError: (err: unknown) => {
      const e = (err as { error?: { code?: string; message?: string; fields?: FieldErrors } }).error;
      if (e?.code === "TOKEN_EXPIRED") setErrors({ general: "This password reset link has expired. Please request a new one." });
      else if (e?.code === "TOKEN_USED") setErrors({ general: "This reset link has already been used." });
      else if (e?.fields) setErrors(e.fields);
      else setErrors({ general: e?.message ?? "Something went wrong." });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) { setErrors({ password: "Password must be at least 8 characters." }); return; }
    if (form.password !== form.confirmPassword) { setErrors({ confirmPassword: "Passwords do not match." }); return; }
    mutation.mutate();
  }

  if (!token) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">❌</div>
        <h1 className="text-xl font-bold mb-2">Invalid link</h1>
        <p className="text-gray-500 mb-4">This password reset link is invalid.</p>
        <Link href="/auth/forgot-password" className="text-primary font-semibold">Request a new link</Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Set new password</h1>
      <p className="text-sm text-gray-500 mb-6">Choose a strong password for your account.</p>

      <form onSubmit={handleSubmit} noValidate>
        <FormField label="New password" type="password" value={form.password} onChange={set("password")} error={errors.password} placeholder="Min. 8 characters" autoComplete="new-password" />
        <FormField label="Confirm new password" type="password" value={form.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} placeholder="Repeat password" autoComplete="new-password" />

        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-red-600 text-sm">{errors.general}</p>
            {errors.general.includes("expired") && (
              <Link href="/auth/forgot-password" className="text-primary text-sm font-semibold mt-1 block">Request a new link →</Link>
            )}
          </div>
        )}

        <Button type="submit" loading={mutation.isPending} className="w-full">Set new password</Button>
      </form>
    </div>
  );
}
