// Source: assets/terms/Kainook_Help_FAQ.pdf — Version June 2026

export type FAQCategory = "about" | "guests" | "providers" | "general";

export interface FAQItem {
  q: string;
  a: string;
  tip?: string;
}

export interface FAQSection {
  id: string;
  title: string;
  category: FAQCategory;
  icon: string;
  items: FAQItem[];
}

export const FAQ_SECTIONS: FAQSection[] = [
  // ── About Kainook ─────────────────────────────────────────────────────────
  {
    id: "about",
    title: "About Kainook",
    category: "about",
    icon: "globe-outline",
    items: [
      {
        q: "What is Kainook?",
        a: "Kainook is an online travel marketplace connecting travellers with hotels, apartments, and car rental providers across Africa and internationally. Think of us as a platform — like Booking.com or Airbnb — focused on Africa, built for both African travellers and the global diaspora.",
      },
      {
        q: "Who owns and operates Kainook?",
        a: "Kainook is operated by Kainook Travel OÜ, a private limited company registered in Tallinn, Estonia. Our platform serves travellers and providers across Africa and beyond.",
      },
      {
        q: "Is Kainook a travel agency?",
        a: "No. Kainook is a technology marketplace, not a travel agency. We do not own or operate any hotel, apartment, or car rental fleet. All travel services are provided by independent Providers listed on the Platform. When you book through Kainook, your contract is directly with the Provider.",
      },
      {
        q: "What countries does Kainook cover?",
        a: "Kainook is focused on destinations across Africa and is open to travellers worldwide, including the African diaspora and international visitors. Coverage is expanding continuously — check the Platform for current destination availability.",
      },
      {
        q: "In what languages is the Platform available?",
        a: "The Platform is currently available in English and French. Additional languages may be added as we expand.",
      },
      {
        q: "What currencies are supported?",
        a: "Kainook supports multiple currencies. Prices are displayed in the currency selected in your account settings or detected from your location. Payment is processed in the currency shown at checkout.",
      },
    ],
  },

  // ── 1.1 Account & Registration ────────────────────────────────────────────
  {
    id: "account",
    title: "Account & Registration",
    category: "guests",
    icon: "person-circle-outline",
    items: [
      {
        q: "How do I create a Kainook account?",
        a: "Download the Kainook app (iOS or Android) or visit www.kainook.com. Tap \"Sign Up\", enter your name, email address, and a password, then verify your email. You can also sign up using your Google, Apple, or Facebook account.",
      },
      {
        q: "Can I use Kainook without creating an account?",
        a: "You can browse listings without an account, but you must be registered and logged in to make a booking.",
      },
      {
        q: "I forgot my password. What should I do?",
        a: "On the login screen, tap \"Forgot Password?\" and enter your registered email address. You will receive a password reset link within a few minutes. Check your spam folder if you do not see it in your inbox.",
      },
      {
        q: "How do I update my personal details?",
        a: "Go to Account Settings in the app or website, select \"Personal Information\", and update your details. Changes are saved immediately.",
      },
      {
        q: "How do I delete my account?",
        a: "Go to Account Settings → Privacy → Delete My Account. Note that you must cancel all active bookings before your account can be deleted. Certain data (transaction records, fraud logs) is retained as required by law. See our Privacy Policy for full details.",
        tip: "Account deletion is irreversible. Your AfriPoints balance will be forfeited upon deletion.",
      },
    ],
  },

  // ── 1.2 Searching & Booking ───────────────────────────────────────────────
  {
    id: "booking",
    title: "Searching & Booking",
    category: "guests",
    icon: "search-outline",
    items: [
      {
        q: "How do I search for accommodation or a car?",
        a: "On the home screen, select your category (Hotels, Apartments, or Car Rental), enter your destination and travel dates, and tap Search. Use the filters to refine by price, star rating, amenities, and more.",
      },
      {
        q: "How do I make a booking?",
        a: "Select your preferred listing, review the details and policies, choose your room or vehicle type, and tap \"Book Now\". Follow the steps to enter guest details and complete payment. You will receive a booking confirmation by email and in-app notification.",
      },
      {
        q: "Is my booking confirmed immediately?",
        a: "For most listings, your booking is confirmed instantly upon payment. Some properties operate on a \"Request to Book\" basis — in this case you will be notified within 24 hours whether the Provider has accepted your request.",
      },
      {
        q: "Can I book for someone else?",
        a: "Yes. During checkout, you can enter the name and details of the primary guest if different from the account holder. Ensure the details match the guest's ID as it may be checked at check-in.",
      },
      {
        q: "What is the booking reference number?",
        a: "Every confirmed booking is assigned a unique reference in the format ZIKA-XXXX-CC (where CC is the two-letter country code). Use this reference for all correspondence with Kainook support or the Provider.",
      },
      {
        q: "How far in advance can I book?",
        a: "Booking windows vary by Provider. Most listings allow bookings up to 12 months in advance. Check the individual listing for availability.",
      },
    ],
  },

  // ── 1.3 Payments ─────────────────────────────────────────────────────────
  {
    id: "payments-guest",
    title: "Payments",
    category: "guests",
    icon: "card-outline",
    items: [
      {
        q: "What payment methods does Kainook accept?",
        a: "Kainook supports two payment methods: international card payments (Visa, Mastercard and others) processed via Stripe, and African mobile money payments processed via Tara. Available options are displayed at checkout depending on your location.",
      },
      {
        q: "When is my payment charged?",
        a: "For prepaid bookings, your card or mobile money account is charged immediately upon booking confirmation. For \"pay at property\" bookings, payment is collected by the Provider at check-in as specified in the listing.",
      },
      {
        q: "When does the Provider receive my payment?",
        a: "Where Kainook collects payment on behalf of the Provider, the funds are transferred to the Provider within 24 hours of your check-in. This protects you — payment is only settled once you have physically taken possession of the service.",
      },
      {
        q: "Is my payment secure?",
        a: "Yes. Card payments are processed by Stripe, a PCI DSS Level 1 certified payment provider. Mobile money payments are handled by Tara. Kainook never stores your full card number on our servers.",
      },
      {
        q: "I was charged but did not receive a confirmation. What do I do?",
        a: "Contact Kainook support immediately at info@kainook.com or through the Help section in the app. Include your payment reference and the date of the transaction. We will investigate and resolve within 2 business days.",
      },
      {
        q: "Can I pay in instalments?",
        a: "Instalment payments are not currently supported on Kainook. Full payment is required at checkout for prepaid bookings.",
      },
    ],
  },

  // ── 1.4 Cancellations & Refunds ───────────────────────────────────────────
  {
    id: "cancellations",
    title: "Cancellations & Refunds",
    category: "guests",
    icon: "return-down-back-outline",
    items: [
      {
        q: "How do I cancel a booking?",
        a: "Go to My Bookings in the app or website, select the booking you wish to cancel, and tap \"Cancel Booking\". You will see the applicable refund amount before confirming the cancellation.",
      },
      {
        q: "What is the cancellation policy?",
        a: "Each Provider sets their own cancellation policy. The full policy is displayed on the listing page and during checkout before you confirm your booking. Policies range from fully flexible (free cancellation up to 24 hours before arrival) to non-refundable. Always review this before booking.",
      },
      {
        q: "How long does a refund take?",
        a: "Once a cancellation is confirmed, Kainook processes the refund within 5 business days. The time for the credit to appear in your account depends on your bank or mobile money provider, which is outside Kainook's control.",
      },
      {
        q: "What happens if I do not show up (no-show)?",
        a: "If you fail to check in without cancelling in advance, the Provider may charge a no-show fee up to the full booking amount in accordance with their policy. Kainook strongly recommends contacting the Provider through in-app messaging if you are delayed or unable to arrive.",
      },
      {
        q: "Can I modify my booking dates?",
        a: "Modification requests (change of dates, number of guests) are subject to Provider approval and may incur additional charges. Submit modification requests via the Platform through My Bookings. Modifications are not guaranteed and depend on availability.",
      },
      {
        q: "What if the Provider cancels my booking?",
        a: "If a Provider cancels a confirmed booking, you are entitled to a full refund of all amounts paid. Kainook will also assist you in finding alternative accommodation where possible. Contact support at info@kainook.com.",
      },
      {
        q: "What if the service I received was significantly different from what was advertised?",
        a: "If the Travel Service was materially different from the listing description (e.g., wrong room type, missing advertised amenities, uninhabitable condition), contact Kainook support with photographic evidence within 24 hours of check-in. We will investigate and, if your claim is substantiated, issue a full or partial refund and take action against the Provider.",
        tip: "Document issues with photos and timestamps as soon as you notice them.",
      },
    ],
  },

  // ── 1.5 Check-In & Stay ───────────────────────────────────────────────────
  {
    id: "checkin",
    title: "Check-In & Stay",
    category: "guests",
    icon: "key-outline",
    items: [
      {
        q: "What do I need at check-in?",
        a: "Present your booking confirmation (email or in-app voucher) and a valid photo ID. Some properties may also require the payment card used for the booking. Check the listing for any specific check-in requirements.",
      },
      {
        q: "What are the check-in and check-out times?",
        a: "Check-in and check-out times are set by each Provider and displayed on the listing. If you need early check-in or late check-out, contact the Provider through in-app messaging in advance to check availability (additional charges may apply).",
      },
      {
        q: "Can I contact the Provider before arrival?",
        a: "Yes. Once your booking is confirmed, use the in-app messaging system to communicate directly with the Provider. For security and marketplace integrity, please keep all communications within the Platform — do not share personal contact details.",
        tip: "Sharing phone numbers or email addresses in messages to bypass the Platform is a violation of our Terms of Use.",
      },
      {
        q: "What if I arrive late?",
        a: "Notify the Provider via in-app messaging as early as possible. Failure to notify may result in a no-show cancellation by the Provider. Most Providers are accommodating when given advance notice.",
      },
    ],
  },

  // ── 1.6 Reviews & AfriPoints ──────────────────────────────────────────────
  {
    id: "reviews-afripoints",
    title: "Reviews & AfriPoints",
    category: "guests",
    icon: "star-outline",
    items: [
      {
        q: "How do I leave a review?",
        a: "After your stay or rental period ends, you will receive an in-app prompt to rate your experience. Tap the notification or go to My Bookings and select the completed booking to submit your review. Reviews can be submitted up to 14 days after check-out.",
      },
      {
        q: "Can a Provider remove my review?",
        a: "No. Providers cannot remove or edit guest reviews. Kainook may remove reviews that violate our content guidelines (e.g., offensive language, fake reviews, content unrelated to the booking experience). Genuine, factual reviews — even negative ones — are protected.",
      },
      {
        q: "What are AfriPoints?",
        a: "AfriPoints is Kainook's loyalty rewards programme. You earn points on qualifying bookings, which can be redeemed for discounts on future bookings. The programme has four tiers: Bronze, Silver, Gold, and Diamond — each unlocking additional benefits.",
      },
      {
        q: "How do I check my AfriPoints balance?",
        a: "Go to Account → AfriPoints in the app or website to view your current balance, tier status, and transaction history.",
      },
      {
        q: "Do AfriPoints expire?",
        a: "AfriPoints that remain inactive (no qualifying booking) for 12 consecutive months will expire. Points are also forfeited if you delete your account. Check the AfriPoints programme terms in the app for full details.",
      },
    ],
  },

  // ── 2.1 Getting Listed ────────────────────────────────────────────────────
  {
    id: "getting-listed",
    title: "Getting Listed on Kainook",
    category: "providers",
    icon: "home-outline",
    items: [
      {
        q: "Who can list on Kainook?",
        a: "Any legitimate business or individual operating a hotel, apartment/residence, or vehicle rental service in a Kainook-supported market can apply to list. You must hold all required local licences, permits, and insurance for your business category.",
      },
      {
        q: "How do I register as a Provider?",
        a: "Visit www.kainook.com/provider or tap \"List Your Property\" in the app. Complete the Provider registration form, upload your business details and required documents, and submit for review. Our team will review your application and respond within 5 business days.",
      },
      {
        q: "Is there a fee to list on Kainook?",
        a: "Listing on Kainook is free. Kainook charges a commission on confirmed bookings. Commission rates vary by market and are clearly communicated during onboarding and displayed in your Provider Dashboard.",
      },
      {
        q: "How are hotels approved vs apartments and car rentals?",
        a: "Hotels undergo a manual accreditation and star rating review by Kainook's administration team before their listing goes live. Apartments and car rental listings are activated automatically once documentation requirements are met, subject to ongoing quality monitoring.",
      },
      {
        q: "What documents do I need to submit?",
        a: "Requirements vary by category. Generally: business registration certificate, proof of address, valid operating licence, insurance documents, and bank account details for payouts. Full requirements are listed in the Provider onboarding flow.",
      },
    ],
  },

  // ── 2.2 Managing Your Listing ─────────────────────────────────────────────
  {
    id: "managing-listing",
    title: "Managing Your Listing",
    category: "providers",
    icon: "settings-outline",
    items: [
      {
        q: "How do I update my listing (prices, photos, description)?",
        a: "Log in to your Provider Dashboard at www.kainook.com/dashboard or through the app. Go to My Listings, select the listing you wish to edit, and make your changes. Updates to descriptions and photos are reflected on the Platform within a few hours.",
      },
      {
        q: "How do I manage availability?",
        a: "Use the Availability Calendar in your Provider Dashboard to block dates, set minimum stays, and manage inventory. You can also sync your availability with Airbnb and Booking.com via iCal — set up the sync under Settings → Channel Manager. Availability syncs every 15 minutes.",
      },
      {
        q: "What is the iCal channel manager sync?",
        a: "The iCal sync allows your Kainook calendar to stay in sync with other platforms (Airbnb, Booking.com) to prevent double bookings. Availability updates are polled every 15 minutes. Set it up in your Dashboard under Settings → Channel Manager.",
      },
      {
        q: "A Guest has just requested a booking. How long do I have to respond?",
        a: "For Request-to-Book listings, you have 24 hours to accept or decline. If you do not respond within 24 hours, the request expires automatically and the Guest is not charged. We recommend keeping your availability calendar up to date to minimise declined requests.",
      },
      {
        q: "Can I set different prices for different dates or seasons?",
        a: "Yes. Use the Pricing section of your Dashboard to set date-specific rates, seasonal pricing, weekend rates, and length-of-stay discounts. Your rates can be updated at any time.",
      },
      {
        q: "Can I set my own cancellation policy?",
        a: "Yes. You can select from Kainook's standard cancellation policy templates (Flexible, Moderate, Strict, Non-Refundable) or configure a custom policy. Your policy is displayed to Guests on your listing and during checkout.",
      },
    ],
  },

  // ── 2.3 Bookings & Guests ─────────────────────────────────────────────────
  {
    id: "provider-bookings",
    title: "Bookings & Guests",
    category: "providers",
    icon: "calendar-outline",
    items: [
      {
        q: "How am I notified of a new booking?",
        a: "You will receive an instant push notification in the app, an email to your registered address, and a notification in your Provider Dashboard whenever a new booking is confirmed or a new request is received.",
      },
      {
        q: "How do I communicate with Guests?",
        a: "Use the in-app messaging system accessible from your Dashboard or the booking details screen. All Guest–Provider communication must remain within the Platform. Do not share personal contact details through the messaging system.",
      },
      {
        q: "A Guest did not show up. What should I do?",
        a: "Mark the booking as a No-Show in your Dashboard within 2 hours of the scheduled check-in time. This triggers the no-show policy and, if applicable, allows you to retain the applicable fee per your cancellation policy. Contact support if you need assistance.",
      },
      {
        q: "Can I cancel a confirmed Guest booking?",
        a: "Provider-initiated cancellations are strongly discouraged and may result in penalties, reduced listing visibility, or suspension. If you must cancel due to exceptional circumstances (force majeure, property damage), contact Kainook support immediately at info@kainook.com. The Guest will receive a full refund.",
      },
    ],
  },

  // ── 2.4 Payments & Payouts ────────────────────────────────────────────────
  {
    id: "payouts",
    title: "Payments & Payouts",
    category: "providers",
    icon: "wallet-outline",
    items: [
      {
        q: "When do I receive payment for a booking?",
        a: "Where payment is collected by Kainook, funds are transferred to your Provider account within 24 hours of Guest check-in. This applies to all prepaid bookings processed through the Platform.",
      },
      {
        q: "How are payouts processed?",
        a: "Payouts are made to your registered bank account or mobile money account. You can view your payout schedule and history in your Provider Dashboard under Financials → Payouts.",
      },
      {
        q: "What commission does Kainook charge?",
        a: "Kainook charges a commission on each confirmed booking. Your specific commission rate is shown in your Provider Dashboard under Financials and was agreed during onboarding. Kainook reserves the right to adjust commission rates with 30 days' notice.",
      },
      {
        q: "What happens to the payment if a Guest cancels?",
        a: "Refunds to Guests are determined by your cancellation policy. If a Guest cancels within your free cancellation window, any collected funds are refunded to the Guest. If they cancel outside the window, the applicable fee is retained and paid out to you per your policy.",
      },
      {
        q: "How do I update my payout bank account details?",
        a: "Go to Dashboard → Settings → Payout Details to update your bank account or mobile money information. For security, changes to payout details require identity re-verification and take 48 hours to activate.",
      },
    ],
  },

  // ── 2.5 Reviews & Quality ─────────────────────────────────────────────────
  {
    id: "provider-reviews",
    title: "Reviews & Quality",
    category: "providers",
    icon: "ribbon-outline",
    items: [
      {
        q: "How does the review system work?",
        a: "After each completed stay or rental, Guests are invited to rate their experience from 1 to 5 stars and leave a written review. Your overall rating is the average of all verified reviews and is displayed prominently on your listing.",
      },
      {
        q: "Can I respond to Guest reviews?",
        a: "Yes. You can post a public response to any Guest review from your Dashboard. Responding professionally to all reviews — especially negative ones — demonstrates good service and builds trust with future Guests.",
      },
      {
        q: "What happens if I receive consistently poor reviews?",
        a: "Listings that receive two consecutive reviews rated 1–2 stars may be automatically suspended pending review. You will be notified immediately and given the opportunity to respond and appeal. Kainook may investigate and work with you to address the issues.",
        tip: "Maintaining accurate listings and communicating proactively with Guests is the best way to avoid poor reviews.",
      },
      {
        q: "Can I report a fraudulent or unfair review?",
        a: "Yes. If you believe a review is fake, malicious, or violates Kainook's content guidelines, flag it through your Dashboard. Our moderation team will investigate and remove reviews that do not meet our standards.",
      },
    ],
  },

  // ── 3.1 Safety & Trust ────────────────────────────────────────────────────
  {
    id: "safety",
    title: "Safety & Trust",
    category: "general",
    icon: "shield-checkmark-outline",
    items: [
      {
        q: "How does Kainook verify Providers?",
        a: "All Providers must submit business registration documents, licences, and insurance before listing. Hotels also undergo a manual accreditation review. Kainook monitors Provider performance through Guest reviews, complaint reports, and periodic audits.",
      },
      {
        q: "Is it safe to pay through Kainook?",
        a: "Yes. All payments are processed by PCI DSS-certified processors (Stripe for cards, Tara for mobile money). Kainook never stores your full card number. Additionally, Kainook holds payment and only transfers funds to the Provider 24 hours after check-in, giving you an added layer of protection.",
      },
      {
        q: "What should I do if I suspect fraud on the Platform?",
        a: "Contact Kainook immediately at info@kainook.com with full details. Do not proceed with any payment outside the Platform. Kainook will investigate all fraud reports promptly.",
      },
      {
        q: "Why can I not share my phone number or email in messages?",
        a: "The in-app messaging system automatically filters personal contact details to protect both Guests and Providers. This ensures all transactions are processed through the Platform, which provides payment protection, booking guarantees, and dispute resolution for both parties. Off-platform bookings are not covered by Kainook's policies.",
      },
    ],
  },

  // ── 3.2 Technical & App Support ───────────────────────────────────────────
  {
    id: "technical",
    title: "Technical & App Support",
    category: "general",
    icon: "phone-portrait-outline",
    items: [
      {
        q: "The app is not working. What should I do?",
        a: "First, try closing and reopening the app. Ensure you have the latest version installed (check your App Store or Google Play Store for updates). If the problem persists, try uninstalling and reinstalling the app. If the issue continues, contact us at info@kainook.com with a description of the problem and your device type.",
      },
      {
        q: "I am not receiving email notifications. What should I do?",
        a: "Check your spam or junk mail folder and add noreply@kainook.com to your safe senders list. Also ensure notification permissions are enabled in your device settings for the Kainook app. Verify your email address is correct in Account Settings.",
      },
      {
        q: "How do I report a bug or technical issue?",
        a: "Email info@kainook.com with a description of the issue, the steps to reproduce it, your device type, and a screenshot if available. We take all bug reports seriously and aim to resolve critical issues within 48 hours.",
      },
      {
        q: "Is Kainook available as a web app as well as mobile?",
        a: "Yes. Kainook is accessible via the mobile app (iOS and Android) and as a Progressive Web App (PWA) at www.kainook.com, which can be added to your home screen for an app-like experience on any device.",
      },
    ],
  },

  // ── 3.3 Privacy & Data ────────────────────────────────────────────────────
  {
    id: "privacy-data",
    title: "Privacy & Data",
    category: "general",
    icon: "lock-closed-outline",
    items: [
      {
        q: "How does Kainook use my personal data?",
        a: "We use your data to operate the Platform, process bookings, manage payments, personalise your experience, and comply with legal obligations. We never sell your data. See our full Privacy Policy in Settings → Legal.",
      },
      {
        q: "How do I request a copy of my data?",
        a: "Email info@kainook.com with the subject line \"Data Access Request\". We will provide a copy of all personal data held about you within 30 days, free of charge.",
      },
      {
        q: "How do I opt out of marketing emails?",
        a: "Click \"Unsubscribe\" at the bottom of any marketing email, or go to Account Settings → Notifications → Marketing Preferences and toggle off marketing communications. Transactional emails (booking confirmations, receipts) cannot be disabled as they are necessary for the service.",
      },
      {
        q: "Does Kainook use cookies?",
        a: "Yes. We use strictly necessary cookies (required for the Platform to function), as well as optional functional, analytics, and marketing cookies with your consent. See our Privacy Policy for full details.",
      },
    ],
  },

  // ── 3.4 Legal & Terms ────────────────────────────────────────────────────
  {
    id: "legal-terms",
    title: "Legal & Terms",
    category: "general",
    icon: "document-text-outline",
    items: [
      {
        q: "Where can I find the Terms of Use and Privacy Policy?",
        a: "Both documents are available in Settings → Legal in the app. They are also accessible at www.kainook.com/terms and www.kainook.com/privacy.",
      },
      {
        q: "Which law governs Kainook?",
        a: "Kainook Travel OÜ is governed by Estonian law and operates in compliance with the EU General Data Protection Regulation (GDPR). Disputes are subject to the jurisdiction of the courts of Tallinn, Estonia, unless mandatory local consumer protection law provides otherwise.",
      },
      {
        q: "How do I make a formal complaint?",
        a: "Submit your complaint in writing to info@kainook.com with your booking reference, a description of the issue, and supporting evidence (photos, screenshots). We acknowledge all complaints within 48 hours and aim to resolve them within 14 days.",
      },
    ],
  },
];

export const CONTACT_CHANNELS = [
  { label: "General Support",    value: "info@kainook.com" },
  { label: "Booking Issues",     value: "info@kainook.com" },
  { label: "Provider Support",   value: "info@kainook.com" },
  { label: "Privacy & Data",     value: "info@kainook.com (subject: Privacy Request)" },
  { label: "Fraud & Security",   value: "info@kainook.com (subject: Fraud Report)" },
];

export const RESPONSE_TIMES = [
  "General enquiries: within 2 business days",
  "Booking disputes and urgent issues: within 24 hours",
  "Fraud and security reports: same day",
  "Data access and privacy requests: within 30 days",
  "Formal complaints: acknowledged within 48 hours, resolved within 14 days",
];
