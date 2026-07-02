import { 
  S3Client, 
  GetBucketPolicyCommand, 
  PutBucketPolicyCommand,
  GetPublicAccessBlockCommand,
  PutPublicAccessBlockCommand
} from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";

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

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env["AWS_ACCESS_KEY_ID"] ?? "",
    secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] ?? "",
  },
});

async function main() {
  console.log("Bucket:", BUCKET);
  console.log("Region:", REGION);

  // 1. Get Public Access Block status
  try {
    const pubBlock = await s3.send(new GetPublicAccessBlockCommand({ Bucket: BUCKET }));
    console.log("Public Access Block status:", JSON.stringify(pubBlock.PublicAccessBlockConfiguration, null, 2));
  } catch (err: any) {
    console.error("Could not get Public Access Block configuration:", err.message);
  }

  // 2. Get current Bucket Policy
  try {
    const policy = await s3.send(new GetBucketPolicyCommand({ Bucket: BUCKET }));
    console.log("Current Bucket Policy:", policy.Policy);
  } catch (err: any) {
    console.error("Could not get Bucket Policy:", err.message);
  }

  // 3. Let's try to disable Public Access Block if it blocks public policies
  try {
    console.log("Attempting to configure Public Access Block to allow public policies...");
    await s3.send(
      new PutPublicAccessBlockCommand({
        Bucket: BUCKET,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: false,
          IgnorePublicAcls: false,
          BlockPublicPolicy: false,
          RestrictPublicBuckets: false,
        },
      })
    );
    console.log("Successfully updated Public Access Block Configuration!");
  } catch (err: any) {
    console.error("Failed to update Public Access Block Configuration:", err.message);
  }

  // 4. Let's try to add a Bucket Policy that allows public reads for brand/*, profiles/*, and listings/*
  const policyDocument = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadForBrandProfilesListings",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: [
          `arn:aws:s3:::${BUCKET}/brand/*`,
          `arn:aws:s3:::${BUCKET}/profiles/*`,
          `arn:aws:s3:::${BUCKET}/listings/*`,
        ],
      },
    ],
  });

  try {
    console.log("Attempting to apply bucket policy for public access to brand/*, profiles/*, and listings/*...");
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: BUCKET,
        Policy: policyDocument,
      })
    );
    console.log("Successfully applied public read bucket policy!");
  } catch (err: any) {
    console.error("Failed to apply bucket policy:", err.message);
  }
}

main().catch(console.error);
