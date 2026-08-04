<script lang="ts">
	const serviceProviders: [string, string][] = [
		[
			'Cloud hosting & infrastructure',
			'Storing Platform data and serving the application (servers located within the EEA where possible).'
		],
		[
			'Analytics providers',
			'Understanding Platform usage and performance (data anonymised or pseudonymised where possible).'
		],
		[
			'Email & push notification providers',
			'Delivering transactional and marketing communications.'
		],
		['Identity verification services', 'Verifying user identity and preventing fraud.'],
		['Customer support tools', 'Managing support tickets and Guest communications.'],
		[
			'Mapping & geolocation (Google Geocoding API)',
			'Displaying property and pickup locations accurately.'
		],
		[
			'Channel manager integrations',
			'Syncing Provider availability with Airbnb and Booking.com via iCal.'
		]
	];

	const retentionRows: [string, string][] = [
		[
			'Account data',
			'For the duration of your account, plus 3 years after account closure (to resolve post-closure disputes and comply with legal obligations).'
		],
		[
			'Booking and transaction records',
			'7 years from the date of the transaction (required under Estonian accounting and tax law).'
		],
		[
			'Payment data',
			'As required by payment processor regulations; card data is never stored by Kainook beyond the transaction.'
		],
		['Communications & support tickets', '3 years from the date of the last interaction.'],
		[
			'Reviews and ratings',
			'Retained while the listing is active; may be anonymised or deleted upon request if no longer needed.'
		],
		[
			'Marketing preferences & consent records',
			'Until you withdraw consent, plus 3 years thereafter for compliance purposes.'
		],
		['Fraud and security logs', 'Up to 5 years to detect and prevent recurrent fraud.'],
		[
			'Legal hold data',
			'For the duration of any ongoing legal proceeding or regulatory investigation.'
		]
	];

	const cookieRows: [string, string, string][] = [
		[
			'Strictly Necessary',
			'Session management, authentication, security, booking flow.',
			'No — required.'
		],
		[
			'Functional',
			'Remembering your language, currency, and search preferences.',
			'Yes — via settings.'
		],
		[
			'Analytics',
			'Understanding how users navigate the Platform to improve it.',
			'Yes — via settings.'
		],
		[
			'Performance',
			'Measuring page load speed and identifying technical issues.',
			'Yes — via settings.'
		],
		[
			'Marketing / Retargeting',
			'Serving relevant travel-related advertising on third-party platforms.',
			'Yes — withdraw consent.'
		]
	];

	const sections = [
		{
			id: 'intro',
			label: '1. Introduction',
			icon: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z'
		},
		{
			id: 'controller',
			label: '2. Data Controller',
			icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z'
		},
		{
			id: 'collect',
			label: '3. What We Collect',
			icon: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z'
		},
		{
			id: 'legal-basis',
			label: '4. Legal Basis',
			icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z'
		},
		{
			id: 'usage',
			label: '5. How We Use Data',
			icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125'
		},
		{
			id: 'sharing',
			label: '6-7. Data Sharing & Transfers',
			icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'
		},
		{
			id: 'retention',
			label: '8-10. Rights, Retention & Cookies',
			icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
		},
		{
			id: 'other',
			label: '11-18. Security & Deletion',
			icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z'
		}
	];
</script>

