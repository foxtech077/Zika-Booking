"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { registerSchema } from "@zika/validators";
import { api, storeToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { FormField } from "@/components/ui/FormField";
import { CountryCombobox } from "@/components/ui/CountryCombobox";
import type { ApiResponse, AuthResponse } from "@zika/types";
import { Select } from "@/components/ui/Input";
import { ALL_COUNTRIES } from "@/lib/countries";

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
    businessName: "", country: "", phone: "",
    dob: "",
  });

  const [phoneCountryCode, setPhoneCountryCode] = useState("+254");

  const countryDialOptions = useMemo(() => {
    return ALL_COUNTRIES.map((c) => ({
      value: c.dialCode,
      label: `${c.flag} ${c.dialCode}`,
    }));
  }, []);

  const is18OrOver = useMemo(() => {
    if (!form.dob) return false;
    const birthDate = new Date(form.dob);
    if (isNaN(birthDate.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  }, [form.dob]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        userType,
        phone: userType === "provider" ? (form.phone ? `${phoneCountryCode}${form.phone.replace(/^0+/, "").replace(/[^0-9]/g, "")}` : undefined) : undefined,
        businessName: userType === "provider" ? form.businessName : undefined,
        country: userType === "provider" ? form.country || undefined : undefined,
        // Registration records Privacy Policy acceptance only; the Terms are
        // accepted at checkout. Field name must match the API contract — the
        // previous `agreedToPrivacy`/`agreedAt` keys were silently dropped by
        // the server's Zod schema, so nothing was ever recorded.
        acceptedPrivacy: agreedToPrivacy,
      };
      const res = await api.post<ApiResponse<Partial<AuthResponse> & { message?: string }>>("/auth/register", payload);
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
      phone: userType === "provider" ? (form.phone ? `${phoneCountryCode}${form.phone.replace(/^0+/, "").replace(/[^0-9]/g, "")}` : undefined) : undefined,
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
    if (!agreedToPrivacy) {
      setErrors((p) => ({ ...p, general: "You must accept the Privacy Policy to continue." }));
      return;
    }
    mutation.mutate();
  }

  const isProvider = userType === "provider";

  /* ── Email-sent success state ── */
  if (submitted) {
    return (
      <div className="relative flex min-h-screen min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-white px-6 py-12">
        <Image
          src="/images/Login.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#03301f] via-[#03301f]/75 to-[#03301f]/55" />

        <div className="animate-slide-in-up relative z-10 w-full max-w-md rounded-3xl bg-white/95 p-10 text-center shadow-2xl ring-1 ring-white/40 backdrop-blur">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-gray-900">Check your email</h1>
          <p className="mb-1 text-sm text-gray-500">We&apos;ve sent a verification link to</p>
          <p className="mb-5 font-semibold text-gray-800">{form.email}</p>
          <p className="mb-7 text-xs leading-relaxed text-gray-400">
            Click the link in your email to activate your account. It expires in 24 hours.
          </p>
          <Link
            href="/auth/login"
            className="inline-block w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-dark hover:shadow-md"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen min-h-[100dvh] w-full bg-white lg:grid lg:grid-cols-[1.05fr_1fr]">

      {/* ── Left: full-bleed brand panel (desktop) ── */}
      <aside className="relative hidden overflow-hidden lg:sticky lg:top-0 lg:block lg:h-screen">
        <Image
          src="/images/Login.webp"
          alt=""
          fill
          priority
          sizes="55vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#03301f] via-[#03301f]/60 to-[#03301f]/20" />
        <div className="absolute inset-0 bg-[radial-gradient(115%_75%_at_50%_0%,transparent_35%,rgba(3,48,31,0.5)_100%)]" />

        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
          <Link href="/" className="flex w-fit items-center gap-3">
            <Image
              src="/images/kainook-logo.jpeg"
              alt="Kainook"
              width={48}
              height={48}
              className="rounded-2xl ring-1 ring-white/20"
            />
            <span className="text-xl font-bold tracking-[0.16em] text-white">KAINOOK</span>
          </Link>

          <div className="max-w-md">
            <h2 className="text-4xl font-bold leading-[1.08] tracking-tight text-white xl:text-5xl">
              {isProvider ? "Grow with Kainook." : "Start exploring."}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/75">
              {isProvider
                ? "List your property or fleet and reach travellers across Africa and beyond."
                : "Create your account to book stays, homes and car rentals in minutes."}
            </p>

            <ul className="mt-10 space-y-3.5">
              {(isProvider
                ? ["Reach travellers across every market", "Manage listings, calendar and payouts", "Transparent, country-specific commission"]
                : ["Free to join — no booking fees to sign up", "Verified stays, homes and car rentals", "Earn rewards on every booking"]
              ).map((point) => (
                <li key={point} className="flex items-center gap-3 text-sm text-white/80">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4ade80]/15 ring-1 ring-[#4ade80]/30">
                    <svg className="h-3.5 w-3.5 text-[#4ade80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* ── Right: form ── */}
      <main className="flex min-h-screen min-h-[100dvh] flex-col lg:h-screen lg:overflow-y-auto">

        {/* Mobile hero — same photograph, compact */}
        <div className="relative h-40 w-full shrink-0 overflow-hidden lg:hidden">
          <Image
            src="/images/Login.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#03301f] via-[#03301f]/65 to-[#03301f]/25" />
          <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-8">
            <Link href="/" className="flex w-fit items-center gap-2.5">
              <Image
                src="/images/kainook-logo.jpeg"
                alt="Kainook"
                width={38}
                height={38}
                className="rounded-xl ring-1 ring-white/20"
              />
              <span className="text-base font-bold tracking-[0.16em] text-white">KAINOOK</span>
            </Link>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">Create your account</h2>
          </div>
        </div>

        <div className="mx-auto my-auto w-full max-w-[600px] px-6 py-10 sm:px-8 lg:px-10 lg:py-14">
          <div className="mb-6">
            <h1 className="text-[26px] font-bold tracking-tight text-gray-900">Create your account</h1>
            <p className="mt-1.5 text-sm text-gray-500">
              {isProvider
                ? "Register as a partner host to start listing."
                : "It takes less than a minute to get started."}
            </p>
          </div>

          {/* Account type */}
          <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
            {(["guest", "provider"] as UserType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setUserType(t); setErrors({}); }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${userType === t
                  ? "bg-white text-primary shadow-sm ring-1 ring-black/5"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {t === "guest" ? "🧳  Traveller" : "🏨  Provider / Host"}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} noValidate>
            {/* First name */}
            <div className="mb-3">
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

            {/* Last name */}
            <div className="mb-3">
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

            {/* Date of Birth (Guest/Traveller only) */}
            {userType === "guest" && (
              <div className="mb-3">
                <label htmlFor="reg-dob" className="block text-xs font-medium text-gray-700 mb-1.5">Date of Birth</label>
                <div className="relative">
                  <InputIcon>
                    <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </InputIcon>
                  <input
                    id="reg-dob"
                    type="date"
                    value={form.dob}
                    onChange={set("dob")}
                    className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm bg-[#f6fdf8] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition placeholder:text-gray-400 ${errors.dob ? "border-red-400" : "border-gray-200"}`}
                  />
                  {errors.dob && <p className="text-xs text-red-500 mt-1">{errors.dob}</p>}
                  {form.dob && !is18OrOver && (
                    <p className="text-xs text-red-500 mt-1">You must be 18 years or older to register.</p>
                  )}
                </div>
              </div>
            )}

            {/* Provider-only fields */}
            {userType === "provider" && (
              <div className="space-y-3 mb-3">
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
                  <CountryCombobox
                    label="Country"
                    value={form.country}
                    onChange={(code) => {
                      setForm((p) => ({ ...p, country: code }));
                      setErrors((p) => ({ ...p, country: undefined }));
                    }}
                    error={errors.country}
                  />
                </div>
                <div>
                  <label htmlFor="reg-phone" className="block text-xs font-medium text-gray-700 mb-1.5">Phone number</label>
                  <div className="flex gap-2">
                    <div className="w-[100px] shrink-0">
                      <Select
                        value={phoneCountryCode}
                        onChange={(e) => {
                          setPhoneCountryCode(e.target.value);
                          setErrors((p) => ({ ...p, phone: undefined }));
                        }}
                        options={countryDialOptions}
                        className="!h-[42px] !rounded-xl !bg-[#f6fdf8] !border-gray-200 focus:!ring-primary/30 focus:!border-primary"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        id="reg-phone"
                        value={form.phone}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/[^0-9]/g, "");
                          setForm((p) => ({ ...p, phone: cleaned }));
                          setErrors((p) => ({ ...p, phone: undefined }));
                        }}
                        placeholder="712345678"
                        type="tel"
                        className={`w-full h-[42px] px-3 py-2.5 rounded-xl border text-sm bg-[#f6fdf8] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition placeholder:text-gray-400 ${errors.phone ? "border-red-400" : "border-gray-200"}`}
                      />
                    </div>
                  </div>
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>
              </div>
            )}

            {/* Password */}
            <div className="mb-3">
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
                <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                  {showPassword ? (
                    <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>
            </div>

            {/* Confirm password */}
            <div className="mb-3">
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
                <button type="button" tabIndex={-1} onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                  {showConfirmPassword ? (
                    <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* General error */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-red-600 text-sm">{errors.general}</p>
              </div>
            )}

            {/* Compliance checkbox — Privacy Policy only.
                  Per the client's spec the Privacy Policy is accepted at
                  registration, while the Terms & Conditions are accepted at
                  checkout, before completing a payment or booking. */}
            <div className="mb-4 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  id="agree-privacy"
                  type="checkbox"
                  checked={agreedToPrivacy}
                  onChange={(e) => {
                    setAgreedToPrivacy(e.target.checked);
                    setErrors((p) => ({ ...p, general: undefined }));
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary accent-primary cursor-pointer"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  I have read and accept the{" "}
                  <Link
                    href="/legal/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-semibold hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </span>
              </label>
            </div>

            {/* Submit */}
            <button
              id="register-submit-btn"
              type="submit"
              disabled={mutation.isPending || !agreedToPrivacy || (userType === "guest" && !is18OrOver)}
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
          <p className="text-center text-sm text-gray-500 mt-4 mb-1">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}