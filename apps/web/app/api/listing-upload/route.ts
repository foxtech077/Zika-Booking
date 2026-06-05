import { type NextRequest, NextResponse } from "next/server";

// Use NEXT_PUBLIC_LISTING_API_URL as-is for server-side calls.
//
// The API gateway strips the /listings prefix before forwarding to the service,
// so the path we build (/listings/{id}/...) combined with the base that already
// ends in /listings produces the double-prefix the gateway expects:
//
//   base  = https://api.kainook.com/listings
//   path  = /listings/{id}/photos/presign
//   → gateway sees: /listings/listings/{id}/photos/presign
//   → gateway strips /listings/ → service receives: /listings/{id}/photos/presign ✓
//
// For local dev (base = http://localhost:3003, no /listings suffix) the path
// /listings/{id}/photos/presign is appended directly, which also maps correctly.
const LISTING_API_BASE =
  process.env.NEXT_PUBLIC_LISTING_API_URL ?? "http://localhost:3003";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const file       = formData.get("file")        as File   | null;
    const listingId  = formData.get("listingId")   as string | null;
    const uploadType = formData.get("uploadType")  as string | null; // "photo" | "document"
    const docType    = formData.get("documentType")as string | null;
    const auth       = request.headers.get("authorization");

    if (!file || !listingId || !uploadType) {
      return NextResponse.json(
        { error: "Missing required fields: file, listingId, uploadType" },
        { status: 400 },
      );
    }

    // ── Step 1: obtain a presigned URL from the listing service ───────────────
    const presignPath =
      uploadType === "document"
        ? `/listings/${listingId}/documents/presign`
        : `/listings/${listingId}/photos/presign`;

    const presignBody =
      uploadType === "document"
        ? { contentType: file.type, documentType: docType }
        : { contentType: file.type, filename: file.name };

    const presignRes = await fetch(`${LISTING_API_BASE}${presignPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body: JSON.stringify(presignBody),
    });

    if (!presignRes.ok) {
      const body = await presignRes.json().catch(() => ({}));
      return NextResponse.json(body, { status: presignRes.status });
    }

    const presignJson = await presignRes.json();
    const { uploadUrl, s3Key } = presignJson.data ?? presignJson;

    if (!uploadUrl || !s3Key) {
      return NextResponse.json(
        { error: "Presign response is missing uploadUrl or s3Key" },
        { status: 502 },
      );
    }

    // ── Step 2: upload to S3 (server-to-server — no browser CORS involved) ────
    const fileBytes = await file.arrayBuffer();
    const s3Res = await fetch(uploadUrl, {
      method: "PUT",
      body: fileBytes,
      headers: { "Content-Type": file.type },
    });

    if (!s3Res.ok) {
      return NextResponse.json(
        { error: `S3 upload failed (HTTP ${s3Res.status})` },
        { status: 502 },
      );
    }

    // Return s3Key so the client can call the listing-service /confirm endpoint
    return NextResponse.json({ s3Key });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected upload error" },
      { status: 500 },
    );
  }
}
