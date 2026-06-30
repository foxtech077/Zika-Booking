// Legal document content — corresponds to PDFs in assets/terms/
// Update this file whenever the canonical PDFs in assets/terms/ are revised.

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

export const TERMS_OF_USE: LegalDocument = {
  title: "Terms of Use",
  lastUpdated: "1 June 2025",
  intro:
    "Welcome to Kainook. By accessing or using our platform — including our mobile application and website — you agree to be bound by these Terms of Use. Please read them carefully before proceeding.",

  sections: [
    {
      heading: "1. Acceptance of Terms",
      body: "By creating an account or using any Kainook service, you confirm that you are at least 18 years old and agree to these Terms. If you are using Kainook on behalf of an organisation, you represent that you have authority to bind that organisation.",
    },
    {
      heading: "2. Platform Overview",
      body: "Kainook is a marketplace that connects travellers with accommodation providers and vehicle rental operators across Africa. We facilitate bookings but are not a party to the underlying rental or accommodation agreement between guests and providers.",
    },
    {
      heading: "3. Accounts",
      body: "You must provide accurate registration information and keep your account credentials secure. You are responsible for all activity under your account. Notify us immediately at support@kainook.com if you suspect unauthorised access.",
    },
    {
      heading: "4. Bookings & Payments",
      body: "Bookings are confirmed only upon successful payment processing. Prices are displayed in the currency of the listing and may include service fees and applicable taxes. All payments are processed through our secure payment partners (Stripe and Tara). Kainook charges a service fee — the effective rate for your region is shown in the app.",
    },
    {
      heading: "5. Cancellations & Refunds",
      body: "Cancellation and refund terms are determined by the individual listing's cancellation policy, which is displayed prior to booking. Kainook may facilitate refunds in accordance with these policies but does not guarantee refunds outside the stated policy.",
    },
    {
      heading: "6. Provider Obligations",
      body: "Providers must ensure their listings are accurately described, legally compliant, and meet all applicable local regulations. Providers must hold valid licences, permits, and insurance where required by law. Kainook may suspend or remove listings that do not meet these standards.",
    },
    {
      heading: "7. Guest Conduct",
      body: "Guests agree to use accommodations and vehicles with reasonable care and in compliance with the provider's house rules and applicable laws. Guests are liable for damage caused during their stay or rental period beyond normal wear and tear.",
    },
    {
      heading: "8. Intellectual Property",
      body: "All content on Kainook — including logos, design, text, and software — is the property of Kainook or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without express written permission.",
    },
    {
      heading: "9. Prohibited Activities",
      body: "You may not use Kainook to: post false or misleading information; engage in fraudulent transactions; harvest data without consent; attempt to bypass security measures; or violate any applicable law or regulation.",
    },
    {
      heading: "10. Limitation of Liability",
      body: "To the maximum extent permitted by law, Kainook's liability for any claim arising from use of the platform is limited to the amount of service fees paid by you in the six months preceding the claim. We are not liable for indirect, incidental, or consequential damages.",
    },
    {
      heading: "11. Indemnification",
      body: "You agree to indemnify and hold harmless Kainook and its officers, directors, employees, and agents from any claims, damages, or expenses (including legal fees) arising out of your use of the platform or violation of these Terms.",
    },
    {
      heading: "12. Governing Law",
      body: "These Terms are governed by the laws of the Republic of Kenya. Disputes arising from your use of Kainook shall be subject to the exclusive jurisdiction of the courts of Nairobi, Kenya, unless otherwise required by applicable consumer protection laws in your country of residence.",
    },
    {
      heading: "13. Changes to Terms",
      body: "We may update these Terms from time to time. We will notify you of material changes via the app or email. Continued use of Kainook after changes take effect constitutes your acceptance of the revised Terms.",
    },
    {
      heading: "14. Contact",
      body: "For questions about these Terms, please contact us at: legal@kainook.com or write to Kainook Ltd, Westlands, Nairobi, Kenya.",
    },
  ],
};

