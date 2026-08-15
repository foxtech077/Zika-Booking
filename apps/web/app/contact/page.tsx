import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Mail,
  LifeBuoy,
  CreditCard,
  ShieldAlert,
  Building2,
  Clock,
  FileText,
  UserX,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Support | Kainook",
  description:
    "Get in touch with Kainook support for help with bookings, payments, listings, or account and privacy requests.",
};

const SUPPORT_EMAIL = "info@kainook.com";

interface Channel {
  icon: React.ReactNode;
  title: string;
  description: string;
  subject: string;
  response: string;
}

const channels: Channel[] = [
  {
    icon: <LifeBuoy className="w-5 h-5" />,
    title: "Bookings & general help",
    description:
      "Questions about a reservation, check-in, changes, cancellations, or how the platform works. Include your booking reference (KAIN-XXXX-CC) so we can find it straight away.",
    subject: "Booking support",
    response: "Within 48 hours",
  },
  {
    icon: <CreditCard className="w-5 h-5" />,
    title: "Payments & refunds",
    description:
      "Charges you do not recognise, failed payments, refunds, or payout questions if you list on Kainook. Include your payment reference and the date of the transaction.",
    subject: "Payment issue",
    response: "Within 2 business days",
  },
  {
    icon: <Building2 className="w-5 h-5" />,
    title: "Listing on Kainook",
    description:
      "Becoming a host, getting a property or vehicle approved, managing availability, or anything to do with your provider dashboard.",
    subject: "Provider support",
    response: "Within 48 hours",
  },
  {
    icon: <ShieldAlert className="w-5 h-5" />,
    title: "Trust, safety & fraud",
    description:
      "Report a suspicious listing, a request to pay outside the platform, or a safety concern. Do not make any payment outside Kainook — tell us first.",
    subject: "Urgent: trust & safety report",
    response: "Treated as priority",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-brand/10 selection:text-brand-darkest">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/kainook-logo.jpeg"
              alt="Kainook Logo"
              width={40}
              height={40}
              className="rounded-xl shadow-sm"
            />
            <span className="font-serif font-bold text-xl text-brand-darkest tracking-tight">
              KAINOOK
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-darkest transition-colors py-2 px-3 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Kainook
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-[#0c2614] to-[#081b0d] text-white py-12 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-light">
            Contact Us
          </span>
          <h1 className="text-3xl md:text-5xl font-serif font-bold tracking-tight">
            We&apos;re here to help
          </h1>
          <p className="text-white/70 text-sm md:text-base max-w-xl mx-auto">
            Email our support team and a real person will get back to you. For quick
            answers, most common questions are already covered in our Help Centre.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-center gap-2 bg-white text-[#0c2614] hover:bg-slate-100 font-semibold text-sm py-3 px-5 rounded-xl shadow-lg transition"
            >
              <Mail className="w-4 h-4" />
              {SUPPORT_EMAIL}
            </a>
            <Link
              href="/faq"
              className="flex items-center gap-2 border border-white/25 hover:bg-white/10 text-white font-semibold text-sm py-3 px-5 rounded-xl transition"
            >
              <LifeBuoy className="w-4 h-4" />
              Browse the Help Centre
            </Link>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {/* What can we help with */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-serif font-bold text-xl text-brand-darkest">
              What can we help you with?
            </h2>
            <p className="text-slate-600 text-xs max-w-2xl">
              Every enquiry goes to the same inbox — picking the closest topic just helps
              us route it to the right team faster.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((channel) => (
              <a
                key={channel.title}
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(channel.subject)}`}
                className="group bg-white border border-slate-100 hover:border-brand/30 rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-brand/10 text-brand-darkest flex items-center justify-center shrink-0">
                    {channel.icon}
                  </span>
                  <h3 className="font-semibold text-sm text-brand-darkest">
                    {channel.title}
                  </h3>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  {channel.description}
                </p>
                <div className="flex items-center justify-between pt-1 mt-auto">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    {channel.response}
                  </span>
                  <span className="text-[11px] font-semibold text-brand-darkest group-hover:underline">
                    Email us →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Account & privacy + company details */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-4">
            <h2 className="font-serif font-bold text-lg text-brand-darkest">
              Account &amp; privacy requests
            </h2>
            <ul className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <li className="flex gap-3">
                <FileText className="w-4 h-4 text-brand-darkest shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-800">Access your data.</strong> Email{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Data Access Request")}`}
                    className="text-brand-darkest font-semibold underline underline-offset-2"
                  >
                    {SUPPORT_EMAIL}
                  </a>{" "}
                  with the subject &quot;Data Access Request&quot;. We respond within 30
                  days, free of charge.
                </span>
              </li>
              <li className="flex gap-3">
                <UserX className="w-4 h-4 text-brand-darkest shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-800">Delete your account.</strong> You can
                  request deletion yourself at{" "}
                  <Link
                    href="/delete-account"
                    className="text-brand-darkest font-semibold underline underline-offset-2"
                  >
                    kainook.com/delete-account
                  </Link>
                  .
                </span>
              </li>
              <li className="flex gap-3">
                <ShieldAlert className="w-4 h-4 text-brand-darkest shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-800">Make a complaint.</strong> Send it in
                  writing with your booking reference and any supporting evidence. We
                  acknowledge within 48 hours and aim to resolve within 14 days.
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-4">
            <h2 className="font-serif font-bold text-lg text-brand-darkest">
              Company details
            </h2>
            <div className="text-xs text-slate-600 leading-relaxed space-y-1">
              <p className="font-semibold text-slate-800">Kainook Travel OÜ</p>
              <p>Tallinn, Estonia</p>
              <p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-brand-darkest font-semibold underline underline-offset-2"
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <p>www.kainook.com</p>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Kainook is a technology marketplace, not a travel agency. Bookings are
              contracts between you and the independent provider listed on the platform.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/legal/terms"
                className="text-[11px] font-semibold text-brand-darkest underline underline-offset-2"
              >
                Terms of Use
              </Link>
              <Link
                href="/legal/privacy"
                className="text-[11px] font-semibold text-brand-darkest underline underline-offset-2"
              >
                Privacy Policy
              </Link>
              <Link
                href="/faq"
                className="text-[11px] font-semibold text-brand-darkest underline underline-offset-2"
              >
                Help Centre
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
