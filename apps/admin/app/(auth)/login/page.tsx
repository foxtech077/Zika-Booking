"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api, storeAdminToken, getAdminToken } from "@/lib/api";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

type Step = "credentials" | "totp_setup" | "totp" | "webauthn" | "awaiting_totp" | "awaiting_webauthn";

interface LoginResult {
  step: Step;
  intermediateToken: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [flow, setFlow] = useState<{ step: Step; intermediateToken: string } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (getAdminToken()) {
      router.replace("/dashboard");
    } else {
      setChecking(false);
    }
  }, [router]);


  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: LoginResult & { sessionToken?: string } }>("/admin/auth/login", form);
      return res.data.data;
    },
    onSuccess: (data) => {
      if (data.sessionToken) {
        storeAdminToken(data.sessionToken);
        router.replace("/dashboard");
        return;
      }
      setFlow({ step: data.step, intermediateToken: data.intermediateToken });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      setError(msg ?? "Incorrect email or password.");
    },
  });

  function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    loginMutation.mutate();
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (flow?.step === "totp_setup") {
    return <TotpSetupScreen intermediateToken={flow.intermediateToken} />;
  }
  if (flow?.step === "awaiting_totp") {
    return <TotpVerifyScreen intermediateToken={flow.intermediateToken} />;
  }
  if (flow?.step === "awaiting_webauthn") {
    return <WebAuthnScreen intermediateToken={flow.intermediateToken} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-primary rounded-lg" />
          <span className="font-bold text-gray-900">ZikaBooking Admin</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Sign in</h1>
        <p className="text-sm text-gray-500 mb-6">Admin portal — authorised personnel only.</p>

        <form onSubmit={handleCredentials} noValidate>
          <FormField label="Email address" type="email" value={form.email}
            onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setError(null); }}
            placeholder="admin@zikabooking.com" autoComplete="username" />
          <FormField label="Password" type="password" value={form.password}
            onChange={(e) => { setForm((p) => ({ ...p, password: e.target.value })); setError(null); }}
            placeholder="Password" autoComplete="current-password" />

          {error && <p className="text-sm text-red-600 mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <Button type="submit" loading={loginMutation.isPending} className="w-full">Continue</Button>
        </form>
      </div>
    </div>
  );
}

// ── TOTP Setup (UC-1.10) ──────────────────────────────────────────────────────

function TotpSetupScreen({ intermediateToken }: { intermediateToken: string }) {
  const router = useRouter();
  const [qrData, setQrData] = useState<{ qrCodeDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: { qrCodeDataUrl: string; secret: string } }>(
        "/admin/auth/totp/setup", {}, { headers: { "x-intermediate-token": intermediateToken } }
      );
      return res.data.data;
    },
    onSuccess: (data) => setQrData(data),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: { recoveryCodes: string[]; sessionToken: string } }>(
        "/admin/auth/totp/confirm", { code }, { headers: { "x-intermediate-token": intermediateToken } }
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      setRecoveryCodes(data.recoveryCodes);
      storeAdminToken(data.sessionToken);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      setError(msg ?? "Invalid code.");
    },
  });

  if (recoveryCodes) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-8 w-full max-w-md">
          <h2 className="text-xl font-bold mb-1">Save your recovery codes</h2>
          <p className="text-sm text-red-600 font-medium mb-4">⚠️ These will not be shown again. Store them securely.</p>
          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-2 mb-4 font-mono text-sm">
            {recoveryCodes.map((c) => <span key={c} className="text-gray-800">{c}</span>)}
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (confirmed) router.replace("/dashboard");
              setConfirmed(true);
            }}
          >
            {confirmed ? "Go to dashboard" : "I've saved my recovery codes"}
          </Button>
        </div>
      </div>
    );
  }

  if (!qrData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-8 w-full max-w-sm text-center">
          <h2 className="text-xl font-bold mb-2">Set up two-factor authentication</h2>
          <p className="text-sm text-gray-500 mb-6">Two-factor authentication is required to access the admin panel.</p>
          <Button onClick={() => setupMutation.mutate()} loading={setupMutation.isPending} className="w-full">
            Set up authenticator app
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-8 w-full max-w-sm">
        <h2 className="text-xl font-bold mb-2">Scan QR code</h2>
        <p className="text-sm text-gray-500 mb-4">Open your authenticator app and scan the code below.</p>

        <div className="flex justify-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrData.qrCodeDataUrl} alt="TOTP QR code" className="w-48 h-48" />
        </div>

        <details className="mb-4">
          <summary className="text-sm text-primary cursor-pointer">Can't scan? Enter this code manually</summary>
          <p className="mt-2 font-mono text-xs bg-gray-50 p-2 rounded break-all">{qrData.secret}</p>
        </details>

        <p className="text-sm text-gray-700 mb-2">Enter the 6-digit code from your app:</p>
        <input
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40 mb-2"
          value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
          placeholder="000000" maxLength={6} inputMode="numeric" autoComplete="one-time-code"
        />
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <Button onClick={() => confirmMutation.mutate()} loading={confirmMutation.isPending}
          disabled={code.length !== 6} className="w-full">
          Verify & Enable 2FA
        </Button>
      </div>
    </div>
  );
}

