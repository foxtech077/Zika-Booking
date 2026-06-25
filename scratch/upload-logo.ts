import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import fetch from "node-fetch";

// Manually parse .env file
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf-8");
  envText.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  });
}

const REGION = process.env["AWS_REGION"] || "af-south-1";
const BUCKET = process.env["S3_BUCKET_NAME"] || "zika-storage";

console.log("Region:", REGION);
console.log("Bucket:", BUCKET);

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env["AWS_ACCESS_KEY_ID"] ?? "",
    secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] ?? "",
  },
});

async function verifyUrl(url: string) {
  try {
    const res = await fetch(url);
    console.log(`URL: ${url} -> Status: ${res.status} (${res.statusText})`);
    if (res.status === 200) {
      console.log("Successfully verified public access (HTTP 200 OK)!");
    } else {
      console.error("Access check failed!");
      const body = await res.text();
      console.error(body.slice(0, 500));
    }
  } catch (err) {
    console.error("Error fetching URL:", err);
  }
}

async function main() {
  const filePath = "C:/Users/HP/.gemini/antigravity-ide/brain/e80e5323-65cf-49c2-b9f0-949670298640/media__1782125804005.jpg";
  if (!fs.existsSync(filePath)) {
    console.error("Attached image not found at path:", filePath);
    return;
  }
  const fileBuffer = fs.readFileSync(filePath);

  // Upload to brand/kainook-logo.png
  console.log("Uploading to brand/kainook-logo.png with public-read ACL...");
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "brand/kainook-logo.png",
        Body: fileBuffer,
        ContentType: "image/png",
        ACL: "public-read",
      })
    );
    console.log("Successfully uploaded to brand/kainook-logo.png");
  } catch (err: any) {
    console.error("Failed to upload with public-read ACL:", err.message);
    console.log("Trying upload without ACL...");
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "brand/kainook-logo.png",
        Body: fileBuffer,
        ContentType: "image/png",
      })
    );
    console.log("Uploaded without ACL.");
  }

  // Upload to brand/kainook-logo.jpeg
  console.log("Uploading to brand/kainook-logo.jpeg with public-read ACL...");
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "brand/kainook-logo.jpeg",
        Body: fileBuffer,
        ContentType: "image/jpeg",
        ACL: "public-read",
      })
    );
    console.log("Successfully uploaded to brand/kainook-logo.jpeg");
  } catch (err: any) {
    console.error("Failed to upload with public-read ACL:", err.message);
    console.log("Trying upload without ACL...");
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "brand/kainook-logo.jpeg",
        Body: fileBuffer,
        ContentType: "image/jpeg",
      })
    );
    console.log("Uploaded without ACL.");
  }

  console.log("\nVerifying public access URLs:");
  await verifyUrl("https://zika-storage.s3.af-south-1.amazonaws.com/brand/kainook-logo.png");
  await verifyUrl("https://zika-storage.s3.af-south-1.amazonaws.com/brand/kainook-logo.jpeg");
}

main().catch(console.error);