<svelte:head>
	<title>Privacy Policy — Kainook</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 font-sans text-slate-800">
	<!-- Header -->
	<header
		class="sticky top-0 z-40 border-b border-slate-100 bg-white/95 shadow-[0_1px_4px_rgba(0,0,0,0.04)] backdrop-blur-md"
	>
		<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
			<a href="/" class="flex items-center gap-3">
				<img
					src="/kainook-logo.jpeg"
					alt="Kainook Logo"
					width="40"
					height="40"
					class="rounded-xl shadow-sm"
				/>
				<span class="font-serif text-xl font-bold tracking-tight text-[#0c2614]">KAINOOK</span>
			</a>
		</div>
	</header>

	<!-- Main Content -->
	<main class="mx-auto max-w-6xl px-4 py-8">
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-4">
			<!-- Sidebar Nav -->
			<aside class="h-fit space-y-2 lg:sticky lg:top-24 lg:col-span-1">
				<h3 class="mb-2 px-3 text-xs font-bold tracking-wider text-slate-400 uppercase">
					Sections
				</h3>
				{#each sections as s (s.id)}
					<a
						href={`#${s.id}`}
						class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#0c2614]"
					>
						<svg
							class="h-4 w-4 text-[#1D8D2B]"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d={s.icon} />
						</svg>
						{s.label}
					</a>
				{/each}
			</aside>

			<!-- Doc Content -->
			<article
				class="space-y-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] md:p-10 lg:col-span-3"
			>
				<!-- Cover Info -->
				<div class="border-b border-slate-100 pb-6 text-center lg:text-left">
					<span class="text-[10px] font-bold tracking-[0.3em] text-[#1D8D2B] uppercase"
						>Kainook Travel</span
					>
					<h1 class="mt-2 font-serif text-3xl font-bold text-slate-900 md:text-4xl">
						PRIVACY POLICY
					</h1>
					<p class="mt-1 text-sm text-slate-500">
						How We Collect, Use, Share & Protect Your Personal Data
					</p>
					<div
						class="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-400 lg:justify-start"
					>
						<span>Kainook Travel OÜ</span>
						<span>•</span>
						<span>Tallinn, Estonia</span>
						<span>•</span>
						<span>Effective Date: June 2026</span>
					</div>
				</div>

				<!-- Section 1 -->
				<section id="intro" class="scroll-mt-20 space-y-4">
					<h2 class="border-l-4 border-[#1D8D2B] pl-3 font-serif text-xl font-bold text-slate-900">
						1. Introduction & Who We Are
					</h2>
					<p class="text-sm leading-relaxed text-slate-600">
						Your privacy matters to us. This Privacy Policy explains how Kainook Travel OÜ
						("Kainook", "we", "us", "our"), a private limited company registered in Tallinn,
						Estonia, collects, uses, shares, stores, and protects your personal data when you use
						our platform — including our website and mobile application (collectively, the
						"Platform").
					</p>
					<p class="text-sm leading-relaxed text-slate-600">
						Kainook operates as a marketplace connecting travellers ("Guests") with accommodation
						providers, vehicle rental companies, and activity operators ("Providers") primarily
						across Africa and internationally. In doing so, we process personal data as a data
						controller under applicable data protection law, including the European Union General
						Data Protection Regulation (GDPR) and the Estonian Personal Data Protection Act.
					</p>
					<div class="space-y-3 rounded-2xl border border-[#1D8D2B]/10 bg-[#1D8D2B]/5 p-5">
						<h4 class="text-sm font-bold text-[#0c2614]">Our Commitment to You</h4>
						<ul class="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
							<li>We collect only the data we genuinely need to operate the Platform.</li>
							<li>We never sell your personal data to third parties.</li>
							<li>We are transparent about how your data is used and with whom it is shared.</li>
							<li>
								We give you meaningful control over your data, including the right to access,
								correct, and delete it.
							</li>
							<li>
								We apply strong technical and organisational security measures to protect your data.
							</li>
						</ul>
					</div>
					<p class="text-sm leading-relaxed text-slate-600">
						This Policy applies to all users of the Platform, including Guests, Providers, and
						visitors. It should be read alongside our Terms of Use. If you do not agree with this
						Policy, please do not use the Platform.
					</p>
				</section>

				<hr class="border-slate-100" />

				<!-- Section 2 -->
				<section id="controller" class="scroll-mt-20 space-y-4">
					<h2 class="border-l-4 border-[#1D8D2B] pl-3 font-serif text-xl font-bold text-slate-900">
						2. Data Controller
					</h2>
					<p class="text-sm leading-relaxed text-slate-600">
						The data controller responsible for your personal data is:
					</p>
					<div
						class="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-xs text-slate-600"
					>
						<p><strong>Kainook Travel OÜ</strong></p>
						<p>Registered in Tallinn, Estonia</p>
						<p>
							Email: <a
								href="mailto:info@kainook.com"
								class="font-semibold text-[#1D8D2B] hover:underline">info@kainook.com</a
							>
						</p>
						<p>
							Website: <a
								href="https://www.kainook.com"
								target="_blank"
								rel="noopener noreferrer"
								class="font-semibold text-[#1D8D2B] hover:underline">www.kainook.com</a
							>
						</p>
					</div>
					<p class="text-sm leading-relaxed text-slate-600">
						For any data protection enquiry or to exercise your rights, please contact us at
						<a href="mailto:info@kainook.com" class="text-[#1D8D2B] hover:underline"
							>info@kainook.com</a
						>. We aim to respond to all requests within 30 days.
					</p>
				</section>

				<hr class="border-slate-100" />

				<!-- Section 3 -->
				<section id="collect" class="scroll-mt-20 space-y-6">
					<h2 class="border-l-4 border-[#1D8D2B] pl-3 font-serif text-xl font-bold text-slate-900">
						3. What Personal Data We Collect
					</h2>
					<p class="text-sm leading-relaxed text-slate-600">
						We collect personal data in three ways: data you provide directly, data generated
						through your use of the Platform, and data received from third parties.
					</p>

					<div class="space-y-3">
						<h3 class="text-sm font-bold text-slate-900">3.1 Data You Provide Directly</h3>
						<div class="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
							<table class="w-full border-collapse text-left text-xs">
								<thead>
									<tr class="bg-[#1D8D2B] text-white">
										<th class="w-1/3 border-r border-white/20 p-3 font-semibold">Category</th>
										<th class="w-2/3 p-3 font-semibold">Examples</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100 text-slate-600">
									<tr class="divide-x divide-slate-100 hover:bg-slate-50">
										<td class="p-3 font-medium text-slate-800">Account Registration</td>
										<td class="p-3"
											>Full name, email address, phone number, password (hashed), profile photo,
											preferred language and currency.</td
										>
									</tr>
									<tr class="divide-x divide-slate-100 hover:bg-slate-50">
										<td class="p-3 font-medium text-slate-800">Booking Information</td>
										<td class="p-3"
											>Travel dates, number of guests, special requests, guest names, nationality.</td
										>
									</tr>
									<tr class="divide-x divide-slate-100 hover:bg-slate-50">
										<td class="p-3 font-medium text-slate-800">Payment Information</td>
										<td class="p-3"
											>Card details (processed securely via Stripe), mobile money account details
											(processed via Tara), billing address. Full card numbers are never stored by
											Kainook.</td
										>
									</tr>
									<tr class="divide-x divide-slate-100 hover:bg-slate-50">
										<td class="p-3 font-medium text-slate-800">Identity Verification</td>
										<td class="p-3"
											>Government-issued ID (where required for certain Providers or age
											verification), date of birth.</td
										>
									</tr>
									<tr class="divide-x divide-slate-100 hover:bg-slate-50">
										<td class="p-3 font-medium text-slate-800">Communications</td>
										<td class="p-3"
											>Messages exchanged via in-app messaging between Guests and Providers, support
											tickets, feedback, reviews and ratings.</td
										>
									</tr>
									<tr class="divide-x divide-slate-100 hover:bg-slate-50">
										<td class="p-3 font-medium text-slate-800">Provider Onboarding</td>
										<td class="p-3"
											>Business name, registration number, address, banking details for payouts,
											listing information (descriptions, photos, pricing, availability).</td
										>
									</tr>
									<tr class="divide-x divide-slate-100 hover:bg-slate-50">
										<td class="p-3 font-medium text-slate-800">Preferences & Settings</td>
										<td class="p-3"
											>Notification preferences, saved searches, wishlist/favourites, loyalty
											programme (AfriPoints) activity.</td
										>
									</tr>
								</tbody>
							</table>
						</div>
					</div>

					<div class="space-y-3">
						<h3 class="text-sm font-bold text-slate-900">3.2 Data Generated Automatically</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							When you use the Platform, we automatically collect certain technical and behavioural
							data:
						</p>
						<ul class="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
							<li>
								Device and browser information (device type, operating system, browser type, screen
								resolution).
							</li>
							<li>
								IP address and approximate geolocation (country/city level, not precise GPS unless
								explicitly granted).
							</li>
							<li>
								Usage data (pages visited, search queries, filters applied, listings viewed, time
								spent on pages).
							</li>
							<li>
								Booking funnel data (steps completed, drop-off points, booking reference,
								confirmation status).
							</li>
							<li>
								Session identifiers, cookies and similar tracking technologies (see Section 10 on
								Cookies).
							</li>
							<li>App performance data and crash reports.</li>
						</ul>
					</div>

					<div class="space-y-3">
						<h3 class="text-sm font-bold text-slate-900">3.2a Data You Give Us About Others</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							When making a booking that includes other travellers — for example, booking
							accommodation for a family member, colleague, or group — you may provide us with
							personal data about those individuals. This may include their names, dates of birth,
							nationality, dietary or accessibility preferences, or identification information
							required for check-in. You are responsible for ensuring those individuals are aware
							their data will be shared with Kainook and that they have accepted this Privacy Policy
							before you provide their information to us.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-sm font-bold text-slate-900">3.3 Data We Receive from Third Parties</h3>
						<ul class="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
							<li>
								Payment processors (Stripe, Tara): transaction status, fraud signals, payment method
								verification results.
							</li>
							<li>
								Social login providers (Google, Apple, Facebook — if you choose to sign in via
								these): name, email address, profile picture, unique identifier.
							</li>
							<li>
								Channel managers and OTAs (Airbnb, Booking.com): availability and reservation data
								synced via iCal integration (Providers only).
							</li>
							<li>
								Identity verification services: verification status and risk flags (where
								applicable).
							</li>
							<li>
								Analytics and advertising partners: aggregated behavioural data to improve the
								Platform.
							</li>
						</ul>
					</div>
				</section>

				<hr class="border-slate-100" />

				<!-- Section 4 -->
				<section id="legal-basis" class="scroll-mt-20 space-y-4">
					<h2 class="border-l-4 border-[#1D8D2B] pl-3 font-serif text-xl font-bold text-slate-900">
						4. Legal Basis for Processing (GDPR)
					</h2>
					<p class="text-sm leading-relaxed text-slate-600">
						For users in the European Economic Area (EEA) and where the GDPR applies, we rely on the
						following legal bases to process your personal data:
					</p>
					<div class="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
						<table class="w-full border-collapse text-left text-xs">
							<thead>
								<tr class="bg-[#1D8D2B] text-white">
									<th class="border-r border-white/20 p-3 font-semibold">Processing Activity</th>
									<th class="border-r border-white/20 p-3 font-semibold">Legal Basis</th>
									<th class="p-3 font-semibold">Details</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100 text-slate-600">
								<tr class="divide-x divide-slate-100 hover:bg-slate-50">
									<td class="p-3 font-semibold text-slate-800">Account creation and management</td>
									<td class="p-3">Contract (Art. 6(1)(b))</td>
									<td class="p-3">Necessary to provide you with a user account.</td>
								</tr>
								<tr class="divide-x divide-slate-100 hover:bg-slate-50">
									<td class="p-3 font-semibold text-slate-800">Processing bookings and payments</td>
									<td class="p-3">Contract (Art. 6(1)(b))</td>
									<td class="p-3">Necessary to execute the booking you requested.</td>
								</tr>
								<tr class="divide-x divide-slate-100 hover:bg-slate-50">
									<td class="p-3 font-semibold text-slate-800">Fraud prevention and security</td>
									<td class="p-3">Legitimate interest (Art. 6(1)(f))</td>
									<td class="p-3"
										>Protecting users, Providers, and the Platform from fraud and abuse.</td
									>
								</tr>
								<tr class="divide-x divide-slate-100 hover:bg-slate-50">
									<td class="p-3 font-semibold text-slate-800"
										>Sending booking confirmations and service communications</td
									>
									<td class="p-3">Contract (Art. 6(1)(b))</td>
									<td class="p-3">Necessary for providing the service.</td>
								</tr>
								<tr class="divide-x divide-slate-100 hover:bg-slate-50">
									<td class="p-3 font-semibold text-slate-800">Customer support</td>
									<td class="p-3">Contract / Legitimate interest</td>
									<td class="p-3">Resolving your queries and improving service quality.</td>
								</tr>
								<tr class="divide-x divide-slate-100 hover:bg-slate-50">
									<td class="p-3 font-semibold text-slate-800"
										>Marketing emails and push notifications</td
									>
									<td class="p-3">Consent (Art. 6(1)(a))</td>
									<td class="p-3">Only where you have opted in. Withdraw at any time.</td>
								</tr>
								<tr class="divide-x divide-slate-100 hover:bg-slate-50">
									<td class="p-3 font-semibold text-slate-800"
										>Analytics and Platform improvement</td
									>
									<td class="p-3">Legitimate interest (Art. 6(1)(f))</td>
									<td class="p-3">Understanding usage patterns to improve the Platform.</td>
								</tr>
								<tr class="divide-x divide-slate-100 hover:bg-slate-50">
									<td class="p-3 font-semibold text-slate-800"
										>Legal compliance (tax, anti-money laundering)</td
									>
									<td class="p-3">Legal obligation (Art. 6(1)(c))</td>
									<td class="p-3">Compliance with applicable Estonian and EU law.</td>
								</tr>
								<tr class="divide-x divide-slate-100 hover:bg-slate-50">
									<td class="p-3 font-semibold text-slate-800">Reviews and ratings</td>
									<td class="p-3">Legitimate interest (Art. 6(1)(f))</td>
									<td class="p-3">Maintaining Platform quality and transparency.</td>
								</tr>
								<tr class="divide-x divide-slate-100 hover:bg-slate-50">
									<td class="p-3 font-semibold text-slate-800">AfriPoints loyalty programme</td>
									<td class="p-3">Contract (Art. 6(1)(b))</td>
									<td class="p-3">Administering rewards for qualifying bookings.</td>
								</tr>
							</tbody>
						</table>
					</div>
					<p class="mt-2 text-xs text-slate-600 italic">
						Where we rely on legitimate interests, we have assessed that our interests are not
						overridden by your rights and interests. You may object to processing based on
						legitimate interests at any time (see Section 9).
					</p>
				</section>

				<hr class="border-slate-100" />

				<!-- Section 5 -->
				<section id="usage" class="scroll-mt-20 space-y-6">
					<h2 class="border-l-4 border-[#1D8D2B] pl-3 font-serif text-xl font-bold text-slate-900">
						5. How We Use Your Personal Data
					</h2>
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div class="space-y-2">
							<h4 class="text-sm font-bold text-slate-900">
								5.1 To Provide and Operate the Platform
							</h4>
							<ul class="list-disc space-y-1 pl-5 text-xs text-slate-600">
								<li>Create and manage your user account.</li>
								<li>Process and confirm bookings between Guests and Providers.</li>
								<li>
									Facilitate payment collection and Provider payouts (within 24 hours of Guest
									check-in).
								</li>
								<li>Send booking confirmations, vouchers, receipts, and itinerary updates.</li>
								<li>Enable in-app messaging between Guests and Providers.</li>
								<li>Administer the AfriPoints loyalty programme and reward eligible bookings.</li>
							</ul>
						</div>
						<div class="space-y-2">
							<h4 class="text-sm font-bold text-slate-900">
								5.2 To Ensure Safety, Security & Trust
							</h4>
							<ul class="list-disc space-y-1 pl-5 text-xs text-slate-600">
								<li>Verify user identity and prevent fraudulent or abusive activity.</li>
								<li>
									Monitor messaging for prohibited content (e.g., contact details shared to
									circumvent the Platform).
								</li>
								<li>Detect and investigate suspicious transactions or policy violations.</li>
								<li>
									Enforce our Terms of Use and take action against users or Providers who breach
									them.
								</li>
								<li>
									Maintain review integrity and investigate reported fake or malicious reviews.
								</li>
							</ul>
						</div>
						<div class="space-y-2">
							<h4 class="text-sm font-bold text-slate-900">
								5.3 To Improve and Personalise the Platform
							</h4>
							<ul class="list-disc space-y-1 pl-5 text-xs text-slate-600">
								<li>
									Analyse usage patterns to improve search, recommendations, and booking flows.
								</li>
								<li>
									Personalise search results, listing recommendations, and promotional content based
									on your preferences and history.
								</li>
								<li>Conduct A/B testing and product research to improve Platform features.</li>
								<li>
									Train internal models (non-identifiable, aggregated data only) to improve fraud
									detection and recommendations.
								</li>
							</ul>
						</div>
						<div class="space-y-2">
							<h4 class="text-sm font-bold text-slate-900">5.4 To Communicate with You</h4>
							<ul class="list-disc space-y-1 pl-5 text-xs text-slate-600">
								<li>
									Send transactional communications: booking confirmations, cancellation notices,
									payment receipts, check-in reminders.
								</li>
								<li>
									Send service-related notifications: policy updates, security alerts, account
									notices.
								</li>
								<li>
									Send marketing communications (with your consent): personalised travel
									recommendations, promotional offers, AfriPoints updates. You may unsubscribe at
									any time.
								</li>
							</ul>
						</div>
					</div>

					<div class="space-y-3 pt-3">
						<h4 class="text-sm font-bold text-slate-900">
							5.5 For Market Research & Service Improvement
						</h4>
						<p class="text-sm leading-relaxed text-slate-600">
							Invite Guests and Providers to voluntarily participate in surveys, feedback
							programmes, and market research initiatives. We analyse aggregated and anonymised
							booking and search data to understand travel demand trends and improve destination
							coverage across Africa.
						</p>
						<p class="text-xs text-slate-600 italic">
							Any invitation to participate in market research will clearly describe what personal
							data is collected and how it will be used. Participation is always voluntary.
						</p>
					</div>

					<div class="space-y-2">
						<h4 class="text-sm font-bold text-slate-900">5.6 To Display Relevant Pricing</h4>
						<p class="text-sm leading-relaxed text-slate-600">
							When displaying search results and pricing, we may use data such as your approximate
							location (derived from your IP address), device type, currency preference, and prior
							searches to display pricing in your local currency and the most relevant rates for
							your market. This reflects currency localisation and market availability — not
							individualised or discriminatory pricing targeting you personally.
						</p>
					</div>

					<div class="space-y-2">
						<h4 class="text-sm font-bold text-slate-900">5.7 To Comply with Legal Obligations</h4>
						<ul class="list-disc space-y-1 pl-5 text-xs text-slate-600">
							<li>
								Retain transaction records as required by Estonian tax law and applicable financial
								regulations.
							</li>
							<li>Respond to lawful requests from law enforcement or regulatory authorities.</li>
							<li>
								Comply with anti-money laundering (AML) and know-your-customer (KYC) requirements
								where applicable.
							</li>
						</ul>
					</div>
				</section>

				<hr class="border-slate-100" />

				<!-- Sections 6 & 7 -->
				<section id="sharing" class="scroll-mt-20 space-y-6">
					<h2 class="border-l-4 border-[#1D8D2B] pl-3 font-serif text-xl font-bold text-slate-900">
						6. How We Share Your Personal Data
					</h2>
					<div
						class="rounded-r-2xl border-l-4 border-[#1D8D2B] bg-[#1D8D2B]/5 p-4 text-xs leading-relaxed font-medium text-slate-600"
					>
						<strong>We Do Not Sell Your Data:</strong> Kainook does not sell, rent, or trade your personal
						data to third parties for their own commercial purposes. Period.
					</div>
					<p class="text-sm text-slate-600">
						We share your data only in the following circumstances:
					</p>

					<div class="space-y-3 pl-4">
						<h4 class="text-sm font-bold text-slate-900">
							6.1 With Providers (to Fulfil Your Booking)
						</h4>
						<p class="text-xs leading-relaxed text-slate-600">
							When you make a booking, we share the information necessary for the Provider to
							deliver the service. This includes: Guest name, booking reference, travel dates,
							number of guests, special requests, contact information (email address, phone number)
							— shared only after booking confirmation, and payment status confirmation (not full
							card details).
						</p>
						<p class="text-xs text-slate-500 italic">
							Providers are required to handle your data solely for the purpose of delivering the
							booked service and in compliance with applicable data protection law. They may not use
							your data for their own marketing purposes without your separate consent.
						</p>
					</div>

					<div class="space-y-2 pl-4">
						<h4 class="text-sm font-bold text-slate-900">6.2 With Payment Processors</h4>
						<p class="text-xs leading-relaxed text-slate-600">
							Stripe (international card payments) processes card transactions securely. Stripe is a
							certified PCI DSS Level 1 service provider. Tara (African mobile money) processes
							mobile money transactions. Tara's own privacy practices apply to data shared with
							Tara. Kainook does not store full card numbers.
						</p>
					</div>

					<div class="space-y-3 pl-4">
						<h4 class="text-sm font-bold text-slate-900">
							6.3 With Service Providers & Technology Partners
						</h4>
						<div class="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
							<table class="w-full border-collapse text-left text-xs">
								<thead>
									<tr class="bg-slate-100 text-slate-800">
										<th class="w-1/3 border-r border-slate-200 p-2.5 font-semibold"
											>Service Provider Type</th
										>
										<th class="p-2.5 font-semibold">Purpose</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100 text-slate-600">
									{#each serviceProviders as row (row[0])}
										<tr class="hover:bg-slate-50">
											<td class="border-r border-slate-100 p-2.5 font-medium text-slate-800"
												>{row[0]}</td
											>
											<td class="p-2.5">{row[1]}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<p class="text-xs text-slate-600">
							All third-party processors are bound by data processing agreements requiring them to
							handle your data securely, lawfully, and only for the purposes specified.
						</p>
					</div>

					<div class="space-y-2 pl-4">
						<h4 class="text-sm font-bold text-slate-900">
							6.4 With Other Users (Public Information)
						</h4>
						<ul class="list-disc space-y-1 pl-5 text-xs text-slate-600">
							<li>
								Guest reviews and ratings (attributed to your display name, not your full name or
								email).
							</li>
							<li>Provider listing information, response rates, and review scores.</li>
						</ul>
					</div>

					<div class="space-y-2 pl-4">
						<h4 class="text-sm font-bold text-slate-900">
							6.5-6.6 Legal Reasons & Business Transfers
						</h4>
						<p class="text-xs leading-relaxed text-slate-600">
							We may disclose data to comply with laws, protect platform safety, or in the event of
							a merger/acquisition (users will be notified in advance).
						</p>
					</div>

					<!-- Section 7 -->
					<div class="space-y-3 border-t border-slate-100 pt-4">
						<h2 class="font-serif text-xl font-bold text-slate-900">
							7. International Data Transfers
						</h2>
						<p class="text-sm leading-relaxed text-slate-600">
							Kainook is headquartered in Estonia (EU). Because we operate across Africa and
							internationally, your personal data may be transferred to and processed in countries
							outside the European Economic Area (EEA), including countries where data protection
							laws may differ from those in the EU.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							When we transfer personal data outside the EEA, we ensure appropriate safeguards are
							in place, including: Adequacy decisions by the European Commission, Standard
							Contractual Clauses (SCCs), or Binding Corporate Rules (BCRs) where applicable.
						</p>
					</div>
				</section>

				<hr class="border-slate-100" />

				<!-- Sections 8, 9, 10 -->
				<section id="retention" class="scroll-mt-20 space-y-6">
					<h2 class="border-l-4 border-[#1D8D2B] pl-3 font-serif text-xl font-bold text-slate-900">
						8. How Long We Keep Your Data
					</h2>
					<div class="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
						<table class="w-full border-collapse text-left text-xs">
							<thead>
								<tr class="bg-[#1D8D2B] text-white">
									<th class="w-1/3 border-r border-white/20 p-3 font-semibold">Data Category</th>
									<th class="p-3 font-semibold">Retention Period</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100 text-slate-600">
								{#each retentionRows as row (row[0])}
									<tr class="divide-x divide-slate-100 hover:bg-slate-50">
										<td class="p-3 font-semibold text-slate-800">{row[0]}</td>
										<td class="p-3">{row[1]}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Section 9 -->
					<div class="space-y-3 border-t border-slate-100 pt-4">
						<h2 class="font-serif text-xl font-bold text-slate-900">
							9. Your Data Protection Rights
						</h2>
						<p class="text-sm leading-relaxed text-slate-600">
							Depending on your location and the applicable law, you have the following rights
							regarding your personal data: Right of Access, Right to Rectification, Right to
							Erasure, Right to Restriction of Processing, Right to Data Portability, Right to
							Object, Right to Withdraw Consent, and Right to Lodge a Complaint with the Estonian
							Data Protection Inspectorate.
						</p>
						<div
							class="space-y-2 rounded-2xl border border-[#1D8D2B]/10 bg-[#1D8D2B]/5 p-5 text-xs"
						>
							<p class="font-bold text-[#0c2614]">How to Exercise Your Rights</p>
							<p class="leading-relaxed text-slate-600">
								Submit your request to: <a
									href="mailto:info@kainook.com"
									class="font-semibold text-[#1D8D2B] hover:underline">info@kainook.com</a
								>
								or through the Privacy Settings section of your Account. We respond within 30 days. No
								fees apply unless requests are manifestly unfounded or excessive.
							</p>
						</div>
					</div>

					<!-- Section 10 -->
					<div class="space-y-3 border-t border-slate-100 pt-4">
						<h2 class="font-serif text-xl font-bold text-slate-900">
							10. Cookies & Tracking Technologies
						</h2>
						<div class="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
							<table class="w-full border-collapse text-left text-xs">
								<thead>
									<tr class="bg-slate-100 text-slate-800">
										<th class="w-1/4 border-r border-slate-200 p-2.5 font-semibold">Cookie Type</th>
										<th class="w-1/2 border-r border-slate-200 p-2.5 font-semibold">Purpose</th>
										<th class="p-2.5 font-semibold">Can You Opt Out?</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100 text-slate-600">
									{#each cookieRows as row (row[0])}
										<tr class="hover:bg-slate-50">
											<td class="border-r border-slate-100 p-2.5 font-semibold text-slate-800"
												>{row[0]}</td
											>
											<td class="border-r border-slate-100 p-2.5">{row[1]}</td>
											<td class="p-2.5">{row[2]}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</section>

				<hr class="border-slate-100" />

				<!-- Sections 11-18 -->
				<section id="other" class="scroll-mt-20 space-y-6">
					<h2 class="border-l-4 border-[#1D8D2B] pl-3 font-serif text-xl font-bold text-slate-900">
						11-18. Security, Account Deletion & Other Policies
					</h2>

					<div class="space-y-3">
						<h3 class="text-sm font-bold text-slate-900">
							11-12. Children's Privacy & Data Security
						</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							We do not knowingly collect data from children under 18. We apply industry-standard
							security measures including TLS encryption in transit, encryption at rest, strict
							staff access controls, and PCI-DSS compliance for payment processors.
						</p>
						<div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
							<strong>In Case of a Data Breach:</strong> If a breach occurs that puts your rights at risk,
							we will notify you and report to the Estonian Data Protection Inspectorate within 72 hours.
						</div>
					</div>

					<div class="space-y-2">
						<h3 class="text-sm font-bold text-slate-900">13. Privacy & Providers</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Providers are independent data controllers for data they collect directly from guests.
							They are contractually obligated to process Guest data only for the booking, not use
							it for marketing without consent, and comply with data protection laws.
						</p>
					</div>

					<div class="space-y-2">
						<h3 class="text-sm font-bold text-slate-900">
							14-16. Third-Party Links, Accessibility & Changes
						</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							This policy doesn't apply to third-party links. We are committed to digital
							accessibility and providing alternatives. Changes to this Policy will be notified at
							least 14 days before taking effect.
						</p>
					</div>

					<div class="space-y-3 border-t border-slate-100 pt-3">
						<h3 class="text-base font-bold text-slate-900">17. Account Deletion Policy</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							You can delete your account via App Settings or by emailing
							<a href="mailto:info@kainook.com" class="text-[#1D8D2B] hover:underline"
								>info@kainook.com</a
							>. Requests are processed within 30 days. Deletion is irreversible.
						</p>
						<h4 class="mt-2 text-xs font-bold text-slate-800">
							Data Retained after Account Deletion:
						</h4>
						<ul class="list-disc space-y-1 pl-5 text-xs text-slate-600">
							<li>
								<strong>Transaction & booking records:</strong> 7 years for tax and accounting compliance.
							</li>
							<li>
								<strong>Reviews and ratings:</strong> Retained anonymously with display name removed.
							</li>
							<li><strong>Fraud logs:</strong> Up to 5 years.</li>
							<li>
								<strong>Legal hold & Dispute records:</strong> For the duration of any proceeding/investigation,
								or 3 years.
							</li>
						</ul>
						<div
							class="rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs leading-relaxed text-slate-600"
						>
							<strong>Important — Pending Bookings:</strong> You cannot delete your account if you have
							active/upcoming bookings or active listings (for Providers).
						</div>
					</div>

					<!-- Section 18 -->
					<div class="space-y-4 border-t border-slate-100 pt-4">
						<h3 class="text-base font-bold text-slate-900">18. Contact & Supervisory Authority</h3>
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div
								class="space-y-1.5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600"
							>
								<span class="font-bold text-slate-800">Contact Us</span>
								<p>Data Protection: info@kainook.com</p>
								<p>General Support: support@kainook.com</p>
								<p>Kainook Travel OÜ — Tallinn, Estonia</p>
							</div>
							<div
								class="space-y-1.5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600"
							>
								<span class="font-bold text-slate-800">Supervisory Authority</span>
								<p>Estonian Data Protection Inspectorate</p>
								<p>Website: www.aki.ee</p>
								<p>Email: info@aki.ee</p>
								<p>Address: Tatari 39, 10134 Tallinn, Estonia</p>
							</div>
						</div>
					</div>

					<div
						class="space-y-1.5 border-t border-slate-100 pt-6 text-center text-xs text-slate-400"
					>
						<p class="font-semibold text-slate-600">— End of Kainook Travel Privacy Policy —</p>
						<p>Effective Date: June 2026</p>
						<p>Kainook Travel OÜ · Tallinn, Estonia · info@kainook.com</p>
					</div>
				</section>
			</article>
		</div>
	</main>
</div>
