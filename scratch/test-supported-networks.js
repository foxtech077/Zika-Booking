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
const TARA_WEBHOOK_URL = process.env.TARA_WEBHOOK_URL ?? "";

async function testRequest(body) {
  try {
    const res = await fetch("https://www.dklo.co/api/tara/mobilepay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    console.log(`Network: ${body.network}, Currency: ${body.currency}, Number: ${body.phoneNumber} => Response: ${text}`);
  } catch (err) {
    console.error(`Failed: ${err.message}`);
  }
}

async function run() {
  const networks = ["m-pesa", "mpesa", "safaricom", "mtn", "orange", "airtel", "wave", "vodafone", "telecel", "tigo", "moov"];
  
  console.log("--- Testing Kenya (KES) ---");
  for (const net of networks) {
    await testRequest({
      apiKey: TARA_API_KEY,
      businessId: TARA_BUSINESS_ID,
      productId: "product-123",
      productName: "Test Product",
      network: net,
      productPrice: 100,
      phoneNumber: "254712345678",
      webhookUrl: TARA_WEBHOOK_URL,
      currency: "kes"
    });
  }

  console.log("--- Testing Senegal (XOF) ---");
  for (const net of ["wave", "orange", "free"]) {
    await testRequest({
      apiKey: TARA_API_KEY,
      businessId: TARA_BUSINESS_ID,
      productId: "product-123",
      productName: "Test Product",
      network: net,
      productPrice: 100,
      phoneNumber: "221771234567",
      webhookUrl: TARA_WEBHOOK_URL,
      currency: "xof"
    });
  }
}

run();
