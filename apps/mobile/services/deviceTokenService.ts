import { Platform } from "react-native";
import Constants from "expo-constants";
import { listingApi } from "../lib/listing-api";

/**
 * Expected backend device token registration payload structure.
 */
export interface DeviceTokenPayload {
  /** FCM registration token or APNs device token */
  token: string;
  /** Operating system platform */
  platform: "ios" | "android";
  /** Raw APNs token (iOS only) */
  apnsToken?: string | null;
  /** Unique hardware/device identifier or installation UUID */
  deviceId: string;
  /** Application version (e.g., "1.0.0") */
  appVersion: string;
  /** Application build number (e.g., "1") */
  buildNumber: string;
  /** User's local timezone (e.g., "America/New_York") */
  timezone: string;
  /** User's system locale identifier (e.g., "en-US") */
  locale: string;
}

/**
 * DeviceTokenService
 * Reusable token management service prepared for backend integration.
 */
export class DeviceTokenService {
  private static lastRegisteredToken: string | null = null;

  /**
   * Helper to construct complete device token payload metadata.
   */
  public static buildPayload(token: string, apnsToken?: string | null): DeviceTokenPayload {
    const platform = Platform.OS === "ios" ? "ios" : "android";
    const appVersion = Constants.manifest2?.extra?.expoClient?.version ?? Constants.expoConfig?.version ?? "1.0.0";
    const buildNumber = Platform.OS === "ios"
      ? (Constants.expoConfig?.ios?.buildNumber ?? "1")
      : (Constants.expoConfig?.android?.versionCode?.toString() ?? "1");

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
    const deviceId = Constants.installationId || `${platform}-${Date.now()}`;

    return {
      token,
      platform,
      apnsToken: apnsToken ?? null,
      deviceId,
      appVersion,
      buildNumber,
      timezone,
      locale,
    };
  }

  /**
   * Register device token with backend server.
   * TODO: Wire up to real backend endpoint when push notification service is deployed.
   * Expected backend payload:
   * {
   *   token: string,
   *   platform: "ios" | "android",
   *   apnsToken?: string | null,
   *   deviceId: string,
   *   appVersion: string,
   *   buildNumber: string,
   *   timezone: string,
   *   locale: string
   * }
   */
  public static async registerDeviceToken(payload: DeviceTokenPayload): Promise<void> {
    if (this.lastRegisteredToken === payload.token) {
      console.log("[DeviceTokenService] Duplicate registration prevented for token:", payload.token.slice(0, 10) + "...");
      return;
    }

    console.log("[DeviceTokenService] Registering device token with backend...", {
      platform: payload.platform,
      token: payload.token.slice(0, 15) + "...",
      deviceId: payload.deviceId,
      appVersion: payload.appVersion,
      timezone: payload.timezone,
    });

    try {
      // Integration with existing listingApi notification endpoint
      await listingApi.post("/notifications/register-device", {
        token: payload.token,
        platform: payload.platform === "ios" ? "apns" : "fcm",
      });
      this.lastRegisteredToken = payload.token;
      console.log("[DeviceTokenService] Successfully registered token with backend.");
    } catch (error) {
      console.error("[DeviceTokenService] Failed to register device token with backend:", error);
      throw error;
    }
  }

  /**
   * Update existing device token with backend server.
   */
  public static async updateDeviceToken(payload: DeviceTokenPayload): Promise<void> {
    console.log("[DeviceTokenService] Updating device token with backend...", {
      token: payload.token.slice(0, 15) + "...",
    });
    // TODO: Connect to PATCH /notifications/register-device endpoint when implemented
    await this.registerDeviceToken(payload);
  }

  /**
   * Remove device token from backend server (e.g. on logout).
   */
  public static async removeDeviceToken(token?: string): Promise<void> {
    console.log("[DeviceTokenService] Removing device token from backend...");
    try {
      if (token || this.lastRegisteredToken) {
        await listingApi.delete("/notifications/register-device", {
          data: { token: token || this.lastRegisteredToken },
        });
      }
      this.lastRegisteredToken = null;
      console.log("[DeviceTokenService] Device token removed from backend successfully.");
    } catch (error) {
      console.error("[DeviceTokenService] Failed to remove device token from backend:", error);
    }
  }

  /**
   * Handle token refresh by re-registering the updated token.
   */
  public static async refreshDeviceToken(newToken: string, apnsToken?: string | null): Promise<void> {
    console.log("[DeviceTokenService] Refreshing device token with backend...");
    const payload = this.buildPayload(newToken, apnsToken);
    this.lastRegisteredToken = null; // Reset cached token to force update
    await this.registerDeviceToken(payload);
  }
}
