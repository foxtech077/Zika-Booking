"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  Download,
  Key,
  QrCode,
  ArrowLeft
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api, clearAdminToken, clearRefreshTokenCookie, storeAdminToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

type Step = "credentials" | "totp" | "totp-setup" | "recovery-codes";
const INTERMEDIATE_TOKEN_KEY = "zika:admin_intermediate";

function getStoredIntermediateToken() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(INTERMEDIATE_TOKEN_KEY) ?? "";
}

function storeIntermediateToken(token: string) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(INTERMEDIATE_TOKEN_KEY, token);
  }
}

function clearIntermediateToken() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(INTERMEDIATE_TOKEN_KEY);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { setSession, clearSession } = useAuthStore();

  const [step, setStep] = useState<Step>("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedText, setCopiedText] = useState(false);

  // intermediate session details
  const [intermediateToken, setIntermediateToken] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pendingSessionToken, setPendingSessionToken] = useState("");

  // recovery code login option
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("");


  // Handle standard credential login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const credentials = {
        email: email.trim().toLowerCase(),
        password,
      };

      if (!credentials.email || !credentials.password) {
        setError("Email and password are required.");
        return;
      }

      clearAdminToken();
      clearIntermediateToken();
      clearRefreshTokenCookie();
      clearSession();
      if (process.env.NODE_ENV === "development") {
        console.info("Admin login request", { email: credentials.email, passwordLength: credentials.password.length });
      }

      const { data } = await api.post("/admin/auth/login", credentials, {
        withCredentials: false,
        headers: {
          "Content-Type": "application/json",
        },
      });
      const loginData = data.data ?? data;
      const { totpRequired, setupRequired, intermediateToken: token } = loginData;

      if (totpRequired) {
        if (!token) {
          setError("Login response did not include the intermediate token. Please try again.");
          return;
        }

        setIntermediateToken(token);
        storeIntermediateToken(token);
        setTotp("");
        setRecoveryCodeInput("");
        setIsRecovery(false);

        if (setupRequired) {
          setStep("totp-setup");
          await fetchSetupData(token);
        } else {
          setStep("totp");
        }
      } else {
        // Fallback or bypass (not standard under security policy but safe fallback)
        if (!loginData.sessionToken) {
          setError("Login succeeded but no session token was returned. Please try again.");
          return;
        }

        storeAdminToken(loginData.sessionToken);
        const meRes = await api.get("/admin/auth/me", {
          headers: { Authorization: `Bearer ${loginData.sessionToken}` },
        });
        const user = meRes.data?.data?.user ?? meRes.data?.user;
        clearIntermediateToken();
        setSession(loginData.sessionToken, user);
        router.replace("/dashboard");
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === "development") {
        console.info("Admin login failed", {
          status: err?.response?.status,
          body: err?.response?.data,
        });
      }

      const msg = err?.response?.data?.error?.message ?? "Invalid email or password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Fetch TOTP QR code and setup secret
  const fetchSetupData = async (token: string) => {
    try {
      const { data } = await api.post(
        "/admin/auth/totp/setup",
        { intermediateToken: token }
      );
      const { qrCodeDataUrl, secret } = data.data ?? data;
      setQrCode(qrCodeDataUrl ?? "");
      setTotpSecret(secret ?? "");
    } catch (err: any) {
      setError("Failed to load two-factor setup information. Please try signing in again.");
    }
  };

  // Confirm TOTP setup (first verification code)
  const handleTOTPConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = intermediateToken || getStoredIntermediateToken();
      if (!token) {
        setError("Your two-factor setup session expired. Please sign in again.");
        setStep("credentials");
        return;
      }

      const { data } = await api.post(
        "/admin/auth/totp/confirm",
        { code: totp.replace(/\s/g, ""), intermediateToken: token }
      );
      const { recoveryCodes: codes, sessionToken } = data.data ?? data;
      clearIntermediateToken();
      setRecoveryCodes(codes ?? []);
      setPendingSessionToken(sessionToken ?? "");
      setStep("recovery-codes");
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? "Failed to verify setup code.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Verify TOTP or Recovery code for normal login
  const handleTOTPVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = intermediateToken || getStoredIntermediateToken();
      if (!token) {
        setError("Your two-factor login session expired. Please sign in again.");
        setStep("credentials");
        return;
      }

      const payload = isRecovery
        ? { recoveryCode: recoveryCodeInput.trim(), intermediateToken: token }
        : { code: totp.replace(/\s/g, ""), intermediateToken: token };

      const { data } = await api.post(
        "/admin/auth/totp/verify",
        payload
      );
      const { sessionToken } = data.data ?? data;
      if (!sessionToken) {
        setError("Verification succeeded but no session token was returned. Please try again.");
        return;
      }

      // Fetch profile
      storeAdminToken(sessionToken);
      const meRes = await api.get("/admin/auth/me", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const user = meRes.data?.data?.user ?? meRes.data?.user;
      clearIntermediateToken();
      setSession(sessionToken, user);
      router.replace("/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? "Verification failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Complete setup and enter dashboard
  const handleCompleteSetup = async () => {
    setLoading(true);
    try {
      if (!pendingSessionToken) {
        setError("Login session is missing. Please sign in again.");
        return;
      }

      storeAdminToken(pendingSessionToken);
      const meRes = await api.get("/admin/auth/me", {
        headers: { Authorization: `Bearer ${pendingSessionToken}` },
      });
      const user = meRes.data?.data?.user ?? meRes.data?.user;
      setSession(pendingSessionToken, user);
      router.replace("/dashboard");
    } catch (err) {
      setError("Failed to complete login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const downloadRecoveryCodes = () => {
    const text = `Kainook Admin Backup Recovery Codes\nDownloaded: ${new Date().toLocaleString()}\n\n${recoveryCodes.join(
      "\n"
    )}\n\nKeep these single-use codes in a highly secure place.`;
    const element = document.createElement("a");
    const file = new Blob([text], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "kainook-recovery-codes.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col gradient-primary relative overflow-hidden flex-shrink-0">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-12 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -right-16 h-64 w-64 rounded-full bg-white/5" />

        <div className="relative flex flex-col flex-1 p-12 justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm overflow-hidden">
              <img src="/admin/kainook-logo.png" alt="Kainook" className="h-9 w-9 object-contain" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">Kainook</p>
              <p className="text-white/60 text-xs mt-0.5">Administration</p>
            </div>
          </div>

          {/* Hero text */}
          <div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
              Manage your<br />
              platform with<br />
              <span className="text-white/80">confidence.</span>
            </h1>
            <p className="mt-4 text-white/60 text-sm leading-relaxed max-w-sm">
              Access bookings, listings, analytics, financial reports, and platform controls from one secure dashboard.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {["Booking Management", "Revenue Analytics", "Listing Accreditation", "Commission Control", "Audit Trail"].map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 border border-white/10"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/40">
            Secured with JWT + TOTP authentication. All actions are audited.
          </p>
        </div>
      </div>

      {/* Right panel — forms */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 lg:bg-white overflow-y-auto">
        <div className="w-full max-w-md py-8">
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white overflow-hidden shadow">
              <img src="/admin/kainook-logo.png" alt="Kainook" className="h-7 w-7 object-contain" />
            </div>
            <span className="font-bold text-slate-900">Kainook Admin</span>
          </div>

          {/* ────────────────── Step 1: Credentials ────────────────── */}
          {step === "credentials" && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Sign in to your admin account
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  id="email"
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  leftIcon={<Mail className="h-4 w-4" />}
                />
                <Input
                  id="password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  leftIcon={<Lock className="h-4 w-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-danger-light border border-danger/20 p-3 text-sm text-danger-dark animate-shake">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" fullWidth loading={loading} size="lg" className="mt-6">
                  Sign in
                </Button>
              </form>
            </>
          )}

          {/* ────────────────── Step 2: TOTP Setup Enforced ────────────────── */}
          {step === "totp-setup" && (
            <>
              <div className="mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 mb-4">
                  <QrCode className="h-6 w-6 text-warning-dark" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Set up 2-Factor Authentication</h2>
                <p className="text-sm text-slate-500 mt-1">
                  TOTP 2FA is required for all administrative access. Follow the steps to secure your account.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-6 text-center flex flex-col items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                  Step 1: Scan this QR Code
                </span>
                {qrCode ? (
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm mb-4">
                    <img src={qrCode} alt="TOTP QR Code" className="h-44 w-44" />
                  </div>
                ) : (
                  <div className="h-44 w-44 flex items-center justify-center bg-slate-100 rounded-lg animate-pulse mb-4 text-xs text-slate-400">
                    Generating setup code...
                  </div>
                )}

                <span className="text-xs text-slate-400 mb-2">Can't scan the QR? Enter this key manually:</span>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-full justify-between">
                  <code className="text-xs font-mono text-slate-800 break-all select-all font-semibold tracking-wider">
                    {totpSecret}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(totpSecret)}
                    className="text-slate-400 hover:text-slate-600 transition"
                    title="Copy secret"
                  >
                    {copiedText ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <form onSubmit={handleTOTPConfirm} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 text-center">
                    Step 2: Enter the 6-digit confirmation code
                  </label>
                  <Input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123 456"
                    maxLength={6}
                    required
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-danger-light border border-danger/20 p-3 text-sm text-danger-dark">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" fullWidth loading={loading} size="lg" className="mt-2">
                  Verify and Enable 2FA
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    clearIntermediateToken();
                    setIntermediateToken("");
                    setStep("credentials");
                    setError("");
                    setTotp("");
                  }}
                  className="w-full text-center text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-1 mt-2"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to sign in
                </button>
              </form>
            </>
          )}

          {/* ────────────────── Step 3: Show Recovery Codes ────────────────── */}
          {step === "recovery-codes" && (
            <>
              <div className="mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 mb-4">
                  <ShieldCheck className="h-6 w-6 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Backup Recovery Codes</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Keep these single-use codes in a safe place. You will need them if you lose access to your authenticator app.
                </p>
              </div>

              <div className="bg-warning-light/30 border border-warning/20 rounded-xl p-4 mb-6">
                <div className="flex gap-2.5">
                  <AlertCircle className="h-5 w-5 text-warning-dark flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-warning-dark">CRITICAL SECURITY WARNING</p>
                    <p className="text-xs text-warning-dark/80 mt-0.5">
                      These codes are shown only ONCE. Once you leave this page, you cannot recover them.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-inner mb-6">
                <div className="grid grid-cols-2 gap-3 text-center">
                  {recoveryCodes.map((code, index) => (
                    <div
                      key={code}
                      className="font-mono text-sm text-emerald-400 bg-slate-950/60 border border-slate-800/80 rounded px-2.5 py-1.5 font-semibold"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mb-6">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 flex justify-center items-center gap-1.5"
                  onClick={downloadRecoveryCodes}
                >
                  <Download className="h-4 w-4" /> Download TXT
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 flex justify-center items-center gap-1.5"
                  onClick={() => copyToClipboard(recoveryCodes.join("\n"))}
                >
                  {copiedText ? (
                    <>
                      <Check className="h-4 w-4 text-success" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Copy Codes
                    </>
                  )}
                </Button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-danger-light border border-danger/20 p-3 text-sm text-danger-dark mb-4">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="button" fullWidth loading={loading} onClick={handleCompleteSetup} size="lg">
                I've Saved These Codes
              </Button>
            </>
          )}

          {/* ────────────────── Step 4: Standard TOTP Verification ────────────────── */}
          {step === "totp" && (
            <>
              <div className="mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {isRecovery ? "Enter Backup Recovery Code" : "Two-factor verification"}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {isRecovery
                    ? "Enter a 10-character backup recovery code to bypass TOTP verification."
                    : "Enter the 6-digit code from your authenticator app."}
                </p>
              </div>

              <form onSubmit={handleTOTPVerify} className="space-y-4">
                {isRecovery ? (
                  <Input
                    id="recoveryCode"
                    label="Backup recovery code"
                    type="text"
                    value={recoveryCodeInput}
                    onChange={(e) => setRecoveryCodeInput(e.target.value)}
                    placeholder="xxxx-xxxx-xx"
                    maxLength={20}
                    required
                    leftIcon={<Key className="h-4 w-4" />}
                  />
                ) : (
                  <Input
                    id="totp"
                    label="Authentication code"
                    type="text"
                    inputMode="numeric"
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123 456"
                    maxLength={6}
                    required
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                  />
                )}

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-danger-light border border-danger/20 p-3 text-sm text-danger-dark">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" fullWidth loading={loading} size="lg" className="mt-2">
                  Verify & Sign in
                </Button>

                <div className="flex flex-col gap-2.5 mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecovery(!isRecovery);
                      setError("");
                      setTotp("");
                      setRecoveryCodeInput("");
                    }}
                    className="text-sm font-semibold text-primary hover:text-primary-dark transition"
                  >
                    {isRecovery ? "Use 2FA Authenticator App" : "Lost device? Use backup recovery code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearIntermediateToken();
                      setIntermediateToken("");
                      setStep("credentials");
                      setError("");
                      setTotp("");
                      setIsRecovery(false);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700 transition"
                  >
                    ← Back to sign in
                  </button>
                </div>
              </form>
            </>
          )}

          <p className="mt-8 text-center text-xs text-slate-400">
            Kainook Admin Panel · Restricted access
          </p>
        </div>
      </div>
    </div>
  );
}
