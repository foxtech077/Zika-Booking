"use client";

import Link from "next/link";
import Image from "next/image";
import { Info, HelpCircle, Eye, ShieldCheck, Database, FileText, CheckCircle2 } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-brand/10 selection:text-brand-darkest">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/kainook-logo.jpeg"
              alt="Kainook Logo"
              width={40}
              height={40}
              className="rounded-xl shadow-sm"
            />
            <span className="font-serif font-bold text-xl text-brand-darkest tracking-tight">KAINOOK</span>
          </div>
          {/* Back button commented out since page opens in a new tab */}
          {/* <Link
            href="/auth/register"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-darkest transition-colors py-2 px-3 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Sign Up
          </Link> */}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar Nav */}
          <aside className="lg:col-span-1 space-y-2 lg:sticky lg:top-24 h-fit">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-3">Sections</h3>
            <a href="#intro" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <Info className="w-4 h-4 text-brand" />
              1. Introduction
            </a>
            <a href="#controller" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <HelpCircle className="w-4 h-4 text-brand" />
              2. Data Controller
            </a>
            <a href="#collect" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <Eye className="w-4 h-4 text-brand" />
              3. What We Collect
            </a>
            <a href="#legal-basis" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <ShieldCheck className="w-4 h-4 text-brand" />
              4. Legal Basis
            </a>
            <a href="#usage" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <Database className="w-4 h-4 text-brand" />
              5. How We Use Data
            </a>
            <a href="#sharing" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <FileText className="w-4 h-4 text-brand" />
              6-7. Data Sharing & Transfers
            </a>
            <a href="#retention" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-brand" />
              8-10. Rights, Retention & Cookies
            </a>
            <a href="#other" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <ShieldCheck className="w-4 h-4 text-brand" />
              11-18. Security & Deletion
            </a>
          </aside>

          {/* Doc Content */}
          <article className="lg:col-span-3 bg-white rounded-3xl border border-slate-100 p-6 md:p-10 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-8">
            
            {/* Cover Info */}
            <div className="border-b border-slate-100 pb-6 text-center lg:text-left">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand">Kainook Travel</span>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mt-2">PRIVACY POLICY</h1>
              <p className="text-slate-500 text-sm mt-1">How We Collect, Use, Share & Protect Your Personal Data</p>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 mt-4 text-xs text-slate-400">
                <span>Kainook Travel OÜ</span>
                <span>•</span>
                <span>Tallinn, Estonia</span>
                <span>•</span>
                <span>Effective Date: June 2026</span>
              </div>
            </div>

            {/* Section 1 */}
            <section id="intro" className="scroll-mt-20 space-y-4">
              <h2 className="text-xl font-serif font-bold text-slate-900 border-l-4 border-brand pl-3">1. Introduction & Who We Are</h2>
              <p className="text-slate-600 leading-relaxed text-sm">
                Your privacy matters to us. This Privacy Policy explains how Kainook Travel OÜ (&quot;Kainook&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;), a private limited company registered in Tallinn, Estonia, collects, uses, shares, stores, and protects your personal data when you use our platform — including our website and mobile application (collectively, the &quot;Platform&quot;).
              </p>
              <p className="text-slate-600 leading-relaxed text-sm">
                Kainook operates as a marketplace connecting travellers (&quot;Guests&quot;) with accommodation providers, vehicle rental companies, and activity operators (&quot;Providers&quot;) primarily across Africa and internationally. In doing so, we process personal data as a data controller under applicable data protection law, including the European Union General Data Protection Regulation (GDPR) and the Estonian Personal Data Protection Act.
              </p>

              {/* Our Commitment box */}
              <div className="bg-brand/5 border border-brand/10 rounded-2xl p-5 space-y-3">
                <h4 className="font-bold text-brand-darkest text-sm">Our Commitment to You</h4>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1.5">
                  <li>We collect only the data we genuinely need to operate the Platform.</li>
                  <li>We never sell your personal data to third parties.</li>
                  <li>We are transparent about how your data is used and with whom it is shared.</li>
                  <li>We give you meaningful control over your data, including the right to access, correct, and delete it.</li>
                  <li>We apply strong technical and organisational security measures to protect your data.</li>
                </ul>
              </div>

              <p className="text-slate-600 leading-relaxed text-sm">
                This Policy applies to all users of the Platform, including Guests, Providers, and visitors. It should be read alongside our Terms of Use. If you do not agree with this Policy, please do not use the Platform.
              </p>
            </section>

            <hr className="border-slate-100" />

            {/* Section 2 */}
            <section id="controller" className="scroll-mt-20 space-y-4">
              <h2 className="text-xl font-serif font-bold text-slate-900 border-l-4 border-brand pl-3">2. Data Controller</h2>
              <p className="text-slate-600 leading-relaxed text-sm">
                The data controller responsible for your personal data is:
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 space-y-1">
                <p><strong>Kainook Travel OÜ</strong></p>
                <p>Registered in Tallinn, Estonia</p>
                <p>Email: <a href="mailto:info@kainook.com" className="text-brand font-semibold hover:underline">info@kainook.com</a></p>
                <p>Website: <a href="https://www.kainook.com" target="_blank" rel="noopener noreferrer" className="text-brand font-semibold hover:underline">www.kainook.com</a></p>
              </div>
              <p className="text-slate-600 leading-relaxed text-sm">
                For any data protection enquiry or to exercise your rights, please contact us at <a href="mailto:info@kainook.com" className="text-brand hover:underline">info@kainook.com</a>. We aim to respond to all requests within 30 days.
              </p>
            </section>

            <hr className="border-slate-100" />

            {/* Section 3 */}
            <section id="collect" className="scroll-mt-20 space-y-6">
              <h2 className="text-xl font-serif font-bold text-slate-900 border-l-4 border-brand pl-3">3. What Personal Data We Collect</h2>
              <p className="text-slate-600 leading-relaxed text-sm">
                We collect personal data in three ways: data you provide directly, data generated through your use of the Platform, and data received from third parties.
              </p>

              {/* 3.1 Directly */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">3.1 Data You Provide Directly</h3>
                <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand text-white">
                        <th className="p-3 font-semibold w-1/3 border-r border-brand/20">Category</th>
                        <th className="p-3 font-semibold w-2/3">Examples</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">Account Registration</td>
                        <td className="p-3">Full name, email address, phone number, password (hashed), profile photo, preferred language and currency.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">Booking Information</td>
                        <td className="p-3">Travel dates, number of guests, special requests, guest names, nationality.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">Payment Information</td>
                        <td className="p-3">Card details (processed securely via Stripe), mobile money account details (processed via Tara), billing address. Full card numbers are never stored by Kainook.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">Identity Verification</td>
                        <td className="p-3">Government-issued ID (where required for certain Providers or age verification), date of birth.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">Communications</td>
                        <td className="p-3">Messages exchanged via in-app messaging between Guests and Providers, support tickets, feedback, reviews and ratings.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">Provider Onboarding</td>
                        <td className="p-3">Business name, registration number, address, banking details for payouts, listing information (descriptions, photos, pricing, availability).</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">Preferences & Settings</td>
                        <td className="p-3">Notification preferences, saved searches, wishlist/favourites, loyalty programme (AfriPoints) activity.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3.2 Automatically */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">3.2 Data Generated Automatically</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  When you use the Platform, we automatically collect certain technical and behavioural data:
                </p>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1.5">
                  <li>Device and browser information (device type, operating system, browser type, screen resolution).</li>
                  <li>IP address and approximate geolocation (country/city level, not precise GPS unless explicitly granted).</li>
                  <li>Usage data (pages visited, search queries, filters applied, listings viewed, time spent on pages).</li>
                  <li>Booking funnel data (steps completed, drop-off points, booking reference, confirmation status).</li>
                  <li>Session identifiers, cookies and similar tracking technologies (see Section 10 on Cookies).</li>
                  <li>App performance data and crash reports.</li>
                </ul>
              </div>

              {/* 3.2a Others */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">3.2a Data You Give Us About Others</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  When making a booking that includes other travellers — for example, booking accommodation for a family member, colleague, or group — you may provide us with personal data about those individuals. This may include their names, dates of birth, nationality, dietary or accessibility preferences, or identification information required for check-in. You are responsible for ensuring those individuals are aware their data will be shared with Kainook and that they have accepted this Privacy Policy before you provide their information to us.
                </p>
              </div>

              {/* 3.3 Third Parties */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">3.3 Data We Receive from Third Parties</h3>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1.5">
                  <li>Payment processors (Stripe, Tara): transaction status, fraud signals, payment method verification results.</li>
                  <li>Social login providers (Google, Apple, Facebook — if you choose to sign in via these): name, email address, profile picture, unique identifier.</li>
                  <li>Channel managers and OTAs (Airbnb, Booking.com): availability and reservation data synced via iCal integration (Providers only).</li>
                  <li>Identity verification services: verification status and risk flags (where applicable).</li>
                  <li>Analytics and advertising partners: aggregated behavioural data to improve the Platform.</li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section 4 */}
            <section id="legal-basis" className="scroll-mt-20 space-y-4">
              <h2 className="text-xl font-serif font-bold text-slate-900 border-l-4 border-brand pl-3">4. Legal Basis for Processing (GDPR)</h2>
              <p className="text-slate-600 leading-relaxed text-sm">
                For users in the European Economic Area (EEA) and where the GDPR applies, we rely on the following legal bases to process your personal data:
              </p>

              <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-brand text-white">
                      <th className="p-3 font-semibold border-r border-brand/20">Processing Activity</th>
                      <th className="p-3 font-semibold border-r border-brand/20">Legal Basis</th>
                      <th className="p-3 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Account creation and management</td>
                      <td className="p-3">Contract (Art. 6(1)(b))</td>
                      <td className="p-3">Necessary to provide you with a user account.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Processing bookings and payments</td>
                      <td className="p-3">Contract (Art. 6(1)(b))</td>
                      <td className="p-3">Necessary to execute the booking you requested.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Fraud prevention and security</td>
                      <td className="p-3">Legitimate interest (Art. 6(1)(f))</td>
                      <td className="p-3">Protecting users, Providers, and the Platform from fraud and abuse.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Sending booking confirmations and service communications</td>
                      <td className="p-3">Contract (Art. 6(1)(b))</td>
                      <td className="p-3">Necessary for providing the service.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Customer support</td>
                      <td className="p-3">Contract / Legitimate interest</td>
                      <td className="p-3">Resolving your queries and improving service quality.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Marketing emails and push notifications</td>
                      <td className="p-3">Consent (Art. 6(1)(a))</td>
                      <td className="p-3">Only where you have opted in. Withdraw at any time.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Analytics and Platform improvement</td>
                      <td className="p-3">Legitimate interest (Art. 6(1)(f))</td>
                      <td className="p-3">Understanding usage patterns to improve the Platform.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Legal compliance (tax, anti-money laundering)</td>
                      <td className="p-3">Legal obligation (Art. 6(1)(c))</td>
                      <td className="p-3">Compliance with applicable Estonian and EU law.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Reviews and ratings</td>
                      <td className="p-3">Legitimate interest (Art. 6(1)(f))</td>
                      <td className="p-3">Maintaining Platform quality and transparency.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">AfriPoints loyalty programme</td>
                      <td className="p-3">Contract (Art. 6(1)(b))</td>
                      <td className="p-3">Administering rewards for qualifying bookings.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-slate-600 text-xs mt-2 italic">
                Where we rely on legitimate interests, we have assessed that our interests are not overridden by your rights and interests. You may object to processing based on legitimate interests at any time (see Section 9).
              </p>
            </section>

            <hr className="border-slate-100" />

            {/* Section 5 */}
            <section id="usage" className="scroll-mt-20 space-y-6">
              <h2 className="text-xl font-serif font-bold text-slate-900 border-l-4 border-brand pl-3">5. How We Use Your Personal Data</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">5.1 To Provide and Operate the Platform</h4>
                  <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1">
                    <li>Create and manage your user account.</li>
                    <li>Process and confirm bookings between Guests and Providers.</li>
                    <li>Facilitate payment collection and Provider payouts (within 24 hours of Guest check-in).</li>
                    <li>Send booking confirmations, vouchers, receipts, and itinerary updates.</li>
                    <li>Enable in-app messaging between Guests and Providers.</li>
                    <li>Administer the AfriPoints loyalty programme and reward eligible bookings.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">5.2 To Ensure Safety, Security & Trust</h4>
                  <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1">
                    <li>Verify user identity and prevent fraudulent or abusive activity.</li>
                    <li>Monitor messaging for prohibited content (e.g., contact details shared to circumvent the Platform).</li>
                    <li>Detect and investigate suspicious transactions or policy violations.</li>
                    <li>Enforce our Terms of Use and take action against users or Providers who breach them.</li>
                    <li>Maintain review integrity and investigate reported fake or malicious reviews.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">5.3 To Improve and Personalise the Platform</h4>
                  <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1">
                    <li>Analyse usage patterns to improve search, recommendations, and booking flows.</li>
                    <li>Personalise search results, listing recommendations, and promotional content based on your preferences and history.</li>
                    <li>Conduct A/B testing and product research to improve Platform features.</li>
                    <li>Train internal models (non-identifiable, aggregated data only) to improve fraud detection and recommendations.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">5.4 To Communicate with You</h4>
                  <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1">
                    <li>Send transactional communications: booking confirmations, cancellation notices, payment receipts, check-in reminders.</li>
                    <li>Send service-related notifications: policy updates, security alerts, account notices.</li>
                    <li>Send marketing communications (with your consent): personalised travel recommendations, promotional offers, AfriPoints updates. You may unsubscribe at any time.</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3 pt-3">
                <h4 className="font-bold text-slate-900 text-sm">5.5 For Market Research & Service Improvement</h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Invite Guests and Providers to voluntarily participate in surveys, feedback programmes, and market research initiatives. We analyse aggregated and anonymised booking and search data to understand travel demand trends and improve destination coverage across Africa.
                </p>
                <p className="text-slate-600 text-xs italic">
                  Any invitation to participate in market research will clearly describe what personal data is collected and how it will be used. Participation is always voluntary.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">5.6 To Display Relevant Pricing</h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  When displaying search results and pricing, we may use data such as your approximate location (derived from your IP address), device type, currency preference, and prior searches to display pricing in your local currency and the most relevant rates for your market. This reflects currency localisation and market availability — not individualised or discriminatory pricing targeting you personally.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">5.7 To Comply with Legal Obligations</h4>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1">
                  <li>Retain transaction records as required by Estonian tax law and applicable financial regulations.</li>
                  <li>Respond to lawful requests from law enforcement or regulatory authorities.</li>
                  <li>Comply with anti-money laundering (AML) and know-your-customer (KYC) requirements where applicable.</li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Sections 6 & 7 */}
            <section id="sharing" className="scroll-mt-20 space-y-6">
              <h2 className="text-xl font-serif font-bold text-slate-900 border-l-4 border-brand pl-3">6. How We Share Your Personal Data</h2>
              
              <div className="bg-brand/5 border-l-4 border-brand rounded-r-2xl p-4 text-xs text-slate-600 leading-relaxed font-medium">
                <strong>We Do Not Sell Your Data:</strong> Kainook does not sell, rent, or trade your personal data to third parties for their own commercial purposes. Period.
              </div>

              <p className="text-slate-600 text-sm">We share your data only in the following circumstances:</p>

              <div className="space-y-3 pl-4">
                <h4 className="font-bold text-slate-900 text-sm">6.1 With Providers (to Fulfil Your Booking)</h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  When you make a booking, we share the information necessary for the Provider to deliver the service. This includes: Guest name, booking reference, travel dates, number of guests, special requests, contact information (email address, phone number) — shared only after booking confirmation, and payment status confirmation (not full card details).
                </p>
                <p className="text-slate-500 text-xs italic">
                  Providers are required to handle your data solely for the purpose of delivering the booked service and in compliance with applicable data protection law. They may not use your data for their own marketing purposes without your separate consent.
                </p>
              </div>

              <div className="space-y-2 pl-4">
                <h4 className="font-bold text-slate-900 text-sm">6.2 With Payment Processors</h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Stripe (international card payments) processes card transactions securely. Stripe is a certified PCI DSS Level 1 service provider. Tara (African mobile money) processes mobile money transactions. Tara&apos;s own privacy practices apply to data shared with Tara. Kainook does not store full card numbers.
                </p>
              </div>

              <div className="space-y-3 pl-4">
                <h4 className="font-bold text-slate-900 text-sm">6.3 With Service Providers & Technology Partners</h4>
                <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800">
                        <th className="p-2.5 font-semibold w-1/3 border-r border-slate-200">Service Provider Type</th>
                        <th className="p-2.5 font-semibold">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium border-r border-slate-100 text-slate-800">Cloud hosting & infrastructure</td>
                        <td className="p-2.5">Storing Platform data and serving the application (servers located within the EEA where possible).</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium border-r border-slate-100 text-slate-800">Analytics providers</td>
                        <td className="p-2.5">Understanding Platform usage and performance (data anonymised or pseudonymised where possible).</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium border-r border-slate-100 text-slate-800">Email & push notification providers</td>
                        <td className="p-2.5">Delivering transactional and marketing communications.</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium border-r border-slate-100 text-slate-800">Identity verification services</td>
                        <td className="p-2.5">Verifying user identity and preventing fraud.</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium border-r border-slate-100 text-slate-800">Customer support tools</td>
                        <td className="p-2.5">Managing support tickets and Guest communications.</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium border-r border-slate-100 text-slate-800">Mapping & geolocation (Google Geocoding API)</td>
                        <td className="p-2.5">Displaying property and pickup locations accurately.</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium border-r border-slate-100 text-slate-800">Channel manager integrations</td>
                        <td className="p-2.5">Syncing Provider availability with Airbnb and Booking.com via iCal.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-slate-600 text-xs">
                  All third-party processors are bound by data processing agreements requiring them to handle your data securely, lawfully, and only for the purposes specified.
                </p>
              </div>

              <div className="space-y-2 pl-4">
                <h4 className="font-bold text-slate-900 text-sm">6.4 With Other Users (Public Information)</h4>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1">
                  <li>Guest reviews and ratings (attributed to your display name, not your full name or email).</li>
                  <li>Provider listing information, response rates, and review scores.</li>
                </ul>
              </div>

              <div className="space-y-2 pl-4">
                <h4 className="font-bold text-slate-900 text-sm">6.5-6.6 Legal Reasons & Business Transfers</h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  We may disclose data to comply with laws, protect platform safety, or in the event of a merger/acquisition (users will be notified in advance).
                </p>
              </div>

              {/* Section 7 */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h2 className="text-xl font-serif font-bold text-slate-900">7. International Data Transfers</h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Kainook is headquartered in Estonia (EU). Because we operate across Africa and internationally, your personal data may be transferred to and processed in countries outside the European Economic Area (EEA), including countries where data protection laws may differ from those in the EU.
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  When we transfer personal data outside the EEA, we ensure appropriate safeguards are in place, including: Adequacy decisions by the European Commission, Standard Contractual Clauses (SCCs), or Binding Corporate Rules (BCRs) where applicable.
                </p>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Sections 8, 9, 10 */}
            <section id="retention" className="scroll-mt-20 space-y-6">
              <h2 className="text-xl font-serif font-bold text-slate-900 border-l-4 border-brand pl-3">8. How Long We Keep Your Data</h2>
              <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-brand text-white">
                      <th className="p-3 font-semibold border-r border-brand/20 w-1/3">Data Category</th>
                      <th className="p-3 font-semibold">Retention Period</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Account data</td>
                      <td className="p-3">For the duration of your account, plus 3 years after account closure (to resolve post-closure disputes and comply with legal obligations).</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Booking and transaction records</td>
                      <td className="p-3">7 years from the date of the transaction (required under Estonian accounting and tax law).</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Payment data</td>
                      <td className="p-3">As required by payment processor regulations; card data is never stored by Kainook beyond the transaction.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Communications & support tickets</td>
                      <td className="p-3">3 years from the date of the last interaction.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Reviews and ratings</td>
                      <td className="p-3">Retained while the listing is active; may be anonymised or deleted upon request if no longer needed.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Marketing preferences & consent records</td>
                      <td className="p-3">Until you withdraw consent, plus 3 years thereafter for compliance purposes.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Fraud and security logs</td>
                      <td className="p-3">Up to 5 years to detect and prevent recurrent fraud.</td>
                    </tr>
                    <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">Legal hold data</td>
                      <td className="p-3">For the duration of any ongoing legal proceeding or regulatory investigation.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 9 */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h2 className="text-xl font-serif font-bold text-slate-900">9. Your Data Protection Rights</h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Depending on your location and the applicable law, you have the following rights regarding your personal data: Right of Access, Right to Rectification, Right to Erasure, Right to Restriction of Processing, Right to Data Portability, Right to Object, Right to Withdraw Consent, and Right to Lodge a Complaint with the Estonian Data Protection Inspectorate.
                </p>

                <div className="bg-brand/5 border border-brand/10 p-5 rounded-2xl space-y-2 text-xs">
                  <p className="font-bold text-brand-darkest">How to Exercise Your Rights</p>
                  <p className="text-slate-600 leading-relaxed">
                    Submit your request to: <a href="mailto:info@kainook.com" className="text-brand font-semibold hover:underline">info@kainook.com</a> or through the Privacy Settings section of your Account. We respond within 30 days. No fees apply unless requests are manifestly unfounded or excessive.
                  </p>
                </div>
              </div>

              {/* Section 10 */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h2 className="text-xl font-serif font-bold text-slate-900">10. Cookies & Tracking Technologies</h2>
                <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800">
                        <th className="p-2.5 font-semibold w-1/4 border-r border-slate-200">Cookie Type</th>
                        <th className="p-2.5 font-semibold w-1/2 border-r border-slate-200">Purpose</th>
                        <th className="p-2.5 font-semibold">Can You Opt Out?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-semibold border-r border-slate-100 text-slate-800">Strictly Necessary</td>
                        <td className="p-2.5 border-r border-slate-100">Session management, authentication, security, booking flow.</td>
                        <td className="p-2.5">No — required.</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-semibold border-r border-slate-100 text-slate-800">Functional</td>
                        <td className="p-2.5 border-r border-slate-100">Remembering your language, currency, and search preferences.</td>
                        <td className="p-2.5">Yes — via settings.</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-semibold border-r border-slate-100 text-slate-800">Analytics</td>
                        <td className="p-2.5 border-r border-slate-100">Understanding how users navigate the Platform to improve it.</td>
                        <td className="p-2.5">Yes — via settings.</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-semibold border-r border-slate-100 text-slate-800">Performance</td>
                        <td className="p-2.5 border-r border-slate-100">Measuring page load speed and identifying technical issues.</td>
                        <td className="p-2.5">Yes — via settings.</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 font-semibold border-r border-slate-100 text-slate-800">Marketing / Retargeting</td>
                        <td className="p-2.5 border-r border-slate-100">Serving relevant travel-related advertising on third-party platforms.</td>
                        <td className="p-2.5">Yes — withdraw consent.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Sections 11-18 */}
            <section id="other" className="scroll-mt-20 space-y-6">
              <h2 className="text-xl font-serif font-bold text-slate-900 border-l-4 border-brand pl-3">11-18. Security, Account Deletion & Other Policies</h2>
              
              {/* Children, security */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">11-12. Children&apos;s Privacy & Data Security</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  We do not knowingly collect data from children under 18. We apply industry-standard security measures including TLS encryption in transit, encryption at rest, strict staff access controls, and PCI-DSS compliance for payment processors.
                </p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-xs text-slate-600">
                  <strong>In Case of a Data Breach:</strong> If a breach occurs that puts your rights at risk, we will notify you and report to the Estonian Data Protection Inspectorate within 72 hours.
                </div>
              </div>

              {/* Providers */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 text-sm">13. Privacy & Providers</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Providers are independent data controllers for data they collect directly from guests. They are contractually obligated to process Guest data only for the booking, not use it for marketing without consent, and comply with data protection laws.
                </p>
              </div>

              {/* Accessibility & Changes */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 text-sm">14-16. Third-Party Links, Accessibility & Changes</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  This policy doesn&apos;t apply to third-party links. We are committed to digital accessibility and providing alternatives. Changes to this Policy will be notified at least 14 days before taking effect.
                </p>
              </div>

              {/* Account Deletion */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">17. Account Deletion Policy</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  You can delete your account via App Settings or by emailing <a href="mailto:info@kainook.com" className="text-brand hover:underline">info@kainook.com</a>. Requests are processed within 30 days. Deletion is irreversible.
                </p>

                <h4 className="font-bold text-slate-800 text-xs mt-2">Data Retained after Account Deletion:</h4>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1">
                  <li><strong>Transaction & booking records:</strong> 7 years for tax and accounting compliance.</li>
                  <li><strong>Reviews and ratings:</strong> Retained anonymously with display name removed.</li>
                  <li><strong>Fraud logs:</strong> Up to 5 years.</li>
                  <li><strong>Legal hold & Dispute records:</strong> For the duration of any proceeding/investigation, or 3 years.</li>
                </ul>

                <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-xs text-slate-600 leading-relaxed">
                  <strong>Important — Pending Bookings:</strong> You cannot delete your account if you have active/upcoming bookings or active listings (for Providers).
                </div>
              </div>

              {/* Contacts */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">18. Contact & Supervisory Authority</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1.5 text-xs text-slate-600">
                    <span className="font-bold text-slate-800">Contact Us</span>
                    <p>Data Protection: info@kainook.com</p>
                    <p>General Support: support@kainook.com</p>
                    <p>Kainook Travel OÜ — Tallinn, Estonia</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1.5 text-xs text-slate-600">
                    <span className="font-bold text-slate-800">Supervisory Authority</span>
                    <p>Estonian Data Protection Inspectorate</p>
                    <p>Website: www.aki.ee</p>
                    <p>Email: info@aki.ee</p>
                    <p>Address: Tatari 39, 10134 Tallinn, Estonia</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 text-center text-xs text-slate-400 space-y-1.5">
                <p className="font-semibold text-slate-600">— End of Kainook Travel Privacy Policy —</p>
                <p>Effective Date: June 2026</p>
                <p>Kainook Travel OÜ · Tallinn, Estonia · info@kainook.com</p>
              </div>
            </section>

          </article>
        </div>
      </main>
    </div>
  );
}