export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  lastUpdated: "1 June 2025",
  intro:
    "Kainook respects your privacy and is committed to protecting your personal data. This Privacy Policy explains what information we collect, how we use it, and your rights. It applies to our mobile app, website, and related services.",

  sections: [
    {
      heading: "1. Who We Are",
      body: "Kainook Ltd is the data controller for personal data collected through our platform. We are headquartered in Nairobi, Kenya. For privacy-related enquiries, contact: privacy@kainook.com.",
    },
    {
      heading: "2. Data We Collect",
      body: "We collect: (a) Account information — name, email address, phone number, and country. (b) Identity & compliance documents uploaded by providers. (c) Booking and transaction data — dates, amounts, listing details. (d) Payment data — handled by our payment processors; we do not store full card details. (e) Device & usage data — IP address, device type, app version, and navigation logs for security and analytics. (f) Location data — only when you grant permission, to show nearby listings.",
    },
    {
      heading: "3. How We Use Your Data",
      body: "We use your data to: process registrations, bookings, and payments; verify provider eligibility and compliance; send booking confirmations, receipts, and operational notifications; improve platform features through aggregated analytics; prevent fraud and maintain platform security; and comply with applicable laws.",
    },
    {
      heading: "4. Legal Basis for Processing",
      body: "We process your data under the following bases: (a) Contract — to fulfil your booking or provider agreement. (b) Legal obligation — for KYC, tax, and regulatory compliance. (c) Legitimate interests — for fraud prevention and platform improvement. (d) Consent — for marketing communications, which you may withdraw at any time.",
    },
    {
      heading: "5. Data Sharing",
      body: "We share your data with: (a) Providers — guests' names and contact details shared with the provider for the purpose of fulfilling the booking. (b) Payment processors — Stripe and Tara, for payment processing. (c) Cloud & infrastructure providers — AWS, for hosting and storage. (d) Legal authorities — when required by law or to protect rights. We do not sell your personal data.",
    },
    {
      heading: "6. Data Retention",
      body: "We retain your account data for as long as your account is active. Transaction records are retained for 7 years for legal and tax compliance. Uploaded compliance documents are retained for 5 years or as required by applicable regulation. You may request deletion of your account, subject to legal retention requirements.",
    },
    {
      heading: "7. Your Rights",
      body: "Depending on your jurisdiction, you may have the right to: access a copy of your personal data; correct inaccurate information; request deletion ('right to be forgotten'); restrict or object to processing; data portability; and withdraw consent. To exercise your rights, contact privacy@kainook.com.",
    },
    {
      heading: "8. Cookies & Tracking",
      body: "Our mobile app does not use browser cookies. We use secure storage (SecureStore) on your device to maintain your session. We use anonymised analytics to understand feature usage. You can disable analytics tracking in your account settings.",
    },
    {
      heading: "9. Security",
      body: "We implement industry-standard security measures including encrypted data transmission (TLS), access controls, and regular security audits. While we strive to protect your data, no system is completely secure and we cannot guarantee absolute security.",
    },
    {
      heading: "10. International Transfers",
      body: "Your data may be processed on servers located outside your country of residence. Where data is transferred internationally, we ensure appropriate safeguards are in place, including standard contractual clauses or equivalent mechanisms.",
    },
    {
      heading: "11. Children's Privacy",
      body: "Kainook is not intended for individuals under 18 years of age. We do not knowingly collect personal data from children. If you believe a child has provided us with their data, please contact us immediately.",
    },
    {
      heading: "12. Changes to This Policy",
      body: "We may update this Privacy Policy periodically. We will notify you of significant changes through the app. The 'Last Updated' date at the top of this document indicates when it was last revised.",
    },
    {
      heading: "13. Contact Us",
      body: "For privacy enquiries or to exercise your rights, contact: privacy@kainook.com\n\nKainook Ltd\nWestlands, Nairobi, Kenya",
    },
  ],
};
