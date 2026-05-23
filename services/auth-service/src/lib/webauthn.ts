import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers";
import { getAndDeleteChallenge, setChallenge } from "./redis";

const RP_ID = process.env["WEBAUTHN_RP_ID"] ?? "admin.zikabooking.com";
const RP_NAME = process.env["WEBAUTHN_RP_NAME"] ?? "ZikaBooking Admin";
const ORIGIN = process.env["WEBAUTHN_ORIGIN"] ?? "https://admin.zikabooking.com";

// ── Registration ──────────────────────────────────────────────────────────────

export async function startRegistration(adminId: string, email: string) {
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(adminId),
    userName: email,
    userDisplayName: email,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "cross-platform",
    },
  });

  // Store challenge in Redis for 5 minutes
  await setChallenge(`webauthn:reg:${adminId}`, options.challenge, 300);

  return options;
}

export async function finishRegistration(
  adminId: string,
  credential: unknown,
): Promise<VerifiedRegistrationResponse> {
  const expectedChallenge = await getAndDeleteChallenge(`webauthn:reg:${adminId}`);
  if (!expectedChallenge) throw new Error("Challenge not found or expired");

  const verification = await verifyRegistrationResponse({
    response: credential as Parameters<typeof verifyRegistrationResponse>[0]["response"],
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  return verification;
}

// ── Authentication ────────────────────────────────────────────────────────────

export async function startAuthentication(
  adminId: string,
  credentialId: string,
  credentialPublicKey: string,
) {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: [
      {
        id: credentialId,
        transports: ["usb", "ble", "nfc", "internal"],
      },
    ],
    userVerification: "preferred",
  });

  await setChallenge(`webauthn:auth:${adminId}`, options.challenge, 300);
  return options;
}

export async function finishAuthentication(
  adminId: string,
  credential: unknown,
  storedCredential: { id: string; publicKey: string; counter: number },
): Promise<VerifiedAuthenticationResponse> {
  const expectedChallenge = await getAndDeleteChallenge(`webauthn:auth:${adminId}`);
  if (!expectedChallenge) throw new Error("Challenge not found or expired");

  const verification = await verifyAuthenticationResponse({
    response: credential as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: storedCredential.id,
      publicKey: isoBase64URL.toBuffer(storedCredential.publicKey),
      counter: storedCredential.counter,
    },
  });

  return verification;
}
