import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "./Button";

export function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
        <AlertCircle className="h-7 w-7 text-red-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
      <p className="text-sm text-slate-500 max-w-xs">
        You do not have permission to view this page. If you believe this is an error, please contact your administrator.
      </p>
      <Link href="/dashboard">
        <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}
