import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET_CONFIGS: { host: string; bucket: string; region: string }[] = [
  {
    host: "zika-storage.s3.af-south-1.amazonaws.com",
    bucket: process.env.S3_BUCKET_NAME ?? "zika-storage",
    region: process.env.AWS_REGION ?? "af-south-1",
  },
  {
    host: "zika-listings.s3.us-east-1.amazonaws.com",
    bucket: process.env.S3_LISTINGS_BUCKET_NAME ?? "zika-listings",
    region: "us-east-1",
  },
];

function resolveConfig(rawUrl: string) {
  for (const cfg of BUCKET_CONFIGS) {
    if (rawUrl.includes(cfg.host)) {
      const key = rawUrl.split(`${cfg.host}/`)[1]?.split("?")[0] ?? "";
      return { bucket: cfg.bucket, region: cfg.region, key };
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) return new NextResponse("Missing url", { status: 400 });

  const config = resolveConfig(rawUrl);
  if (!config || !config.key) return new NextResponse("Unrecognised S3 URL", { status: 400 });

  const s3 = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },
  });

  try {
    const command = new GetObjectCommand({ Bucket: config.bucket, Key: config.key });
    const presigned = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return NextResponse.redirect(presigned, { status: 302 });
  } catch {
    return new NextResponse("Image not found", { status: 404 });
  }
}
