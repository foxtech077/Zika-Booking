import "dotenv/config";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

const envPath = path.resolve("services/payment-service/.env");
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const TARA_API_KEY = process.env.TARA_API_KEY ?? "";
const TARA_BUSINESS_ID = process.env.TARA_BUSINESS_ID ?? "";

async function testRequest(endpoint) {
  try {
    const res = await fetch(`https://www.dklo.co${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: TARA_API_KEY,
        businessId: TARA_BUSINESS_ID,
      })
    });
    const text = await res.text();
    const isJson = text.trim().startsWith("{");
    console.log(`Endpoint: ${endpoint} => Status: ${res.status}, IsJSON: ${isJson}, Preview: ${text.substring(0, 100).replace(/\n/g, "")}`);
  } catch (err) {
    console.error(`Endpoint: ${endpoint} => Failed: ${err.message}`);
  }
}

async function run() {
  const endpoints = [
    "/v1/refunds",
    "/api/tara/refund",
    "/api/tara/refunds",
    "/api/tara/reversal",
    "/api/tara/reverse",
    "/api/tara/cancel"
  ];
  for (const ep of endpoints) {
    await testRequest(ep);
  }
}

run();
