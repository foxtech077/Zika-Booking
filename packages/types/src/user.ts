export type UserStatus = "pending_verification" | "active" | "suspended" | "banned";
export type UserType = "user";
export type OAuthProvider = "google" | "apple";
export type LoyaltyTier = "bronze" | "silver" | "gold" | "diamond";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: UserStatus;
  userType: UserType;
  businessName?: string | null;
  country?: string | null;
  emailVerified: boolean;
  emailVerifiedAt?: string | null;
  oauthProvider?: OAuthProvider | null;
  currentTier: LoyaltyTier;
  loyaltyPoints: number;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: UserStatus;
  userType: UserType;
  businessName?: string | null;
  country?: string | null;
  emailVerified: boolean;
  currentTier: LoyaltyTier;
  loyaltyPoints: number;
  photoUrl?: string | null;
  requiresTermsAcceptance?: boolean;
  requiresPrivacyAcceptance?: boolean;
  termsAcceptedAt?: string | Date | null;
  privacyAcceptedAt?: string | Date | null;
}

export type AdminRole =
  | "super_admin"
  | "admin"
  | "country_manager"
  | "sales"
  | "support"
  | "finance";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  countryScope: string[];
  totpEnabled: boolean;
  fido2Registered: boolean;
  createdAt: string;
}
