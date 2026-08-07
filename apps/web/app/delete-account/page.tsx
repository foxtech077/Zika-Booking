import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Mail, Globe, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Delete Account",
  description: "Learn how to request deletion of your Kainook account and associated personal information.",
};

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-brand/10 selection:text-brand-darkest">
      {/* Header section */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/kainook-logo.jpeg"
              alt="Kainook Logo"
              width={40}
              height={40}
              className="rounded-xl shadow-sm"
            />
            <span className="font-serif font-bold text-xl text-brand-darkest tracking-tight">KAINOOK</span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-darkest transition-colors py-2 px-3 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-green-50/50 to-white border-b border-slate-100/80 py-16 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand">Account Support</span>
          <h1 className="text-3xl md:text-5xl font-serif font-bold text-slate-900 tracking-tight">Delete Your Kainook Account</h1>
          <p className="text-slate-500 text-sm md:text-base max-w-xl mx-auto leading-relaxed font-sans">
            We&apos;re sorry to see you go. Below you will find all the details and instructions on how to request the deletion of your account and personal information.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left/Center Columns: Deletion Info & Steps */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview Section */}
            <article className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-6">
              <div className="space-y-4 font-sans">
                <h2 className="text-xl font-serif font-bold text-slate-900 border-l-4 border-brand pl-3">
                  Account Deletion Overview
                </h2>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Users may request deletion of their Kainook account and associated personal information at any time. When you request deletion, your account setup and direct profile details will be permanently removed.
                </p>
              </div>

              {/* What happens list */}
              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 space-y-4 font-sans">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span>When an account is deleted:</span>
                </div>
                <ul className="space-y-3 text-xs md:text-sm text-slate-700">
                  <li className="flex gap-2">
                    <span className="text-amber-500 shrink-0 font-bold">•</span>
                    <span><strong>Profile information</strong> will be permanently deleted.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-500 shrink-0 font-bold">•</span>
                    <span><strong>Booking history</strong> may be retained only where required by law.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-500 shrink-0 font-bold">•</span>
                    <span><strong>Payment information</strong> is not stored by Kainook (if applicable).</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-500 shrink-0 font-bold">•</span>
                    <span>Some information may be retained for fraud prevention, legal compliance, dispute resolution, or regulatory obligations.</span>
                  </li>
                  <li className="flex gap-2 font-semibold text-rose-700">
                    <span className="shrink-0">•</span>
                    <span>Account deletion is permanent and cannot be undone.</span>
                  </li>
                </ul>
              </div>
            </article>

            {/* Request Process Section */}
            <article className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-6">
              <h2 className="text-xl font-serif font-bold text-slate-900 border-l-4 border-brand pl-3">
                How to Request Account Deletion
              </h2>
              <p className="text-slate-600 leading-relaxed text-sm font-sans">
                To safeguard your account and ensure data privacy, please follow these steps to submit a deletion request:
              </p>

              <div className="space-y-6 font-sans">
                {[
                  {
                    step: 1,
                    title: "Send an email to our support team.",
                    desc: (
                      <span>
                        Compose an email from your registered account address and send it to{" "}
                        <a href="mailto:support@kainook.com" className="text-brand hover:underline font-semibold">
                          support@kainook.com
                        </a>.
                      </span>
                    ),
                  },
                  {
                    step: 2,
                    title: 'Use the subject line: "Account Deletion Request"',
                    desc: "Using this subject line helps our automated routing system place your ticket in the priority queue for privacy requests.",
                  },
                  {
                    step: 3,
                    title: "Include the following account details:",
                    desc: (
                      <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl p-4 font-mono text-xs text-slate-600 space-y-1.5">
                        <p>• Full Name</p>
                        <p>• Registered Email Address</p>
                        <p>• Optional reason for deletion (this helps us improve the Kainook experience)</p>
                      </div>
                    ),
                  },
                  {
                    step: 4,
                    title: "Our team will verify your identity.",
                    desc: "For security, we must confirm your ownership of the account before processing the deletion to prevent unauthorized request actions.",
                  },
                  {
                    step: 5,
                    title: "Verification and Deletion completion",
                    desc: "Once verified, your account and associated personal information will be permanently deleted and cannot be recovered.",
                  },
                ].map((s) => (
                  <div key={s.step} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-green-50 text-brand flex items-center justify-center font-bold text-sm shrink-0 border border-green-100 shadow-sm">
                      {s.step}
                    </div>
                    <div className="space-y-1 pt-1">
                      <h3 className="font-semibold text-slate-800 text-sm leading-snug">{s.title}</h3>
                      <div className="text-slate-500 text-xs md:text-sm leading-relaxed">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          {/* Right Sidebar: Cards */}
          <div className="space-y-6 font-sans">
            {/* Support Card */}
            <Card className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-brand shadow-sm">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm leading-tight">Support Contact</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Get in touch with us</p>
                </div>
              </div>
              
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5 font-medium">Support Email</span>
                  <a
                    href="mailto:support@kainook.com"
                    className="text-brand hover:underline font-semibold text-sm"
                  >
                    support@kainook.com
                  </a>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 font-medium">Website</span>
                  <a
                    href="https://kainook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline font-semibold text-sm flex items-center gap-1.5"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    https://kainook.com
                  </a>
                </div>
              </div>
            </Card>

            {/* Data Retention Card */}
            <Card className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-brand shadow-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm leading-tight">Data Retention</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Policy parameters</p>
                </div>
              </div>
              
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed list-disc pl-4">
                <li>
                  Account information is deleted after verification.
                </li>
                <li>
                  Certain records may be retained only when legally required.
                </li>
                <li>
                  Security, fraud prevention, taxation, payment disputes, and legal obligations may require limited data retention.
                </li>
                <li>
                  Retained information is protected according to our Privacy Policy.
                </li>
              </ul>
            </Card>
          </div>

        </div>

        {/* Footer Navigation */}
        <div className="mt-16 pt-6 border-t border-slate-200 text-center space-y-3 font-sans">
          <p className="text-slate-500 text-xs md:text-sm">
            For more information, please review our{" "}
            <Link href="/legal/privacy" className="text-brand hover:underline font-semibold">
              Privacy Policy
            </Link>
            .
          </p>
          <p className="text-[10px] text-slate-400">
            © {new Date().getFullYear()} Kainook · All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}
