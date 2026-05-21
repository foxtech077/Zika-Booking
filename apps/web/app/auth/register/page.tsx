"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { registerSchema } from "@zika/validators";
import { api, storeToken } from "@/lib/api";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import type { ApiResponse, AuthResponse } from "@zika/types";

type UserType = "guest" | "provider";
type FieldErrors = Record<string, string | undefined> & { general?: string };

export default function RegisterPage() {
  const router = useRouter();
  const [userType, setUserType] = useState<UserType>("guest");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    password: "", confirmPassword: "",
    businessName: "", country: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        userType,
        businessName: userType === "provider" ? form.businessName : undefined,
        country: userType === "provider" ? form.country || undefined : undefined,
      };
      const res = await api.post<ApiResponse<{ message: string }>>("/auth/register", payload);
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: () => setSubmitted(true),
    onError: (err: any) => {
      const e = err.response?.data?.error;
      setErrors({ ...e?.fields, general: e?.fields ? undefined : e?.message });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      userType,
      businessName: userType === "provider" ? form.businessName : undefined,
      country: userType === "provider" ? form.country || undefined : undefined,
    };
    const result = registerSchema.safeParse(payload);
    if (!result.success) {
      const fe: FieldErrors = {};
      for (const issue of result.error.issues) {
        const k = String(issue.path[0]);
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    mutation.mutate();
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✉️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 mb-2">We've sent a verification link to</p>
          <p className="font-semibold text-gray-800 mb-6">{form.email}</p>
          <p className="text-sm text-gray-400 mb-6">Click the link in your email to activate your account. It expires in 24 hours.</p>
          <Link href="/auth/login" className="text-primary font-semibold">Back to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create account</h1>
        <p className="text-gray-500 text-sm mb-6">Join ZikaBooking and start exploring.</p>

        {/* Account type tabs */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-6">
          {(["guest", "provider"] as UserType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setUserType(t); setErrors({}); }}
              className={`flex-1 py-2.5 text-sm font-semibold transition ${userType === t ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {t === "guest" ? "Traveller" : "Provider / Host"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First name" value={form.firstName} onChange={set("firstName")} error={errors.firstName} placeholder="Ada" autoComplete="given-name" />
            <FormField label="Last name" value={form.lastName} onChange={set("lastName")} error={errors.lastName} placeholder="Okafor" autoComplete="family-name" />
          </div>

          <FormField label="Email address" type="email" value={form.email} onChange={set("email")} error={errors.email} placeholder="you@example.com" autoComplete="email" />

          {userType === "provider" && (
            <>
              <FormField label="Business name" value={form.businessName} onChange={set("businessName")} error={errors.businessName} placeholder="Serena Hotels Ltd." />
              <FormField label="Country (2-letter code, e.g. KE)" value={form.country} onChange={(e) => { setForm((p) => ({ ...p, country: e.target.value.toUpperCase() })); setErrors((p) => ({ ...p, country: undefined })); }}
                error={errors.country} placeholder="KE" maxLength={2} />
            </>
          )}

          <FormField label="Password" type="password" value={form.password} onChange={set("password")} error={errors.password} placeholder="Min. 8 characters" autoComplete="new-password" />
          <FormField label="Confirm password" type="password" value={form.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} placeholder="Repeat password" autoComplete="new-password" />

          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-600 text-sm">{errors.general}</p>
            </div>
          )}

          <Button type="submit" loading={mutation.isPending} className="w-full">Create Account</Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary font-semibold">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
