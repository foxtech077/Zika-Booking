// Public web app origin. Used for links that must open the website —
// legal documents and shareable listing URLs.
export const WEB_BASE_URL = "https://kainook.com";

export const LEGAL_URLS = {
  terms: `${WEB_BASE_URL}/legal/terms`,
  privacy: `${WEB_BASE_URL}/legal/privacy`,
} as const;

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDocument {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}




