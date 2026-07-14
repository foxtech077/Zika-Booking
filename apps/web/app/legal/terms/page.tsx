"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Compass, ShieldAlert, HeartHandshake, FileText, CheckCircle } from "lucide-react";

export default function TermsOfUsePage() {
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
              <Compass className="w-4 h-4 text-brand" />
              Introduction
            </a>
            <a href="#section-a" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <BookOpen className="w-4 h-4 text-brand" />
              Section A - General
            </a>
            <a href="#section-b" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <HeartHandshake className="w-4 h-4 text-brand" />
              Section B - Accommodation
            </a>
            <a href="#section-c" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <FileText className="w-4 h-4 text-brand" />
              Section C - Car Rental
            </a>
            <a href="#section-d" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <ShieldAlert className="w-4 h-4 text-brand" />
              Section D - Tours & Activities
            </a>
            <a href="#final" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 hover:text-brand-darkest font-medium transition-colors text-slate-600">
              <CheckCircle className="w-4 h-4 text-brand" />
              Final Provisions
            </a>
          </aside>

          {/* Doc Content */}
          <article className="lg:col-span-3 bg-white rounded-3xl border border-slate-100 p-6 md:p-10 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-8">
            
            {/* Cover Info */}
            <div className="border-b border-slate-100 pb-6 text-center lg:text-left">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand">Kainook Travel</span>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mt-2">TERMS OF USE</h1>
              <p className="text-slate-500 text-sm mt-1">Platform Rules · Provider & Guest Responsibilities · Booking Conditions</p>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 mt-4 text-xs text-slate-400">
                <span>Kainook Travel OÜ</span>
                <span>•</span>
                <span>Tallinn, Estonia</span>
                <span>•</span>
                <span>Last Updated: June 2026</span>
              </div>
            </div>

            {/* Introduction */}
            <section id="intro" className="scroll-mt-20 space-y-4">
              <h2 className="text-xl font-serif font-bold text-slate-900 border-l-4 border-brand pl-3">Introduction</h2>
              <p className="text-slate-600 leading-relaxed text-sm">
                Welcome to Kainook Travel — a marketplace platform connecting travellers (&quot;Guests&quot;) with accommodation providers, vehicle rental companies, and activity operators (&quot;Providers&quot;) across Africa and beyond.
              </p>
              <p className="text-slate-600 leading-relaxed text-sm">
                These Terms of Use (&quot;Terms&quot;) govern your access to and use of the Kainook platform, including our website and mobile application (collectively, the &quot;Platform&quot;). By accessing or using the Platform, you agree to be bound by these Terms. Please read them carefully before making any booking.
              </p>

              {/* How Kainook works box */}
              <div className="bg-brand/5 border border-brand/10 rounded-2xl p-5 space-y-3">
                <h4 className="font-bold text-brand-darkest text-sm">How Kainook Works</h4>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1.5">
                  <li>Kainook is a technology marketplace — we connect Guests with independent Providers.</li>
                  <li>Kainook is NOT a travel agent, tour operator, hotel, or car rental company.</li>
                  <li>All travel services are provided directly by Providers, who are solely responsible for their quality and delivery.</li>
                  <li>The contract for any travel service is formed directly between the Guest and the Provider.</li>
                  <li>Kainook&apos;s role is limited to facilitating the booking process and providing the Platform.</li>
                </ul>
              </div>

              <p className="text-slate-600 leading-relaxed text-sm mt-2">
                These Terms are structured as follows:
              </p>
              <ul className="list-disc pl-5 text-slate-600 text-sm space-y-1">
                <li><strong>Section A – General Conditions:</strong> applicable to all travel services on the Platform.</li>
                <li><strong>Section B – Accommodation:</strong> specific conditions for hotel and apartment bookings.</li>
                <li><strong>Section C – Car Rental:</strong> specific conditions for vehicle hire bookings.</li>
                <li><strong>Section D – Activities & Tours:</strong> specific conditions for guided tours and experiences.</li>
              </ul>
              <p className="text-slate-500 italic text-xs">
                Where specific section conditions conflict with general conditions, the specific conditions prevail.
              </p>
            </section>

            <hr className="border-slate-100" />

            {/* Section A */}
            <section id="section-a" className="scroll-mt-20 space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Section A</span>
                <h2 className="text-2xl font-serif font-bold text-slate-900">General Conditions</h2>
              </div>

              {/* A1 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A1. Definitions</h3>
                <p className="text-slate-600 text-sm">The following terms apply throughout these Terms:</p>
                <ul className="space-y-2 text-slate-600 text-sm pl-4 list-disc">
                  <li><strong>&quot;Kainook&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;</strong> — Kainook Travel OÜ, a private limited company registered in Tallinn, Estonia, operating the Platform.</li>
                  <li><strong>&quot;Platform&quot;</strong> — the website and mobile application owned and operated by Kainook Travel OÜ, through which Travel Services are made available.</li>
                  <li><strong>&quot;Travel Service&quot;</strong> — any accommodation, vehicle rental, activity, tour, or other travel product that a Guest may search, compare, and book via the Platform from a Provider.</li>
                  <li><strong>&quot;Provider&quot;</strong> — any independent professional supplier of accommodation (hotel, apartment), transport (car rental), activities (guided tours), or other travel services listed on the Platform. Providers are independent third parties; they are not employees, agents, or representatives of Kainook.</li>
                  <li><strong>&quot;Guest&quot; or &quot;you&quot;</strong> — any individual accessing the Platform to search for or make a Booking.</li>
                  <li><strong>&quot;Booking&quot;</strong> — any confirmed reservation of a Travel Service made through the Platform.</li>
                  <li><strong>&quot;Account&quot;</strong> — a registered user account on the Platform required to access certain features and make Bookings.</li>
                  <li><strong>&quot;AfriPoints&quot;</strong> — Kainook&apos;s loyalty reward points programme with tiers: Bronze, Silver, Gold, and Diamond.</li>
                </ul>
              </div>

              {/* A2 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A2. Acceptance of Terms</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  By creating an Account or making a Booking, you confirm that you have read, understood, and accepted these Terms in full, along with any Provider-specific conditions communicated during the booking process (including cancellation policies).
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  You must be at least 18 years of age to register on the Platform and make a Booking.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions continue in full force and effect.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  The English version of these Terms is the authoritative version. In the event of any conflict with a translation, the English version prevails unless local mandatory law requires otherwise.
                </p>
              </div>

              {/* A3 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A3. Kainook&apos;s Role as a Platform Intermediary</h3>
                
                {/* Warning alert box */}
                <div className="bg-brand/5 border-l-4 border-brand rounded-r-2xl p-5 space-y-2">
                  <h4 className="font-bold text-brand-darkest text-sm">Important — Kainook is a Marketplace, Not a Travel Service Provider</h4>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Kainook operates solely as a technology intermediary. We provide the Platform infrastructure through which Providers list their services and Guests discover, compare, and book them.
                  </p>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Kainook is NOT a party to the contract between the Guest and the Provider. Kainook does NOT own, manage, control, or operate any hotel, apartment, vehicle, or tour. Kainook does NOT employ or supervise any Provider&apos;s staff.
                  </p>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    The listing of a Provider on the Platform does not constitute an endorsement, recommendation, or warranty of their services by Kainook.
                  </p>
                </div>

                <p className="text-slate-600 text-sm mt-3">Kainook&apos;s specific platform functions include:</p>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1">
                  <li>Publishing Provider listings and making them searchable and bookable.</li>
                  <li>Processing payment transactions on behalf of Providers (where applicable).</li>
                  <li>Transmitting booking confirmations and vouchers.</li>
                  <li>Providing in-app messaging between Guests and Providers.</li>
                  <li>Facilitating dispute escalation between Guests and Providers.</li>
                  <li>Administering the AfriPoints loyalty programme.</li>
                </ul>
                <p className="text-slate-600 text-sm italic">
                  Kainook is not responsible for the quality, safety, accuracy, legality, or fitness of any Travel Service. These responsibilities lie exclusively with the Provider.
                </p>
              </div>

              {/* A4 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A4. Provider Responsibilities</h3>
                <p className="text-slate-600 text-sm">Each Provider listed on the Platform is solely responsible for:</p>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1.5">
                  <li>The accuracy, completeness, and timeliness of their listing information (descriptions, photos, pricing, availability, amenities, policies).</li>
                  <li>The lawful operation of their business, including all required licences, permits, registrations, insurance, and compliance with applicable local laws and regulations.</li>
                  <li>The quality, safety, and delivery of their Travel Services in conformity with their listing description.</li>
                  <li>Their own cancellation, refund, and modification policies, which must be clearly stated on their listing.</li>
                  <li>Responding to Guest enquiries and managing bookings in a timely and professional manner.</li>
                  <li>Promptly notifying Kainook and affected Guests of any changes to availability, pricing, or service conditions.</li>
                  <li>Any damage, injury, or loss suffered by Guests as a result of the Provider&apos;s service or property.</li>
                  <li>All taxes, duties, levies, and fiscal obligations arising from their business activities.</li>
                </ul>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <h5 className="font-bold text-slate-800 text-xs mb-1">Provider Agreement</h5>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    All Providers are required to accept Kainook&apos;s Provider Terms & Conditions before listing on the Platform. By listing, Providers represent and warrant compliance with all applicable laws and that their listing information is accurate and up to date.
                  </p>
                </div>
              </div>

              {/* A5 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A5. Guest Responsibilities</h3>
                <p className="text-slate-600 text-sm">By using the Platform, Guests agree to:</p>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1.5">
                  <li>Provide accurate, complete, and truthful information when registering an Account and making a Booking.</li>
                  <li>Comply with all applicable laws and regulations when using the Platform and consuming Travel Services.</li>
                  <li>Respect all rules, policies, and instructions communicated by the Provider before and during the Travel Service.</li>
                  <li>Treat Provider staff, property, and facilities with respect and refrain from causing damage, nuisance, or disturbance.</li>
                  <li>Honour confirmed Bookings or cancel them within the applicable cancellation window.</li>
                  <li>Not make speculative, false, or fraudulent Bookings.</li>
                  <li>Not attempt to circumvent Platform security, access unauthorised data, or misuse the Platform.</li>
                  <li>Not contact Providers to arrange direct payments or off-platform transactions that circumvent Kainook&apos;s booking system.</li>
                  <li>Keep Account login credentials confidential and accept full responsibility for all activity carried out through their Account.</li>
                </ul>
              </div>

              {/* A6 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A6. Pricing</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Prices displayed on the Platform are set by Providers and are subject to change at any time before a Booking is confirmed. The price shown at the time of Booking confirmation is the price payable.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  All displayed prices include applicable taxes and fees unless clearly stated otherwise. Local tourist taxes or city levies may be collected directly by the Provider on arrival.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Obvious errors and misprints (for example, an anomalously low price resulting from a technical fault) are not binding on Kainook or the Provider. In such cases, Kainook reserves the right to cancel the Booking and issue a full refund of any amount charged.
                </p>
              </div>

              {/* A7 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A7. Payments</h3>
                <p className="text-slate-600 text-sm">Kainook supports two payment rails:</p>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1 mb-2">
                  <li><strong>Stripe</strong> — for international card payments (Visa, Mastercard, etc.).</li>
                  <li><strong>Tara</strong> — for African mobile money payments.</li>
                </ul>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Depending on the Travel Service selected, payment may be required in full at the time of Booking, or partially in advance with the remainder due on arrival. Payment terms are clearly indicated during the booking process.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Where Kainook processes your payment, your transaction is handled securely. Your completed payment constitutes settlement of the amount due to the Provider.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Where the Provider collects payment directly (e.g., on arrival), payment terms are governed by the Provider&apos;s own conditions as displayed during booking.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Pre-authorisations or pre-payments may be processed immediately upon Booking confirmation. Depending on Provider policy, such amounts may be non-refundable. Please review cancellation policies carefully before confirming.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm bg-brand/5 p-4 rounded-xl border border-brand/10 text-xs">
                  Where payment is collected by Kainook on behalf of the Provider, the Guest&apos;s payment will be captured and transferred to the Provider within twenty-four (24) hours following the Guest&apos;s check-in. This ensures that funds are only settled once the Guest has taken possession of the service, providing an additional layer of security for both parties.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  If you suspect fraudulent or unauthorised use of your payment method, contact your bank or payment provider immediately.
                </p>
              </div>

              {/* A8 */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-base">A8. Cancellations, Modifications & Refunds</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Cancellation and modification policies are set exclusively by each Provider and displayed on their listing during the booking process. Kainook does not determine these policies.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  All cancellation or modification requests must be submitted via the Platform.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                    <span className="text-[10px] font-bold text-brand uppercase tracking-wider">Guest-Initiated Cancellation</span>
                    <ul className="text-slate-600 text-xs list-disc pl-4 space-y-1">
                      <li>If you cancel within the Provider&apos;s free cancellation window: you will receive a full refund.</li>
                      <li>If you cancel outside the free cancellation window: the Provider&apos;s cancellation fee applies, which may equal the full booking amount.</li>
                      <li>In the event of a no-show without prior cancellation: the Provider may charge up to the full booking value.</li>
                    </ul>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                    <span className="text-[10px] font-bold text-brand uppercase tracking-wider">Refund Processing</span>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Where a refund is due, Kainook will process it within five (5) business days of cancellation confirmation. Credit to your account may vary depending on your bank or payment provider; Kainook has no control over this timeline.
                    </p>
                  </div>
                </div>

                <p className="text-slate-600 leading-relaxed text-sm">
                  <strong>Full Refund for Substantiated Provider Failure:</strong> If a Guest submits a substantiated complaint to Kainook regarding Provider fraud, significant misrepresentation, or a material failure to deliver the booked service, Kainook will investigate and, if the complaint is confirmed, issue a full refund of amounts paid via the Platform. Kainook reserves the right to suspend or remove the relevant Provider pending investigation.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  If payment cannot be processed on the agreed date (e.g., expired card, insufficient funds), the Provider may cancel the Booking. Guests are responsible for ensuring their payment method remains valid.
                </p>
              </div>

              {/* A9 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A9. Reviews & Ratings</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Kainook operates a review and rating system to maintain quality standards on the Platform. Guests are encouraged to leave honest, factual reviews following a completed Travel Service.
                </p>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1.5">
                  <li>Reviews must be based on a genuine, completed booking experience.</li>
                  <li>Reviews must not contain defamatory, offensive, or fraudulent content.</li>
                  <li>Kainook reserves the right to remove reviews that violate these standards.</li>
                </ul>
                <p className="text-slate-600 leading-relaxed text-sm">
                  <strong>Provider Listing Status:</strong> Provider listings may be automatically suspended following two consecutive reviews rated 1–2 stars. Providers will be notified and may appeal through the Provider dashboard. This mechanism exists to protect Guests and maintain platform quality.
                </p>
              </div>

              {/* A10 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A10. In-App Messaging & Communication</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Kainook provides an in-app messaging system to facilitate communication between Guests and Providers. To protect the integrity of the marketplace:
                </p>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1.5">
                  <li>All communications must remain within the Platform&apos;s messaging system.</li>
                  <li>The Platform automatically filters messages containing personal contact details (phone numbers, email addresses, social media handles) to prevent off-platform transactions.</li>
                  <li>Attempts to solicit or share contact details to arrange direct bookings outside the Platform constitute a violation of these Terms.</li>
                </ul>
              </div>

              {/* A11 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A11. Personal Data & Privacy</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Kainook processes your personal data in accordance with applicable data protection law, including the General Data Protection Regulation (GDPR) where applicable. Data collected through your use of the Platform is used only for purposes described in our Privacy Policy, available on the Platform.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  You have the right to access, rectify, delete, restrict processing of, and object to the processing of your personal data. Please contact us via the details in the legal notices section of the Platform to exercise these rights.
                </p>
              </div>

              {/* A12 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A12. Intellectual Property</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Unless otherwise indicated, all intellectual property rights in the content, information, and materials available on the Platform (including copyright, trademarks, logos, and databases) are the exclusive property of Kainook Travel OÜ, its affiliates, or the relevant Providers.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Any reproduction, extraction, publication, commercialisation, or use of Platform content for purposes other than strictly personal use is strictly prohibited without prior written authorisation from Kainook.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  By uploading or publishing visual content (photographs, images, videos) to the Platform, you grant Kainook a worldwide, royalty-free, non-exclusive, transferable licence to reproduce, adapt, distribute, publish, and use such content in connection with the operation and promotion of the Platform. You warrant that you hold all necessary rights over uploaded content and that its publication does not infringe any third-party rights.
                </p>
              </div>

              {/* A13 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A13. Limitation of Liability</h3>
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-xs text-slate-600 leading-relaxed">
                  <strong>Kainook&apos;s Liability is Limited to its Role as a Platform:</strong> Kainook is a technology intermediary. The following limitations reflect that role.
                </div>
                <p className="text-slate-600 text-sm">To the fullest extent permitted by applicable law, Kainook excludes liability for:</p>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1.5">
                  <li>The quality, safety, accuracy, or fitness for purpose of any Travel Service provided by a Provider.</li>
                  <li>Any personal injury, property damage, or other loss suffered in connection with a Travel Service.</li>
                  <li>Inaccuracies in Provider listing information (pricing, availability, descriptions, photos).</li>
                  <li>Any failure, cancellation, or modification of a Travel Service by a Provider.</li>
                  <li>Indirect, consequential, punitive, or special damages, or loss of revenue or reputation.</li>
                  <li>Inability to access or use the Platform due to technical issues, maintenance, or circumstances beyond Kainook&apos;s control.</li>
                </ul>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Where Kainook is found directly liable to a Guest, liability is limited to the total amount paid by the Guest for the Booking in question.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  This limitation does not apply in cases of Kainook&apos;s gross negligence or wilful misconduct, or where applicable law prohibits such limitation.
                </p>
              </div>

              {/* A14 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A14. Complaints & Dispute Resolution</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  For any query or complaint, please contact Kainook&apos;s support team through your Booking on the Platform, via the mobile app, or through our help centre.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  We are committed to responding within a reasonable timeframe. Complaints must be submitted as promptly as possible following the event giving rise to the complaint.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Kainook will first seek to resolve any dispute amicably. If no resolution is reached within thirty (30) days, you may pursue the matter through applicable consumer dispute resolution mechanisms or competent courts.
                </p>
              </div>

              {/* A15 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">A15. Governing Law & Jurisdiction</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  These Terms are governed by and construed in accordance with the laws of Estonia. Any disputes arising out of or in connection with these Terms or the Platform shall be subject to the exclusive jurisdiction of the courts of Tallinn, Estonia, unless mandatory local consumer protection law provides otherwise.
                </p>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section B */}
            <section id="section-b" className="scroll-mt-20 space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Section B</span>
                <h2 className="text-2xl font-serif font-bold text-slate-900">Accommodation (Hotels & Apartments)</h2>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">B1. Scope</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  This section applies exclusively to Bookings of accommodation services (hotels and apartments) made through the Platform.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">B2. The Booking Relationship</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  When you make an accommodation booking, you enter into a direct contract with the Provider (the hotel or apartment owner/operator). Kainook is not a party to that contract.
                </p>

                <h4 className="font-bold text-slate-900 text-sm mt-4">Who is responsible for what — Accommodation</h4>
                
                {/* Table responsibilities */}
                <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm mt-2">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand text-white">
                        <th className="p-3 font-semibold w-1/2 border-r border-brand/20">PROVIDER RESPONSIBILITIES</th>
                        <th className="p-3 font-semibold w-1/2">GUEST RESPONSIBILITIES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Provide accurate property descriptions, photos, and up-to-date availability.</td>
                        <td className="p-3">Provide accurate personal details and requirements at time of booking.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Set and honour their own cancellation and refund policies.</td>
                        <td className="p-3">Review and accept the Provider&apos;s cancellation policy before confirming.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Deliver the accommodation in the condition described.</td>
                        <td className="p-3">Arrive within communicated check-in times or notify the Provider of delays.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Maintain the property in a safe, clean, and habitable condition.</td>
                        <td className="p-3">Respect property rules, quiet hours, occupancy limits, and house rules.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Provide accurate pricing including all mandatory charges.</td>
                        <td className="p-3">Pay for any extras, damages, or charges incurred during the stay.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Notify Kainook and Guests of any changes to their listing or service.</td>
                        <td className="p-3">Leave the property in a satisfactory condition at check-out.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Hold all required business licences, safety certifications, and insurance.</td>
                        <td className="p-3">Not cause damage, nuisance, or disturbance to staff or neighbours.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* B3 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">B3. Kainook&apos;s Role in Accommodation Bookings</h3>
                <p className="text-slate-600 text-sm">Kainook&apos;s role is limited to:</p>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1.5">
                  <li>Providing the Platform on which Providers list and manage their properties.</li>
                  <li>Transmitting booking confirmation details to both Guest and Provider.</li>
                  <li>Processing payment where the Guest pays via the Platform.</li>
                  <li>Facilitating communication between Guest and Provider through in-app messaging.</li>
                </ul>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Kainook does not inspect, certify, or guarantee accommodation quality. Star ratings assigned to hotels are based on information provided by Providers and verified by Kainook&apos;s administration team; they are indicative only.
                </p>
              </div>

              {/* B4 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">B4. Check-In, Check-Out & House Rules</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Check-in and check-out times are set by the Provider and displayed on the property listing. Guests must respect these times.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  If you anticipate a late arrival, you must notify the Provider directly through the in-app messaging system. Providers reserve the right to cancel a booking if a Guest fails to check in without notification (no-show policy).
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Guests are bound by the house rules of each property as communicated at booking and on arrival.
                </p>
              </div>

              {/* B5 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">B5. Deposits & Security Bonds</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Providers may require a security deposit upon check-in. The amount and conditions for return are specified on the property listing. Kainook has no control over security deposit amounts or dispute resolution between the Provider and Guest regarding deposits.
                </p>
              </div>

              {/* B6 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">B6. Cancellations & No-Show — Accommodation</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Each Provider sets their own cancellation policy. The applicable policy is displayed on the property listing and during the booking process.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  In the event of a no-show without prior cancellation, the Provider may charge fees up to the full booking value in accordance with their policy.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Modification requests (change of dates, number of guests) must be submitted via the Platform and are subject to Provider approval and applicable charges.
                </p>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section C */}
            <section id="section-c" className="scroll-mt-20 space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Section C</span>
                <h2 className="text-2xl font-serif font-bold text-slate-900">Car Rental</h2>
              </div>

              {/* C1 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">C1. Scope</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  This section applies exclusively to Bookings of vehicle rental services made through the Platform.
                </p>
              </div>

              {/* C2 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">C2. The Booking Relationship</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  When you reserve a vehicle, you enter into a direct contract with the rental company (the &quot;Provider&quot;). Kainook acts solely as a booking intermediary. The detailed rental contract will be provided by the Provider at the time of vehicle collection; you are advised to read it carefully before signing.
                </p>
              </div>

              {/* C3 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">C3. Who is Responsible for What — Car Rental</h3>
                
                {/* Table responsibilities */}
                <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm mt-2">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand text-white">
                        <th className="p-3 font-semibold w-1/2 border-r border-brand/20">PROVIDER RESPONSIBILITIES</th>
                        <th className="p-3 font-semibold w-1/2">GUEST RESPONSIBILITIES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Provide accurate vehicle descriptions, photos, and rental conditions.</td>
                        <td className="p-3">Present a valid driving licence (and international permit if required) at collection.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Maintain vehicles in roadworthy and safe condition.</td>
                        <td className="p-3">Present valid photo ID and a credit card in the primary driver&apos;s name.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">State all included and excluded costs clearly (insurance, mileage, fuel, options).</td>
                        <td className="p-3">Return the vehicle at the agreed time, location, and fuel level.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Set and honour their own cancellation policies.</td>
                        <td className="p-3">Drive only within permitted geographic zones specified in the rental agreement.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Carry appropriate insurance in compliance with local regulations.</td>
                        <td className="p-3">Not drive under the influence of alcohol or controlled substances.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Notify Guests of any vehicle substitutions or service changes.</td>
                        <td className="p-3">Not sub-let the vehicle or permit unauthorised drivers.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Handle security deposit collection and return per published conditions.</td>
                        <td className="p-3">Report any accident, damage, or theft to the Provider and local authorities immediately.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* C4 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">C4. Guest Obligations — Car Rental</h3>
                <p className="text-slate-600 text-sm">Guests bear full responsibility for the vehicle during the rental period. This includes:</p>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1.5">
                  <li>All damage, loss, or theft not covered by the Provider&apos;s insurance.</li>
                  <li>Traffic fines, toll charges, and parking penalties incurred during the rental.</li>
                  <li>Fuel costs where not included in the rental price.</li>
                  <li>Additional charges for late return or returning to a different location than agreed.</li>
                </ul>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Kainook is not responsible for any costs, damages, or disputes arising between the Guest and the Provider following vehicle collection.
                </p>
              </div>

              {/* C5 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">C5. Security Deposit — Car Rental</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  A security deposit is typically held on the Guest&apos;s credit card at the time of vehicle collection. The amount and conditions for release are set by the Provider and specified on the listing. Kainook has no role in managing this deposit.
                </p>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section D */}
            <section id="section-d" className="scroll-mt-20 space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Section D</span>
                <h2 className="text-2xl font-serif font-bold text-slate-900">Activities & Tours</h2>
              </div>

              {/* D1 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">D1. Scope</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  This section applies exclusively to Bookings of activities, guided tours, excursions, and similar experiences made through the Platform.
                </p>
              </div>

              {/* D2 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">D2. The Booking Relationship</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  When you book an activity or tour, you enter into a direct contract with the Provider who organises and delivers the experience. Kainook acts solely as an intermediary and has no involvement in the organisation or execution of the activity.
                </p>
              </div>

              {/* D3 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">D3. Who is Responsible for What — Activities & Tours</h3>
                
                {/* Table responsibilities */}
                <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm mt-2">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand text-white">
                        <th className="p-3 font-semibold w-1/2 border-r border-brand/20">PROVIDER RESPONSIBILITIES</th>
                        <th className="p-3 font-semibold w-1/2">GUEST RESPONSIBILITIES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Provide accurate activity descriptions, inclusions, and exclusions.</td>
                        <td className="p-3">Arrive at the designated meeting point at the time stated in the booking confirmation.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Communicate all physical requirements, age restrictions, and health advisories upfront.</td>
                        <td className="p-3">Assess personal fitness and health suitability before booking.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Ensure all safety equipment is available and meets applicable standards.</td>
                        <td className="p-3">Disclose any health conditions that may affect participation to the Provider before the activity.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Obtain all necessary permits, licences, and insurance for the activity.</td>
                        <td className="p-3">Follow all safety instructions from the Provider and their guides at all times.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Provide qualified guides and appropriate supervision throughout.</td>
                        <td className="p-3">Sign any required liability waivers before participation.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Communicate changes (weather cancellations, route changes) to Guests promptly.</td>
                        <td className="p-3">Not participate if under the influence of alcohol or substances that impair safety.</td>
                      </tr>
                      <tr className="divide-x divide-slate-100 hover:bg-slate-50">
                        <td className="p-3">Set and honour their cancellation and refund policies.</td>
                        <td className="p-3">Cover any additional costs (meals, transport, tips, equipment rental) not listed as included.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* D4 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">D4. Safety & Participation</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Some activities involve inherent risks or physical demands. Guests are responsible for assessing their own fitness and suitability before booking. Where a Provider requires a liability waiver, signing it is a condition of participation.
                </p>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Kainook strongly encourages Guests to obtain appropriate travel insurance covering adventure activities, medical emergencies, and cancellations before making activity bookings.
                </p>
              </div>

              {/* D5 */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-base">D5. Cancellations — Activities & Tours</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Cancellation policies vary by activity and Provider. The applicable policy is displayed clearly before booking confirmation. Late arrivals or no-shows may forfeit the booking amount without refund, at the Provider&apos;s discretion.
                </p>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Final Provisions */}
            <section id="final" className="scroll-mt-20 space-y-4">
              <h2 className="text-xl font-serif font-bold text-slate-900 border-l-4 border-brand pl-3">Final Provisions</h2>
              
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">Modifications to These Terms</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Kainook reserves the right to amend these Terms at any time. Material changes will be notified to registered users via email or in-app notification. Continued use of the Platform following notification constitutes acceptance of the revised Terms.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">Force Majeure</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Neither Kainook nor any Provider shall be liable for failure or delay in performance resulting from events beyond their reasonable control, including natural disasters, strikes, government restrictions, epidemics, or other force majeure events.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">Entire Agreement</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  These Terms, together with Kainook&apos;s Privacy Policy and any applicable Provider-specific conditions, constitute the entire agreement between you and Kainook regarding your use of the Platform, and supersede all prior agreements.
                </p>
              </div>

              <div className="pt-6 border-t border-slate-100 text-center text-xs text-slate-400 space-y-1.5">
                <p className="font-semibold text-slate-600">— End of Kainook Travel Terms of Use —</p>
                <p>Last Updated: June 2026</p>
                <p>Kainook Travel OÜ · Tallinn, Estonia · www.kainook.com</p>
              </div>
            </section>

          </article>
        </div>
      </main>
    </div>
  );
}
