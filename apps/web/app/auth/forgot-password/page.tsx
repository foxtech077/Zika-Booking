"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post("/auth/forgot-password", { email }),
    onSettled: () => setSent(true), // Always show success (BR: enumeration prevention)
  });

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 mb-6">
            If an account with that email exists, we've sent a password reset link. The link expires in 1 hour.
          </p>
          <Link href="/auth/login" className="text-primary font-semibold">Back to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset password</h1>
        <p className="text-sm text-gray-500 mb-6">Enter your email and we'll send you a reset link.</p>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} noValidate>
          <FormField
            label="Email address" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" autoComplete="email"
          />
          <Button type="submit" loading={mutation.isPending} disabled={!email.includes("@")} className="w-full">
            Send reset link
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/auth/login" className="text-primary font-semibold">Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
