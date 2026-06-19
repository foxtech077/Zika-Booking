"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { registerSchema } from "@zika/validators";
import { api, storeToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { FormField } from "@/components/ui/FormField";
import type { ApiResponse, AuthResponse } from "@zika/types";

type UserType = "guest" | "provider";
type FieldErrors = Record<string, string | undefined> & { general?: string };

function InputIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
      {children}
    </span>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { setSession } = useAuthStore();
  const [userType, setUserType] = useState<UserType>("guest");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    password: "", confirmPassword: "",
    businessName: "", country: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const res = await api.post<ApiResponse<Partial<AuthResponse> & { message?: string }>>("/auth/auth/register", payload);
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: (data) => {
      if (data?.tokens?.accessToken && data.user) {
        storeToken(data.tokens.accessToken);
        setSession(data.tokens.accessToken, data.user as any);
        router.replace(data.user.userType === "provider" ? "/dashboard" : "/traveller");
        return;
      }
      setSubmitted(true);
    },
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

  /* ── Email-sent success state ── */
  if (submitted) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#d4edda] via-[#c3e6cb] to-[#a8d5b5] p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center animate-slide-in-up">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 text-sm mb-1">We&apos;ve sent a verification link to</p>
          <p className="font-semibold text-gray-800 mb-5">{form.email}</p>
          <p className="text-xs text-gray-400 mb-7 leading-relaxed">
            Click the link in your email to activate your account. It expires in 24 hours.
          </p>
          <Link
            href="/auth/login"
            className="inline-block w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl text-sm transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#d4edda] via-[#c3e6cb] to-[#a8d5b5] p-4 overflow-hidden">
      <div className="w-full max-w-5xl flex rounded-3xl overflow-hidden shadow-2xl" style={{ height: "min(680px, calc(100vh - 2rem))" }}>

        {/* ── Left Panel: Image ── */}
        <div className="relative hidden md:flex md:w-[45%] flex-col justify-between overflow-hidden rounded-l-3xl">
          <Image
            src="/images/Login.png"
            alt="Kainook city backdrop"
            fill
            priority
            className="object-cover"
            sizes="45vw"
          />
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/70" />

          {/* Top: Logo */}
          <div className="relative z-10 p-8 flex items-center gap-3">
            <Image
              src="/images/kainook-logo.jpeg"
              alt="Kainook Logo"
              width={50}
              height={50}
              className="rounded-2xl"
            />
            <span className="text-white font-bold text-xl tracking-wide">KAINOOK</span>
          </div>

          {/* Bottom: Welcome text + trust badge */}
          <div className="relative z-10 p-8 pb-10">
            <h2 className="text-white text-3xl font-bold leading-snug mb-2">
              Join Kainook!
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              Create your account and start<br />
              exploring with <span className="text-[#4ade80] font-semibold">Kainook.</span>
            </p>
            <div className="mt-8 flex items-center gap-2">
              <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <span className="text-white/70 text-xs">Your data is safe with us</span>
            </div>
          </div>
        </div>

        {/* ── Right Panel: Form ── */}
        <div className="flex-1 bg-white flex flex-col justify-center px-8 py-8 md:px-12 rounded-r-3xl rounded-l-3xl md:rounded-l-none overflow-y-auto">

          {/* Logo */}
          {/* <div className="flex flex-col items-center mb-3">
            <Image src="/images/kainook-logo.jpeg" alt="Kainook Logo" width={48} height={48} className="rounded-full mb-1" />
            <span className="font-bold text-xs text-primary tracking-widest">KAINOOK</span>
          </div> */}

          <h1 className="text-xl font-bold text-center text-gray-900 mb-4">
            <span className="text-primary">Create</span> your account
          </h1>

          {/* Account type tabs */}
          <div className="flex rounded-xl overflow-hidden mb-4 bg-gray-100 p-1 gap-1">
            {(["guest", "provider"] as UserType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setUserType(t); setErrors({}); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  userType === t
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "guest" ? "🧳  Traveller" : "🏨  Provider / Host"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="reg-firstname" className="block text-xs font-medium text-gray-700 mb-1.5">First name</label>
                <div className="relative">
                  <InputIcon>
                    <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </InputIcon>
                  <input
                    id="reg-firstname"
                    value={form.firstName}
                    onChange={set("firstName")}
                    placeholder="Ada"
                    autoComplete="given-name"
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm bg-[#f6fdf8] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition placeholder:text-gray-400 ${errors.firstName ? "border-red-400" : "border-gray-200"}`}
                  />
                  {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="reg-lastname" className="block text-xs font-medium text-gray-700 mb-1.5">Last name</label>
                <div className="relative">
                  <InputIcon>
                    <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </InputIcon>
                  <input
                    id="reg-lastname"
                    value={form.lastName}
                    onChange={set("lastName")}
                    placeholder="Okafor"
                    autoComplete="family-name"
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm bg-[#f6fdf8] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition placeholder:text-gray-400 ${errors.lastName ? "border-red-400" : "border-gray-200"}`}
                  />
                  {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="mb-3">
              <label htmlFor="reg-email" className="block text-xs font-medium text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <InputIcon>
                  <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </InputIcon>
                <input
                  id="reg-email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm bg-[#f6fdf8] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition placeholder:text-gray-400 ${errors.email ? "border-red-400" : "border-gray-200"}`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
            </div>

            {/* Provider-only fields */}
            {userType === "provider" && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label htmlFor="reg-business" className="block text-xs font-medium text-gray-700 mb-1.5">Business name</label>
                  <div className="relative">
                    <InputIcon>
                      <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                      </svg>
                    </InputIcon>
                    <input
                      id="reg-business"
                      value={form.businessName}
                      onChange={set("businessName")}
                      placeholder="Serena Hotels Ltd."
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm bg-[#f6fdf8] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition placeholder:text-gray-400 ${errors.businessName ? "border-red-400" : "border-gray-200"}`}
                    />
                    {errors.businessName && <p className="text-xs text-red-500 mt-1">{errors.businessName}</p>}
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-country" className="block text-xs font-medium text-gray-700 mb-1.5">Country code</label>
                  <div className="relative">
                    <InputIcon>
                      <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                      </svg>
                    </InputIcon>
                    <input
                      id="reg-country"
                      value={form.country}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, country: e.target.value.toUpperCase() }));
                        setErrors((p) => ({ ...p, country: undefined }));
                      }}
                      placeholder="KE"
                      maxLength={2}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm bg-[#f6fdf8] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition placeholder:text-gray-400 ${errors.country ? "border-red-400" : "border-gray-200"}`}
                    />
                    {errors.country && <p className="text-xs text-red-500 mt-1">{errors.country}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Password row */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="reg-password" className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <InputIcon>
                    <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </InputIcon>
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Min. 8 chars"
                    autoComplete="new-password"
                    className={`w-full pl-9 pr-9 py-2.5 rounded-xl border text-sm bg-[#f6fdf8] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition placeholder:text-gray-400 ${errors.password ? "border-red-400" : "border-gray-200"}`}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                    {showPassword ? (
                      <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="reg-confirm-password" className="block text-xs font-medium text-gray-700 mb-1.5">Confirm password</label>
                <div className="relative">
                  <InputIcon>
                    <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </InputIcon>
                  <input
                    id="reg-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={set("confirmPassword")}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    className={`w-full pl-9 pr-9 py-2.5 rounded-xl border text-sm bg-[#f6fdf8] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition placeholder:text-gray-400 ${errors.confirmPassword ? "border-red-400" : "border-gray-200"}`}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                    {showConfirmPassword ? (
                      <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                  {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
                </div>
              </div>
            </div>

            {/* General error */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-red-600 text-sm">{errors.general}</p>
              </div>
            )}

            {/* Submit */}
            <button
              id="register-submit-btn"
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {mutation.isPending ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Creating Account…
                </>
              ) : "Create Account"}
            </button>
          </form>

          {/* Sign in link */}
          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
