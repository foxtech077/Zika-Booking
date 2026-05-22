"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";

export function VerifyPendingClient() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/auth/resend-verification", { email });
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: () => {
      setSuccess(true);
      setError(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message ?? "Failed to resend verification email.";
      setError(msg);
    },
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
      <div className="text-5xl mb-4">✉️</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify your email</h1>
      <p className="text-gray-500 mb-6">
        A verification link was sent to <strong className="text-gray-800">{email || "your email"}</strong>. Please click the link to activate your account.
      </p>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-green-600 text-sm">A new verification link has been sent!</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <Button
        onClick={() => mutation.mutate()}
        loading={mutation.isPending}
        disabled={!email || success}
        className="w-full mb-4"
      >
        Resend verification email
      </Button>

      <Link href="/auth/login" className="text-primary font-semibold text-sm hover:underline block">
        Back to Sign In
      </Link>
    </div>
  );
}