// ── TOTP Verify (UC-1.11) ─────────────────────────────────────────────────────

function TotpVerifyScreen({ intermediateToken }: { intermediateToken: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const body = mode === "totp" ? { code } : { recoveryCode: code };
      const res = await api.post<{ data: { sessionToken: string; warning?: string } }>(
        "/admin/auth/totp/verify", body, { headers: { "x-intermediate-token": intermediateToken } }
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      storeAdminToken(data.sessionToken);
      if (data.warning) setWarning(data.warning);
      else router.replace("/dashboard");
    },
    onError: (err: unknown) => {
      const e = (err as { response?: { data?: { error?: { code?: string; message?: string } } } }).response?.data?.error;
      if (e?.code === "TOTP_LOCKED") setError("Too many failed attempts. Please wait 15 minutes.");
      else setError(e?.message ?? "Invalid verification code. Please try again.");
    },
  });

  if (warning) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-8 w-full max-w-sm text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold mb-2">Recovery code used</h2>
          <p className="text-sm text-gray-600 mb-6">{warning}</p>
          <Button onClick={() => router.replace("/dashboard")} className="w-full">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-8 w-full max-w-sm">
        <h2 className="text-xl font-bold mb-1">Two-factor authentication</h2>
        <p className="text-sm text-gray-500 mb-6">
          {mode === "totp" ? "Enter the 6-digit code from your authenticator app." : "Enter one of your recovery codes."}
        </p>

        <input
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40 mb-2"
          value={code} onChange={(e) => { setCode(mode === "totp" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value); setError(null); }}
          placeholder={mode === "totp" ? "000000" : "recovery-code"}
          maxLength={mode === "totp" ? 6 : 20}
          inputMode={mode === "totp" ? "numeric" : "text"}
          autoComplete={mode === "totp" ? "one-time-code" : "off"}
          autoFocus
        />

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <Button
          onClick={() => verifyMutation.mutate()}
          loading={verifyMutation.isPending}
          disabled={mode === "totp" ? code.length !== 6 : code.length < 3}
          className="w-full mb-3"
        >
          Verify
        </Button>

        <button type="button" className="text-sm text-primary w-full text-center"
          onClick={() => { setMode(mode === "totp" ? "recovery" : "totp"); setCode(""); setError(null); }}>
          {mode === "totp" ? "Use a recovery code instead" : "Use authenticator app instead"}
        </button>
      </div>
    </div>
  );
}

// ── WebAuthn (UC-1.12) ────────────────────────────────────────────────────────

function WebAuthnScreen({ intermediateToken }: { intermediateToken: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleWebAuthn() {
    setLoading(true);
    setError(null);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");

      // Get challenge
      const challengeRes = await api.post<{ data: { options: Parameters<typeof startAuthentication>[0] } }>(
        "/admin/auth/webauthn/challenge", {}, { headers: { "x-intermediate-token": intermediateToken } }
      );
      const options = challengeRes.data.data.options;

      // Sign with hardware key
      const credential = await startAuthentication(options);

      // Verify
      const verifyRes = await api.post<{ data: { sessionToken: string } }>(
        "/admin/auth/webauthn/verify", { credential }, { headers: { "x-intermediate-token": intermediateToken } }
      );
      storeAdminToken(verifyRes.data.data.sessionToken);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      setError(msg ?? "Authentication failed. Please use your registered security key.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-8 w-full max-w-sm text-center">
        <div className="text-5xl mb-4">🔑</div>
        <h2 className="text-xl font-bold mb-2">Hardware key required</h2>
        <p className="text-sm text-gray-500 mb-6">
          Insert your registered security key (e.g. YubiKey), then click the button below.
        </p>

        {error && <p className="text-sm text-red-600 mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <Button onClick={handleWebAuthn} loading={loading} className="w-full">
          Authenticate with Security Key
        </Button>

        <p className="text-xs text-gray-400 mt-4">
          Lost your key? Contact platform security.
        </p>
      </div>
    </div>
  );
}
