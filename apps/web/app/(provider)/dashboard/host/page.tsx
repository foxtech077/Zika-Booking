"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { refreshAccessToken } from "@/lib/token-refresh";
import { useAuthStore } from "@/stores/auth";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type HostStatus = "approved" | "pending" | "rejected" | null;

interface HostProfile {
  status: HostStatus;
  businessName: string | null;
  registrationNo: string | null;
  taxId: string | null;
  documentsUrl: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export default function HostOnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, updateUser } = useAuthStore();

  const [businessName, setBusinessName] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [taxId, setTaxId] = useState("");
  const [documentsUrl, setDocumentsUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: hostProfile, isLoading } = useQuery<HostProfile | null>({
    queryKey: ["host-profile"],
    queryFn: async () => {
      const res = await api.get("/auth/host/profile");
      return res.data?.data?.hostProfile ?? null;
    },
  });

  // Pre-fill the form from the existing host profile so a rejected applicant
  // can correct and resubmit without retyping everything.
  useEffect(() => {
    if (hostProfile) {
      setBusinessName(hostProfile.businessName ?? "");
      setRegistrationNo(hostProfile.registrationNo ?? "");
      setTaxId(hostProfile.taxId ?? "");
      setDocumentsUrl(hostProfile.documentsUrl ?? "");
    }
  }, [hostProfile]);

  // A freshly-approved host's JWT claim is stale (null) until re-minted, and
  // the backend gates listing endpoints on that claim — without a refresh,
  // /provider/* and /listings still 403 HOST_REQUIRED after approval. Refresh
  // the access token once; /auth/refresh now returns the fresh user object
  // (including hostStatus), so the auth store is updated by the refresh helper
  // and the dashboard gate no longer bounces an approved host back here.
  const refreshedApprovalRef = useRef(false);
  useEffect(() => {
    if (hostProfile?.status === "approved" && user?.hostStatus !== "approved" && !refreshedApprovalRef.current) {
      refreshedApprovalRef.current = true;
      refreshAccessToken().catch(() => {});
    }
  }, [hostProfile?.status, user?.hostStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = hostProfile?.status ?? null;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/auth/host/profile", {
        businessName: businessName.trim(),
        ...(registrationNo.trim() ? { registrationNo: registrationNo.trim() } : {}),
        ...(taxId.trim() ? { taxId: taxId.trim() } : {}),
        ...(documentsUrl.trim() ? { documentsUrl: documentsUrl.trim() } : {}),
      });
      if (!res.data?.success) throw res.data;
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["host-profile"] });
      updateUser({ hostStatus: "pending" } as never);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error?.message ?? "Could not submit your host application. Please try again.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    setError(null);
    mutation.mutate();
  }

  function StatusBanner() {
    if (status === "approved") {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-emerald-900">Host application approved</h3>
            <p className="text-sm text-emerald-700 mt-1">
              You can now create and manage listings.
            </p>
            <Button
              className="mt-3"
              onClick={() => router.push("/dashboard/listings")}
            >
              Go to My Listings
            </Button>
          </div>
        </div>
      );
    }
    if (status === "pending") {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900">Host application under review</h3>
            <p className="text-sm text-amber-700 mt-1">
              Our team is reviewing your business details. You'll be able to create listings once
              your application is approved. Submitting again below updates your application.
            </p>
          </div>
        </div>
      );
    }
    if (status === "rejected") {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
          <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Host application not approved</h3>
            <p className="text-sm text-red-700 mt-1">
              {hostProfile?.rejectionReason
                ? `Reason: ${hostProfile.rejectionReason}`
                : "Please correct the details below and resubmit your application."}
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHeader
        title="Host onboarding"
        subtitle="Become a host — fill in your business details to start listing properties"
        action={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Building2 className="h-4 w-4" />
            <span>Kainook Host</span>
          </div>
        }
      />

      {isLoading ? (
        <Card><p className="text-sm text-slate-400 py-4">Loading host profile…</p></Card>
      ) : (
        <>
          <StatusBanner />

          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="host-business-name"
                label="Business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Kainook Rentals Ltd"
                leftIcon={<Building2 className="h-4 w-4" />}
              />
              <Input
                id="host-registration-no"
                label="Business registration number"
                value={registrationNo}
                onChange={(e) => setRegistrationNo(e.target.value)}
                placeholder="Optional"
              />
              <Input
                id="host-tax-id"
                label="Tax ID"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="Optional"
              />
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Business documents URL
                </label>
                <Textarea
                  id="host-documents-url"
                  value={documentsUrl}
                  onChange={(e) => setDocumentsUrl(e.target.value)}
                  placeholder="Optional — link to business licence, permits, certificates"
                  className="min-h-[80px]"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" loading={mutation.isPending}>
                  {status === "pending" ? "Update application" : "Submit host application"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/")}>
                  Back to browsing
                </Button>
              </div>
            </form>
          </Card>

          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-slate-600">
            <FileText className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              You can book and browse the platform as a guest or a user at any time. Hosting is an
              additional step — once your application is approved you'll be able to create hotel,
              apartment and car listings from your dashboard.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
