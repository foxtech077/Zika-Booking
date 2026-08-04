<script lang="ts">
	const accommodationRows: [string, string][] = [
		[
			'Provide accurate property descriptions, photos, and up-to-date availability.',
			'Provide accurate personal details and requirements at time of booking.'
		],
		[
			'Set and honour their own cancellation and refund policies.',
			"Review and accept the Provider's cancellation policy before confirming."
		],
		[
			'Deliver the accommodation in the condition described.',
			'Arrive within communicated check-in times or notify the Provider of delays.'
		],
		[
			'Maintain the property in a safe, clean, and habitable condition.',
			'Respect property rules, quiet hours, occupancy limits, and house rules.'
		],
		[
			'Provide accurate pricing including all mandatory charges.',
			'Pay for any extras, damages, or charges incurred during the stay.'
		],
		[
			'Notify Kainook and Guests of any changes to their listing or service.',
			'Leave the property in a satisfactory condition at check-out.'
		],
		[
			'Hold all required business licences, safety certifications, and insurance.',
			'Not cause damage, nuisance, or disturbance to staff or neighbours.'
		]
	];

	const carRentalRows: [string, string][] = [
		[
			'Provide accurate vehicle descriptions, photos, and rental conditions.',
			'Present a valid driving licence (and international permit if required) at collection.'
		],
		[
			'Maintain vehicles in roadworthy and safe condition.',
			"Present valid photo ID and a credit card in the primary driver's name."
		],
		[
			'State all included and excluded costs clearly (insurance, mileage, fuel, options).',
			'Return the vehicle at the agreed time, location, and fuel level.'
		],
		[
			'Set and honour their own cancellation policies.',
			'Drive only within permitted geographic zones specified in the rental agreement.'
		],
		[
			'Carry appropriate insurance in compliance with local regulations.',
			'Not drive under the influence of alcohol or controlled substances.'
		],
		[
			'Notify Guests of any vehicle substitutions or service changes.',
			'Not sub-let the vehicle or permit unauthorised drivers.'
		],
		[
			'Handle security deposit collection and return per published conditions.',
			'Report any accident, damage, or theft to the Provider and local authorities immediately.'
		]
	];

	const activityRows: [string, string][] = [
		[
			'Provide accurate activity descriptions, inclusions, and exclusions.',
			'Arrive at the designated meeting point at the time stated in the booking confirmation.'
		],
		[
			'Communicate all physical requirements, age restrictions, and health advisories upfront.',
			'Assess personal fitness and health suitability before booking.'
		],
		[
			'Ensure all safety equipment is available and meets applicable standards.',
			'Disclose any health conditions that may affect participation to the Provider before the activity.'
		],
		[
			'Obtain all necessary permits, licences, and insurance for the activity.',
			'Follow all safety instructions from the Provider and their guides at all times.'
		],
		[
			'Provide qualified guides and appropriate supervision throughout.',
			'Sign any required liability waivers before participation.'
		],
		[
			'Communicate changes (weather cancellations, route changes) to Guests promptly.',
			'Not participate if under the influence of alcohol or substances that impair safety.'
		],
		[
			'Set and honour their cancellation and refund policies.',
			'Cover any additional costs (meals, transport, tips, equipment rental) not listed as included.'
		]
	];

	const sections = [
		{
			id: 'intro',
			label: 'Introduction',
			icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 13l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 13V7m0 0L9 7'
		},
		{
			id: 'section-a',
			label: 'Section A - General',
			icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25'
		},
		{
			id: 'section-b',
			label: 'Section B - Accommodation',
			icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25'
		},
		{
			id: 'section-c',
			label: 'Section C - Car Rental',
			icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'
		},
		{
			id: 'section-d',
			label: 'Section D - Tours & Activities',
			icon: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085'
		},
		{
			id: 'final',
			label: 'Final Provisions',
			icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
		}
	];
</script>

