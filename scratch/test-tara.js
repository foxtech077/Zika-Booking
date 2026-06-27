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

async function run() {
  console.log("TARA_BASE_URL in env before import:", process.env.TARA_BASE_URL);
  const { initiateTaraPayment } = await import("../services/payment-service/src/lib/tara.js");
  
  console.log("TARA_BUSINESS_ID:", process.env.TARA_BUSINESS_ID);
  console.log("TARA_API_KEY:", process.env.TARA_API_KEY);

  try {
    const res = await initiateTaraPayment({
      amount: 100,
      currency: "xof",
      mobileNumber: "221771234567",
      reference: "KAINOOK-TEST-" + Date.now(),
      description: "Test Booking Reference",
      attemptNumber: 1
    });
    console.log("Success:", res);
  } catch (err) {
    console.error("Error occurred in initiateTaraPayment:");
    console.error(err);
  }
}

run();
