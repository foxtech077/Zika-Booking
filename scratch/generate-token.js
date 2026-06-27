import "dotenv/config";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { SignJWT } from "jose";

const envPath = path.resolve("services/payment-service/.env");
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

async function run() {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600; // 1 hour

  const payload = {
    sub: "cmqozll1v0007v4z0ixb66939",
    type: "guest",
    status: "active",
    jti: Math.random().toString(36).substring(2, 10),
  };

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(JWT_SECRET);

  console.log("GENERATED_TOKEN:", jwt);
}

run();