<svelte:head>
	<title>Terms of Use — Kainook</title>
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
						TERMS OF USE
					</h1>
					<p class="mt-1 text-sm text-slate-500">
						Platform Rules · Provider & Guest Responsibilities · Booking Conditions
					</p>
					<div
						class="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-400 lg:justify-start"
					>
						<span>Kainook Travel OÜ</span>
						<span>•</span>
						<span>Tallinn, Estonia</span>
						<span>•</span>
						<span>Last Updated: June 2026</span>
					</div>
				</div>

				<!-- Introduction -->
				<section id="intro" class="scroll-mt-20 space-y-4">
					<h2 class="border-l-4 border-[#1D8D2B] pl-3 font-serif text-xl font-bold text-slate-900">
						Introduction
					</h2>
					<p class="text-sm leading-relaxed text-slate-600">
						Welcome to Kainook Travel — a marketplace platform connecting travellers ("Guests") with
						accommodation providers, vehicle rental companies, and activity operators ("Providers")
						across Africa and beyond.
					</p>
					<p class="text-sm leading-relaxed text-slate-600">
						These Terms of Use ("Terms") govern your access to and use of the Kainook platform,
						including our website and mobile application (collectively, the "Platform"). By
						accessing or using the Platform, you agree to be bound by these Terms. Please read them
						carefully before making any booking.
					</p>
					<div class="space-y-3 rounded-2xl border border-[#1D8D2B]/10 bg-[#1D8D2B]/5 p-5">
						<h4 class="text-sm font-bold text-[#0c2614]">How Kainook Works</h4>
						<ul class="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
							<li>
								Kainook is a technology marketplace — we connect Guests with independent Providers.
							</li>
							<li>Kainook is NOT a travel agent, tour operator, hotel, or car rental company.</li>
							<li>
								All travel services are provided directly by Providers, who are solely responsible
								for their quality and delivery.
							</li>
							<li>
								The contract for any travel service is formed directly between the Guest and the
								Provider.
							</li>
							<li>
								Kainook's role is limited to facilitating the booking process and providing the
								Platform.
							</li>
						</ul>
					</div>
					<p class="mt-2 text-sm leading-relaxed text-slate-600">
						These Terms are structured as follows:
					</p>
					<ul class="list-disc space-y-1 pl-5 text-sm text-slate-600">
						<li>
							<strong>Section A – General Conditions:</strong> applicable to all travel services on the
							Platform.
						</li>
						<li>
							<strong>Section B – Accommodation:</strong> specific conditions for hotel and apartment
							bookings.
						</li>
						<li>
							<strong>Section C – Car Rental:</strong> specific conditions for vehicle hire bookings.
						</li>
						<li>
							<strong>Section D – Activities & Tours:</strong> specific conditions for guided tours and
							experiences.
						</li>
					</ul>
					<p class="text-xs text-slate-500 italic">
						Where specific section conditions conflict with general conditions, the specific
						conditions prevail.
					</p>
				</section>

				<hr class="border-slate-100" />

				<!-- Section A -->
				<section id="section-a" class="scroll-mt-20 space-y-6">
					<div class="space-y-1">
						<span class="text-[10px] font-bold tracking-wider text-[#1D8D2B] uppercase"
							>Section A</span
						>
						<h2 class="font-serif text-2xl font-bold text-slate-900">General Conditions</h2>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">A1. Definitions</h3>
						<p class="text-sm text-slate-600">The following terms apply throughout these Terms:</p>
						<ul class="list-disc space-y-2 pl-4 text-sm text-slate-600">
							<li>
								<strong>"Kainook", "we", "us", "our"</strong> — Kainook Travel OÜ, a private limited company
								registered in Tallinn, Estonia, operating the Platform.
							</li>
							<li>
								<strong>"Platform"</strong> — the website and mobile application owned and operated by
								Kainook Travel OÜ, through which Travel Services are made available.
							</li>
							<li>
								<strong>"Travel Service"</strong> — any accommodation, vehicle rental, activity, tour,
								or other travel product that a Guest may search, compare, and book via the Platform from
								a Provider.
							</li>
							<li>
								<strong>"Provider"</strong> — any independent professional supplier of accommodation (hotel,
								apartment), transport (car rental), activities (guided tours), or other travel services
								listed on the Platform. Providers are independent third parties; they are not employees,
								agents, or representatives of Kainook.
							</li>
							<li>
								<strong>"Guest" or "you"</strong> — any individual accessing the Platform to search for
								or make a Booking.
							</li>
							<li>
								<strong>"Booking"</strong> — any confirmed reservation of a Travel Service made through
								the Platform.
							</li>
							<li>
								<strong>"Account"</strong> — a registered user account on the Platform required to access
								certain features and make Bookings.
							</li>
							<li>
								<strong>"AfriPoints"</strong> — Kainook's loyalty reward points programme with tiers:
								Bronze, Silver, Gold, and Diamond.
							</li>
						</ul>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">A2. Acceptance of Terms</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							By creating an Account or making a Booking, you confirm that you have read,
							understood, and accepted these Terms in full, along with any Provider-specific
							conditions communicated during the booking process (including cancellation policies).
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							You must be at least 18 years of age to register on the Platform and make a Booking.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							If any provision of these Terms is found to be invalid or unenforceable, the remaining
							provisions continue in full force and effect.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							The English version of these Terms is the authoritative version. In the event of any
							conflict with a translation, the English version prevails unless local mandatory law
							requires otherwise.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">
							A3. Kainook's Role as a Platform Intermediary
						</h3>
						<div class="space-y-2 rounded-r-2xl border-l-4 border-[#1D8D2B] bg-[#1D8D2B]/5 p-5">
							<h4 class="text-sm font-bold text-[#0c2614]">
								Important — Kainook is a Marketplace, Not a Travel Service Provider
							</h4>
							<p class="text-xs leading-relaxed text-slate-600">
								Kainook operates solely as a technology intermediary. We provide the Platform
								infrastructure through which Providers list their services and Guests discover,
								compare, and book them.
							</p>
							<p class="text-xs leading-relaxed text-slate-600">
								Kainook is NOT a party to the contract between the Guest and the Provider. Kainook
								does NOT own, manage, control, or operate any hotel, apartment, vehicle, or tour.
								Kainook does NOT employ or supervise any Provider's staff.
							</p>
							<p class="text-xs leading-relaxed text-slate-600">
								The listing of a Provider on the Platform does not constitute an endorsement,
								recommendation, or warranty of their services by Kainook.
							</p>
						</div>
						<p class="mt-3 text-sm text-slate-600">
							Kainook's specific platform functions include:
						</p>
						<ul class="list-disc space-y-1 pl-5 text-xs text-slate-600">
							<li>Publishing Provider listings and making them searchable and bookable.</li>
							<li>Processing payment transactions on behalf of Providers (where applicable).</li>
							<li>Transmitting booking confirmations and vouchers.</li>
							<li>Providing in-app messaging between Guests and Providers.</li>
							<li>Facilitating dispute escalation between Guests and Providers.</li>
							<li>Administering the AfriPoints loyalty programme.</li>
						</ul>
						<p class="text-sm text-slate-600 italic">
							Kainook is not responsible for the quality, safety, accuracy, legality, or fitness of
							any Travel Service. These responsibilities lie exclusively with the Provider.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">A4. Provider Responsibilities</h3>
						<p class="text-sm text-slate-600">
							Each Provider listed on the Platform is solely responsible for:
						</p>
						<ul class="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
							<li>
								The accuracy, completeness, and timeliness of their listing information
								(descriptions, photos, pricing, availability, amenities, policies).
							</li>
							<li>
								The lawful operation of their business, including all required licences, permits,
								registrations, insurance, and compliance with applicable local laws and regulations.
							</li>
							<li>
								The quality, safety, and delivery of their Travel Services in conformity with their
								listing description.
							</li>
							<li>
								Their own cancellation, refund, and modification policies, which must be clearly
								stated on their listing.
							</li>
							<li>
								Responding to Guest enquiries and managing bookings in a timely and professional
								manner.
							</li>
							<li>
								Promptly notifying Kainook and affected Guests of any changes to availability,
								pricing, or service conditions.
							</li>
							<li>
								Any damage, injury, or loss suffered by Guests as a result of the Provider's service
								or property.
							</li>
							<li>
								All taxes, duties, levies, and fiscal obligations arising from their business
								activities.
							</li>
						</ul>
						<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<h5 class="mb-1 text-xs font-bold text-slate-800">Provider Agreement</h5>
							<p class="text-xs leading-relaxed text-slate-500">
								All Providers are required to accept Kainook's Provider Terms & Conditions before
								listing on the Platform. By listing, Providers represent and warrant compliance with
								all applicable laws and that their listing information is accurate and up to date.
							</p>
						</div>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">A5. Guest Responsibilities</h3>
						<p class="text-sm text-slate-600">By using the Platform, Guests agree to:</p>
						<ul class="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
							<li>
								Provide accurate, complete, and truthful information when registering an Account and
								making a Booking.
							</li>
							<li>
								Comply with all applicable laws and regulations when using the Platform and
								consuming Travel Services.
							</li>
							<li>
								Respect all rules, policies, and instructions communicated by the Provider before
								and during the Travel Service.
							</li>
							<li>
								Treat Provider staff, property, and facilities with respect and refrain from causing
								damage, nuisance, or disturbance.
							</li>
							<li>
								Honour confirmed Bookings or cancel them within the applicable cancellation window.
							</li>
							<li>Not make speculative, false, or fraudulent Bookings.</li>
							<li>
								Not attempt to circumvent Platform security, access unauthorised data, or misuse the
								Platform.
							</li>
							<li>
								Not contact Providers to arrange direct payments or off-platform transactions that
								circumvent Kainook's booking system.
							</li>
							<li>
								Keep Account login credentials confidential and accept full responsibility for all
								activity carried out through their Account.
							</li>
						</ul>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">A6. Pricing</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Prices displayed on the Platform are set by Providers and are subject to change at any
							time before a Booking is confirmed. The price shown at the time of Booking
							confirmation is the price payable.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							All displayed prices include applicable taxes and fees unless clearly stated
							otherwise. Local tourist taxes or city levies may be collected directly by the
							Provider on arrival.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							Obvious errors and misprints (for example, an anomalously low price resulting from a
							technical fault) are not binding on Kainook or the Provider. In such cases, Kainook
							reserves the right to cancel the Booking and issue a full refund of any amount
							charged.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">A7. Payments</h3>
						<p class="text-sm text-slate-600">Kainook supports two payment rails:</p>
						<ul class="mb-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
							<li>
								<strong>Stripe</strong> — for international card payments (Visa, Mastercard, etc.).
							</li>
							<li><strong>Tara</strong> — for African mobile money payments.</li>
						</ul>
						<p class="text-sm leading-relaxed text-slate-600">
							Depending on the Travel Service selected, payment may be required in full at the time
							of Booking, or partially in advance with the remainder due on arrival. Payment terms
							are clearly indicated during the booking process.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							Where Kainook processes your payment, your transaction is handled securely. Your
							completed payment constitutes settlement of the amount due to the Provider.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							Where the Provider collects payment directly (e.g., on arrival), payment terms are
							governed by the Provider's own conditions as displayed during booking.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							Pre-authorisations or pre-payments may be processed immediately upon Booking
							confirmation. Depending on Provider policy, such amounts may be non-refundable. Please
							review cancellation policies carefully before confirming.
						</p>
						<p
							class="rounded-xl border border-[#1D8D2B]/10 bg-[#1D8D2B]/5 p-4 text-xs leading-relaxed text-slate-600"
						>
							Where payment is collected by Kainook on behalf of the Provider, the Guest's payment
							will be captured and transferred to the Provider within twenty-four (24) hours
							following the Guest's check-in. This ensures that funds are only settled once the
							Guest has taken possession of the service, providing an additional layer of security
							for both parties.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							If you suspect fraudulent or unauthorised use of your payment method, contact your
							bank or payment provider immediately.
						</p>
					</div>

					<div class="space-y-4">
						<h3 class="text-base font-bold text-slate-900">
							A8. Cancellations, Modifications & Refunds
						</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Cancellation and modification policies are set exclusively by each Provider and
							displayed on their listing during the booking process. Kainook does not determine
							these policies.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							All cancellation or modification requests must be submitted via the Platform.
						</p>
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div class="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
								<span class="text-[10px] font-bold tracking-wider text-[#1D8D2B] uppercase"
									>Guest-Initiated Cancellation</span
								>
								<ul class="list-disc space-y-1 pl-4 text-xs text-slate-600">
									<li>
										If you cancel within the Provider's free cancellation window: you will receive a
										full refund.
									</li>
									<li>
										If you cancel outside the free cancellation window: the Provider's cancellation
										fee applies, which may equal the full booking amount.
									</li>
									<li>
										In the event of a no-show without prior cancellation: the Provider may charge up
										to the full booking value.
									</li>
								</ul>
							</div>
							<div class="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
								<span class="text-[10px] font-bold tracking-wider text-[#1D8D2B] uppercase"
									>Refund Processing</span
								>
								<p class="text-xs leading-relaxed text-slate-600">
									Where a refund is due, Kainook will process it within five (5) business days of
									cancellation confirmation. Credit to your account may vary depending on your bank
									or payment provider; Kainook has no control over this timeline.
								</p>
							</div>
						</div>
						<p class="text-sm leading-relaxed text-slate-600">
							<strong>Full Refund for Substantiated Provider Failure:</strong> If a Guest submits a substantiated
							complaint to Kainook regarding Provider fraud, significant misrepresentation, or a material
							failure to deliver the booked service, Kainook will investigate and, if the complaint is
							confirmed, issue a full refund of amounts paid via the Platform. Kainook reserves the right
							to suspend or remove the relevant Provider pending investigation.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							If payment cannot be processed on the agreed date (e.g., expired card, insufficient
							funds), the Provider may cancel the Booking. Guests are responsible for ensuring their
							payment method remains valid.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">A9. Reviews & Ratings</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Kainook operates a review and rating system to maintain quality standards on the
							Platform. Guests are encouraged to leave honest, factual reviews following a completed
							Travel Service.
						</p>
						<ul class="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
							<li>Reviews must be based on a genuine, completed booking experience.</li>
							<li>Reviews must not contain defamatory, offensive, or fraudulent content.</li>
							<li>Kainook reserves the right to remove reviews that violate these standards.</li>
						</ul>
						<p class="text-sm leading-relaxed text-slate-600">
							<strong>Provider Listing Status:</strong> Provider listings may be automatically suspended
							following two consecutive reviews rated 1–2 stars. Providers will be notified and may appeal
							through the Provider dashboard. This mechanism exists to protect Guests and maintain platform
							quality.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">
							A10. In-App Messaging & Communication
						</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Kainook provides an in-app messaging system to facilitate communication between Guests
							and Providers. To protect the integrity of the marketplace:
						</p>
						<ul class="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
							<li>All communications must remain within the Platform's messaging system.</li>
							<li>
								The Platform automatically filters messages containing personal contact details
								(phone numbers, email addresses, social media handles) to prevent off-platform
								transactions.
							</li>
							<li>
								Attempts to solicit or share contact details to arrange direct bookings outside the
								Platform constitute a violation of these Terms.
							</li>
						</ul>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">A11. Personal Data & Privacy</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Kainook processes your personal data in accordance with applicable data protection
							law, including the General Data Protection Regulation (GDPR) where applicable. Data
							collected through your use of the Platform is used only for purposes described in our
							Privacy Policy, available on the Platform.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							You have the right to access, rectify, delete, restrict processing of, and object to
							the processing of your personal data. Please contact us via the details in the legal
							notices section of the Platform to exercise these rights.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">A12. Intellectual Property</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Unless otherwise indicated, all intellectual property rights in the content,
							information, and materials available on the Platform (including copyright, trademarks,
							logos, and databases) are the exclusive property of Kainook Travel OÜ, its affiliates,
							or the relevant Providers.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							Any reproduction, extraction, publication, commercialisation, or use of Platform
							content for purposes other than strictly personal use is strictly prohibited without
							prior written authorisation from Kainook.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							By uploading or publishing visual content (photographs, images, videos) to the
							Platform, you grant Kainook a worldwide, royalty-free, non-exclusive, transferable
							licence to reproduce, adapt, distribute, publish, and use such content in connection
							with the operation and promotion of the Platform. You warrant that you hold all
							necessary rights over uploaded content and that its publication does not infringe any
							third-party rights.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">A13. Limitation of Liability</h3>
						<div
							class="rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs leading-relaxed text-slate-600"
						>
							<strong>Kainook's Liability is Limited to its Role as a Platform:</strong> Kainook is a
							technology intermediary. The following limitations reflect that role.
						</div>
						<p class="text-sm text-slate-600">
							To the fullest extent permitted by applicable law, Kainook excludes liability for:
						</p>
						<ul class="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
							<li>
								The quality, safety, accuracy, or fitness for purpose of any Travel Service provided
								by a Provider.
							</li>
							<li>
								Any personal injury, property damage, or other loss suffered in connection with a
								Travel Service.
							</li>
							<li>
								Inaccuracies in Provider listing information (pricing, availability, descriptions,
								photos).
							</li>
							<li>Any failure, cancellation, or modification of a Travel Service by a Provider.</li>
							<li>
								Indirect, consequential, punitive, or special damages, or loss of revenue or
								reputation.
							</li>
							<li>
								Inability to access or use the Platform due to technical issues, maintenance, or
								circumstances beyond Kainook's control.
							</li>
						</ul>
						<p class="text-sm leading-relaxed text-slate-600">
							Where Kainook is found directly liable to a Guest, liability is limited to the total
							amount paid by the Guest for the Booking in question.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							This limitation does not apply in cases of Kainook's gross negligence or wilful
							misconduct, or where applicable law prohibits such limitation.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">A14. Complaints & Dispute Resolution</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							For any query or complaint, please contact Kainook's support team through your Booking
							on the Platform, via the mobile app, or through our help centre.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							We are committed to responding within a reasonable timeframe. Complaints must be
							submitted as promptly as possible following the event giving rise to the complaint.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							Kainook will first seek to resolve any dispute amicably. If no resolution is reached
							within thirty (30) days, you may pursue the matter through applicable consumer dispute
							resolution mechanisms or competent courts.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">A15. Governing Law & Jurisdiction</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							These Terms are governed by and construed in accordance with the laws of Estonia. Any
							disputes arising out of or in connection with these Terms or the Platform shall be
							subject to the exclusive jurisdiction of the courts of Tallinn, Estonia, unless
							mandatory local consumer protection law provides otherwise.
						</p>
					</div>
				</section>

				<hr class="border-slate-100" />

				<!-- Section B -->
				<section id="section-b" class="scroll-mt-20 space-y-6">
					<div class="space-y-1">
						<span class="text-[10px] font-bold tracking-wider text-[#1D8D2B] uppercase"
							>Section B</span
						>
						<h2 class="font-serif text-2xl font-bold text-slate-900">
							Accommodation (Hotels & Apartments)
						</h2>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">B1. Scope</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							This section applies exclusively to Bookings of accommodation services (hotels and
							apartments) made through the Platform.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">B2. The Booking Relationship</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							When you make an accommodation booking, you enter into a direct contract with the
							Provider (the hotel or apartment owner/operator). Kainook is not a party to that
							contract.
						</p>
						<h4 class="mt-4 text-sm font-bold text-slate-900">
							Who is responsible for what — Accommodation
						</h4>
						<div class="mt-2 overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
							<table class="w-full border-collapse text-left text-xs">
								<thead>
									<tr class="bg-[#1D8D2B] text-white">
										<th class="w-1/2 border-r border-white/20 p-3 font-semibold"
											>PROVIDER RESPONSIBILITIES</th
										>
										<th class="w-1/2 p-3 font-semibold">GUEST RESPONSIBILITIES</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100 text-slate-600">
									{#each accommodationRows as row (row[0])}
										<tr class="divide-x divide-slate-100 hover:bg-slate-50">
											<td class="p-3">{row[0]}</td>
											<td class="p-3">{row[1]}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">
							B3. Kainook's Role in Accommodation Bookings
						</h3>
						<p class="text-sm text-slate-600">Kainook's role is limited to:</p>
						<ul class="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
							<li>Providing the Platform on which Providers list and manage their properties.</li>
							<li>Transmitting booking confirmation details to both Guest and Provider.</li>
							<li>Processing payment where the Guest pays via the Platform.</li>
							<li>
								Facilitating communication between Guest and Provider through in-app messaging.
							</li>
						</ul>
						<p class="text-sm leading-relaxed text-slate-600">
							Kainook does not inspect, certify, or guarantee accommodation quality. Star ratings
							assigned to hotels are based on information provided by Providers and verified by
							Kainook's administration team; they are indicative only.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">
							B4. Check-In, Check-Out & House Rules
						</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Check-in and check-out times are set by the Provider and displayed on the property
							listing. Guests must respect these times.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							If you anticipate a late arrival, you must notify the Provider directly through the
							in-app messaging system. Providers reserve the right to cancel a booking if a Guest
							fails to check in without notification (no-show policy).
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							Guests are bound by the house rules of each property as communicated at booking and on
							arrival.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">B5. Deposits & Security Bonds</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Providers may require a security deposit upon check-in. The amount and conditions for
							return are specified on the property listing. Kainook has no control over security
							deposit amounts or dispute resolution between the Provider and Guest regarding
							deposits.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">
							B6. Cancellations & No-Show — Accommodation
						</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Each Provider sets their own cancellation policy. The applicable policy is displayed
							on the property listing and during the booking process.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							In the event of a no-show without prior cancellation, the Provider may charge fees up
							to the full booking value in accordance with their policy.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							Modification requests (change of dates, number of guests) must be submitted via the
							Platform and are subject to Provider approval and applicable charges.
						</p>
					</div>
				</section>

				<hr class="border-slate-100" />

				<!-- Section C -->
				<section id="section-c" class="scroll-mt-20 space-y-6">
					<div class="space-y-1">
						<span class="text-[10px] font-bold tracking-wider text-[#1D8D2B] uppercase"
							>Section C</span
						>
						<h2 class="font-serif text-2xl font-bold text-slate-900">Car Rental</h2>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">C1. Scope</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							This section applies exclusively to Bookings of vehicle rental services made through
							the Platform.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">C2. The Booking Relationship</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							When you reserve a vehicle, you enter into a direct contract with the rental company
							(the "Provider"). Kainook acts solely as a booking intermediary. The detailed rental
							contract will be provided by the Provider at the time of vehicle collection; you are
							advised to read it carefully before signing.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">
							C3. Who is Responsible for What — Car Rental
						</h3>
						<div class="mt-2 overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
							<table class="w-full border-collapse text-left text-xs">
								<thead>
									<tr class="bg-[#1D8D2B] text-white">
										<th class="w-1/2 border-r border-white/20 p-3 font-semibold"
											>PROVIDER RESPONSIBILITIES</th
										>
										<th class="w-1/2 p-3 font-semibold">GUEST RESPONSIBILITIES</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100 text-slate-600">
									{#each carRentalRows as row (row[0])}
										<tr class="divide-x divide-slate-100 hover:bg-slate-50">
											<td class="p-3">{row[0]}</td>
											<td class="p-3">{row[1]}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">C4. Guest Obligations — Car Rental</h3>
						<p class="text-sm text-slate-600">
							Guests bear full responsibility for the vehicle during the rental period. This
							includes:
						</p>
						<ul class="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
							<li>All damage, loss, or theft not covered by the Provider's insurance.</li>
							<li>
								Traffic fines, toll charges, and parking penalties incurred during the rental.
							</li>
							<li>Fuel costs where not included in the rental price.</li>
							<li>
								Additional charges for late return or returning to a different location than agreed.
							</li>
						</ul>
						<p class="text-sm leading-relaxed text-slate-600">
							Kainook is not responsible for any costs, damages, or disputes arising between the
							Guest and the Provider following vehicle collection.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">C5. Security Deposit — Car Rental</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							A security deposit is typically held on the Guest's credit card at the time of vehicle
							collection. The amount and conditions for release are set by the Provider and
							specified on the listing. Kainook has no role in managing this deposit.
						</p>
					</div>
				</section>

				<hr class="border-slate-100" />

				<!-- Section D -->
				<section id="section-d" class="scroll-mt-20 space-y-6">
					<div class="space-y-1">
						<span class="text-[10px] font-bold tracking-wider text-[#1D8D2B] uppercase"
							>Section D</span
						>
						<h2 class="font-serif text-2xl font-bold text-slate-900">Activities & Tours</h2>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">D1. Scope</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							This section applies exclusively to Bookings of activities, guided tours, excursions,
							and similar experiences made through the Platform.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">D2. The Booking Relationship</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							When you book an activity or tour, you enter into a direct contract with the Provider
							who organises and delivers the experience. Kainook acts solely as an intermediary and
							has no involvement in the organisation or execution of the activity.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">
							D3. Who is Responsible for What — Activities & Tours
						</h3>
						<div class="mt-2 overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
							<table class="w-full border-collapse text-left text-xs">
								<thead>
									<tr class="bg-[#1D8D2B] text-white">
										<th class="w-1/2 border-r border-white/20 p-3 font-semibold"
											>PROVIDER RESPONSIBILITIES</th
										>
										<th class="w-1/2 p-3 font-semibold">GUEST RESPONSIBILITIES</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100 text-slate-600">
									{#each activityRows as row (row[0])}
										<tr class="divide-x divide-slate-100 hover:bg-slate-50">
											<td class="p-3">{row[0]}</td>
											<td class="p-3">{row[1]}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">D4. Safety & Participation</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Some activities involve inherent risks or physical demands. Guests are responsible for
							assessing their own fitness and suitability before booking. Where a Provider requires
							a liability waiver, signing it is a condition of participation.
						</p>
						<p class="text-sm leading-relaxed text-slate-600">
							Kainook strongly encourages Guests to obtain appropriate travel insurance covering
							adventure activities, medical emergencies, and cancellations before making activity
							bookings.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-base font-bold text-slate-900">
							D5. Cancellations — Activities & Tours
						</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Cancellation policies vary by activity and Provider. The applicable policy is
							displayed clearly before booking confirmation. Late arrivals or no-shows may forfeit
							the booking amount without refund, at the Provider's discretion.
						</p>
					</div>
				</section>

				<hr class="border-slate-100" />

				<!-- Final Provisions -->
				<section id="final" class="scroll-mt-20 space-y-4">
					<h2 class="border-l-4 border-[#1D8D2B] pl-3 font-serif text-xl font-bold text-slate-900">
						Final Provisions
					</h2>
					<div class="space-y-3">
						<h3 class="text-sm font-bold text-slate-900">Modifications to These Terms</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Kainook reserves the right to amend these Terms at any time. Material changes will be
							notified to registered users via email or in-app notification. Continued use of the
							Platform following notification constitutes acceptance of the revised Terms.
						</p>
					</div>
					<div class="space-y-3">
						<h3 class="text-sm font-bold text-slate-900">Force Majeure</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							Neither Kainook nor any Provider shall be liable for failure or delay in performance
							resulting from events beyond their reasonable control, including natural disasters,
							strikes, government restrictions, epidemics, or other force majeure events.
						</p>
					</div>
					<div class="space-y-3">
						<h3 class="text-sm font-bold text-slate-900">Entire Agreement</h3>
						<p class="text-sm leading-relaxed text-slate-600">
							These Terms, together with Kainook's Privacy Policy and any applicable
							Provider-specific conditions, constitute the entire agreement between you and Kainook
							regarding your use of the Platform, and supersede all prior agreements.
						</p>
					</div>
					<div
						class="space-y-1.5 border-t border-slate-100 pt-6 text-center text-xs text-slate-400"
					>
						<p class="font-semibold text-slate-600">— End of Kainook Travel Terms of Use —</p>
						<p>Last Updated: June 2026</p>
						<p>Kainook Travel OÜ · Tallinn, Estonia · www.kainook.com</p>
					</div>
				</section>
			</article>
		</div>
	</main>
</div>
