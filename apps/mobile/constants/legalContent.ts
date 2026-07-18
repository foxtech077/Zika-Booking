export const LEGAL_URLS = {
  terms: "https://kainook.com/legal/terms",
  privacy: "https://kainook.com/legal/privacy",
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




