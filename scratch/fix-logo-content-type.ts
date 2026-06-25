import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";

// Manually parse root .env file
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf-8");
  envText.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  });
}

const REGION = process.env["AWS_REGION"] || "af-south-1";
const BUCKET = process.env["S3_BUCKET_NAME"] || "zika-storage";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env["AWS_ACCESS_KEY_ID"] ?? "",
    secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] ?? "",
  },
});

// The attached logo is a JPEG - use correct content type
const LOGO_FILE = "C:/Users/HP/.gemini/antigravity-ide/brain/e80e5323-65cf-49c2-b9f0-949670298640/media__1782125804005.jpg";

async function upload(key: string, contentType: string) {
  const body = fs.readFileSync(LOGO_FILE);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  console.log(`✅ Uploaded ${key} with ContentType: ${contentType}`);

  // Verify
  const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  console.log(`   Verified Content-Type on S3: ${head.ContentType}`);
  console.log(`   Content-Length: ${head.ContentLength} bytes`);
}

async function main() {
  console.log(`Source file exists: ${fs.existsSync(LOGO_FILE)}`);
  const raw = fs.readFileSync(LOGO_FILE);
  const magic = raw.slice(0, 4).toString("hex").toUpperCase().match(/../g)!.join(" ");
  console.log(`Source file magic bytes: ${magic} (FF D8 FF = JPEG, 89 50 4E 47 = PNG)`);
  console.log();

  // Upload the JPEG file correctly to the v2 key
  await upload("brand/kainook-logo-v2.jpeg", "image/jpeg");
  console.log();

  console.log("Done! The public URL to use in emails:");
  console.log("  https://zika-storage.s3.af-south-1.amazonaws.com/brand/kainook-logo-v2.jpeg");
}

main().catch(console.error);
