<script lang="ts">
	interface FAQItem {
		q: string;
		a: string;
	}

	interface FAQCategory {
		id: string;
		title: string;
		description: string;
		icon: string;
		items: FAQItem[];
	}

	const CATEGORY_ICONS = {
		about:
			'M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z',
		guests:
			'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
		providers:
			'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z',
		platform:
			'M10.343 14.242L9.88 16.9a.75.75 0 01-1.4.305l-1.05-2.1a.75.75 0 01-.105-.355v-.865a.75.75 0 00-.22-.53L5.75 11.7a.75.75 0 010-1.06l1.355-1.355a.75.75 0 01.53-.22h.865a.75.75 0 00.355-.105l2.1-1.05a.75.75 0 011.4.305l.462 2.658M18.5 8.25l.555-3.075a.75.75 0 011.4-.305l1.05 2.1a.75.75 0 01.105.355v.865a.75.75 0 00.22.53l1.32 1.32a.75.75 0 010 1.06l-1.355 1.355a.75.75 0 01-.53.22h-.865a.75.75 0 00-.355.105l-2.1 1.05a.75.75 0 01-1.4-.305l-.462-2.658M20.25 3.75v.01M20.25 12.75v.01M6 2.25v.01M6 21.75v.01M21.75 6h.01M21.75 18h.01'
	} as const;

	const faqData: FAQCategory[] = [
		{
			id: 'about',
			title: 'About Kainook',
			description: 'General questions about who we are and what we offer.',
			icon: CATEGORY_ICONS.about,
			items: [
				{
					q: 'What is Kainook?',
					a: 'Kainook is an online travel marketplace connecting travellers with hotels, apartments, and car rental providers across Africa and internationally. Think of us as a platform — like Booking.com or Airbnb — focused on Africa, built for both African travellers and the global diaspora.'
				},
				{
					q: 'Who owns and operates Kainook?',
					a: 'Kainook is operated by Kainook Travel OÜ, a private limited company registered in Tallinn, Estonia. Our platform serves travellers and providers across Africa and beyond.'
				},
				{
					q: 'Is Kainook a travel agency?',
					a: 'No. Kainook is a technology marketplace, not a travel agency. We do not own or operate any hotel, apartment, or car rental fleet. All travel services are provided by independent Providers listed on the Platform. When you book through Kainook, your contract is directly with the Provider.'
				},
				{
					q: 'What countries does Kainook cover?',
					a: 'Kainook is focused on destinations across Africa and is open to travellers worldwide, including the African diaspora and international visitors. Coverage is expanding continuously — check the Platform for current destination availability.'
				},
				{
					q: 'In what languages is the Platform available?',
					a: 'The Platform is currently available in English and French. Additional languages may be added as we expand.'
				},
				{
					q: 'What currencies are supported?',
					a: 'Kainook supports multiple currencies. Prices are displayed in the currency selected in your account settings or detected from your location. Payment is processed in the currency shown at checkout.'
				}
			]
		},
		{
			id: 'guests',
			title: 'For Guests',
			description: 'Bookings, payments, and account assistance for travellers.',
			icon: CATEGORY_ICONS.guests,
			items: [
				{
					q: 'How do I create a Kainook account?',
					a: 'Download the Kainook app (iOS or Android) or visit www.kainook.com. Tap "Sign Up", enter your name, email address, and a password, then verify your email. You can also sign up using your Google, Apple, or Facebook account.'
				},
				{
					q: 'Can I use Kainook without creating an account?',
					a: 'You can browse listings without an account, but you must be registered and logged in to make a booking.'
				},
				{
					q: 'I forgot my password. What should I do?',
					a: 'On the login screen, tap "Forgot Password?" and enter your registered email address. You will receive a password reset link within a few minutes. Check your spam folder if you do not see it in your inbox.'
				},
				{
					q: 'How do I update my personal details?',
					a: 'Go to Account Settings in the app or website, select "Personal Information", and update your details. Changes are saved immediately.'
				},
				{
					q: 'How do I delete my account?',
					a: 'Go to Account Settings → Privacy → Delete My Account. Note that you must cancel all active bookings before your account can be deleted. Certain data (transaction records, fraud logs) is retained as required by law. See our Privacy Policy for full details. Account deletion is irreversible. Your AfriPoints balance will be forfeited upon deletion.'
				},
				{
					q: 'How do I search for accommodation or a car?',
					a: 'On the home screen, select your category (Hotels, Apartments, or Car Rental), enter your destination and travel dates, and tap Search. Use the filters to refine by price, star rating, amenities, and more.'
				},
				{
					q: 'How do I make a booking?',
					a: 'Select your preferred listing, review the details and policies, choose your room or vehicle type, and tap "Book Now". Follow the steps to enter guest details and complete payment. You will receive a booking confirmation by email and in-app notification.'
				},
				{
					q: 'Is my booking confirmed immediately?',
					a: 'For most listings, your booking is confirmed instantly upon payment. Some properties operate on a "Request to Book" basis — in this case you will be notified within 24 hours whether the Provider has accepted your request.'
				},
				{
					q: 'Can I book for someone else?',
					a: "Yes. During checkout, you can enter the name and details of the primary guest if different from the account holder. Ensure the details match the guest's ID as it may be checked at check-in."
				},
				{
					q: 'What is the booking reference number?',
					a: 'Every confirmed booking is assigned a unique reference in the format KAIN-XXXX-CC (where CC is the two-letter country code). Use this reference for all correspondence with Kainook support or the Provider.'
				},
				{
					q: 'How far in advance can I book?',
					a: 'Booking windows vary by Provider. Most listings allow bookings up to 12 months in advance. Check the individual listing for availability.'
				},
				{
					q: 'What payment methods does Kainook accept?',
					a: 'Kainook supports two payment methods: international card payments (Visa, Mastercard and others) processed via Stripe, and African mobile money payments processed via Tara. Available options are displayed at checkout depending on your location.'
				},
				{
					q: 'When is my payment charged?',
					a: 'For prepaid bookings, your card or mobile money account is charged immediately upon booking confirmation. For "pay at property" bookings, payment is collected by the Provider at check-in as specified in the listing.'
				},
				{
					q: 'When does the Provider receive my payment?',
					a: 'Where Kainook collects payment on behalf of the Provider, the funds are transferred to the Provider within 24 hours of your check-in. This protects you — payment is only settled once you have physically taken possession of the service.'
				},
				{
					q: 'Is my payment secure?',
					a: 'Yes. Card payments are processed by Stripe, a PCI DSS Level 1 certified payment provider. Mobile money payments are handled by Tara. Kainook never stores your full card number on our servers.'
				},
				{
					q: 'I was charged but did not receive a confirmation. What do I do?',
					a: 'Contact Kainook support immediately at info@kainook.com or through the Help section in the app. Include your payment reference and the date of the transaction. We will investigate and resolve within 2 business days.'
				},
				{
					q: 'Can I pay in instalments?',
					a: 'Instalment payments are not currently supported on Kainook. Full payment is required at checkout for prepaid bookings.'
				},
				{
					q: 'How do I cancel a booking?',
					a: 'Go to My Bookings in the app or website, select the booking you wish to cancel, and tap "Cancel Booking". You will see the applicable refund amount before confirming the cancellation.'
				},
				{
					q: 'What is the cancellation policy?',
					a: 'Each Provider sets their own cancellation policy. The full policy is displayed on the listing page and during checkout before you confirm your booking. Policies range from fully flexible (free cancellation up to 24 hours before arrival) to non-refundable. Always review this before booking.'
				},
				{
					q: 'How long does a refund take?',
					a: "Once a cancellation is confirmed, Kainook processes the refund within 5 business days. The time for the credit to appear in your account depends on your bank or mobile money provider, which is outside Kainook's control."
				},
				{
					q: 'What happens if I do not show up (no-show)?',
					a: 'If you fail to check in without cancelling in advance, the Provider may charge a no-show fee up to the full booking amount in accordance with their policy. Kainook strongly recommends contacting the Provider through in-app messaging if you are delayed or unable to arrive.'
				},
				{
					q: 'Can I modify my booking dates?',
					a: 'Modification requests (change of dates, number of guests) are subject to Provider approval and may incur additional charges. Submit modification requests via the Platform through My Bookings. Modifications are not guaranteed and depend on availability.'
				},
				{
					q: 'What if the Provider cancels my booking?',
					a: 'If a Provider cancels a confirmed booking, you are entitled to a full refund of all amounts paid. Kainook will also assist you in finding alternative accommodation where possible. Contact support at info@kainook.com.'
				},
				{
					q: 'What if the service I received was significantly different from what was advertised?',
					a: 'If the Travel Service was materially different from the listing description (e.g., wrong room type, missing advertised amenities, uninhabitable condition), contact Kainook support with photographic evidence within 24 hours of check-in. We will investigate and, if your claim is substantiated, issue a full or partial refund and take action against the Provider. Document issues with photos and timestamps as soon as you notice them.'
				},
				{
					q: 'What do I need at check-in?',
					a: 'Present your booking confirmation (email or in-app voucher) and a valid photo ID. Some properties may also require the payment card used for the booking. Check the listing for any specific check-in requirements.'
				},
				{
					q: 'What are the check-in and check-out times?',
					a: 'Check-in and check-out times are set by each Provider and displayed on the listing. If you need early check-in or late check-out, contact the Provider through in-app messaging in advance to check availability (additional charges may apply).'
				},
				{
					q: 'Can I contact the Provider before arrival?',
					a: 'Yes. Once your booking is confirmed, use the in-app messaging system to communicate directly with the Provider. For security and marketplace integrity, please keep all communications within the Platform — do not share personal contact details. Sharing phone numbers or email addresses in messages to bypass the Platform is a violation of our Terms of Use.'
				},
				{
					q: 'What if I arrive late?',
					a: 'Notify the Provider via in-app messaging as early as possible. Failure to notify may result in a no-show cancellation by the Provider. Most Providers are accommodating when given advance notice.'
				},
				{
					q: 'How do I leave a review?',
					a: 'After your stay or rental period ends, you will receive an in-app prompt to rate your experience. Tap the notification or go to My Bookings and select the completed booking to submit your review. Reviews can be submitted up to 14 days after check-out.'
				},
				{
					q: 'Can a Provider remove my review?',
					a: 'No. Providers cannot remove or edit guest reviews. Kainook may remove reviews that violate our content guidelines (e.g., offensive language, fake reviews, content unrelated to the booking experience). Genuine, factual reviews — even negative ones — are protected.'
				},
				{
					q: 'What are AfriPoints?',
					a: "AfriPoints is Kainook's loyalty rewards programme. You earn points on qualifying bookings, which can be redeemed for discounts on future bookings. The programme has four tiers: Bronze, Silver, Gold, and Diamond — each unlocking additional benefits."
				},
				{
					q: 'How do I check my AfriPoints balance?',
					a: 'Go to Account → AfriPoints in the app or website to view your current balance, tier status, and transaction history.'
				},
				{
					q: 'Do AfriPoints expire?',
					a: 'AfriPoints that remain inactive (no qualifying booking) for 12 consecutive months will expire. Points are also forfeited if you delete your account. Check the AfriPoints programme terms in the app for full details.'
				}
			]
		},
		{
			id: 'providers',
			title: 'For Providers',
			description: 'Onboarding, listing management, payouts, and client relations.',
			icon: CATEGORY_ICONS.providers,
			items: [
				{
					q: 'Who can list on Kainook?',
					a: 'Any business or individual operating a hotel, apartment/residence, or vehicle rental service in a Kainook-supported market can list after creating a Kainook account. You must hold all required local licences, permits, and insurance for your business category.'
				},
				{
					q: 'How do I register as a Provider?',
					a: 'Sign up for a Kainook account and open your Provider Dashboard at www.kainook.com/dashboard. There is no approval process — you can create listings immediately. Add your business details to complete your profile, then start listing properties.'
				},
				{
					q: 'Is there a fee to list on Kainook?',
					a: 'Listing on Kainook is free. Kainook charges a commission on confirmed bookings. Commission rates vary by market and are clearly communicated during onboarding and displayed in your Provider Dashboard.'
				},
				{
					q: 'How are hotels approved vs apartments and car rentals?',
					a: "Hotel listings go through a star rating and quality review by Kainook's administration team before going live. Apartment and car rental listings are activated automatically, subject to ongoing quality monitoring."
				},
				{
					q: 'What documents do I need to submit?',
					a: 'Requirements vary by category. Generally: business registration certificate, proof of address, valid operating licence, insurance documents, and bank account details for payouts. Full requirements are listed in the listing creation flow.'
				},
				{
					q: 'How do I update my listing (prices, photos, description)?',
					a: 'Log in to your Provider Dashboard at www.kainook.com/dashboard or through the app. Go to My Listings, select the listing you wish to edit, and make your changes. Updates to descriptions and photos are reflected on the Platform within a few hours.'
				},
				{
					q: 'How do I manage availability?',
					a: 'Use the Availability Calendar in your Provider Dashboard to block dates, set minimum stays, and manage inventory. You can also sync your availability with Airbnb and Booking.com via iCal — set up the sync under Settings → Channel Manager. Availability syncs every 15 minutes.'
				},
				{
					q: 'What is the iCal channel manager sync?',
					a: 'The iCal sync allows your Kainook calendar to stay in sync with other platforms (Airbnb, Booking.com) to prevent double bookings. Availability updates are polled every 15 minutes. Set it up in your Dashboard under Settings → Channel Manager.'
				},
				{
					q: 'A Guest has just requested a booking. How long do I have to respond?',
					a: 'For Request-to-Book listings, you have 24 hours to accept or decline. If you do not respond within 24 hours, the request expires automatically and the Guest is not charged. We recommend keeping your availability calendar up to date to minimise declined requests.'
				},
				{
					q: 'Can I set different prices for different dates or seasons?',
					a: 'Yes. Use the Pricing section of your Dashboard to set date-specific rates, seasonal pricing, weekend rates, and length-of-stay discounts. Your rates can be updated at any time.'
				},
				{
					q: 'Can I set my own cancellation policy?',
					a: "Yes. You can select from Kainook's standard cancellation policy templates (Flexible, Moderate, Strict, Non-Refundable) or configure a custom policy. Your policy is displayed to Guests on your listing and during checkout."
				},
				{
					q: 'How am I notified of a new booking?',
					a: 'You will receive an instant push notification in the app, an email to your registered address, and a notification in your Provider Dashboard whenever a new booking is confirmed or a new request is received.'
				},
				{
					q: 'How do I communicate with Guests?',
					a: 'Use the in-app messaging system accessible from your Dashboard or the booking details screen. All Guest–Provider communication must remain within the Platform. Do not share personal contact details through the messaging system.'
				},
				{
					q: 'A Guest did not show up. What should I do?',
					a: 'Mark the booking as a No-Show in your Dashboard within 2 hours of the scheduled check-in time. This triggers the no-show policy and, if applicable, allows you to retain the applicable fee per your cancellation policy. Contact support if you need assistance.'
				},
				{
					q: 'Can I cancel a confirmed Guest booking?',
					a: 'Provider-initiated cancellations are strongly discouraged and may result in penalties, reduced listing visibility, or suspension. If you must cancel due to exceptional circumstances (force majeure, property damage), contact Kainook support immediately at info@kainook.com. The Guest will receive a full refund.'
				},
				{
					q: 'When do I receive payment for a booking?',
					a: 'Where payment is collected by Kainook, funds are transferred to your Provider account within 24 hours of Guest check-in. This applies to all prepaid bookings processed through the Platform.'
				},
				{
					q: 'How are payouts processed?',
					a: 'Payouts are made to your registered bank account or mobile money account. You can view your payout schedule and history in your Provider Dashboard under Financials → Payouts.'
				},
				{
					q: 'What commission does Kainook charge?',
					a: "Kainook charges a commission on each confirmed booking. Your specific commission rate is shown in your Provider Dashboard under Financials and was agreed during onboarding. Kainook reserves the right to adjust commission rates with 30 days' notice."
				},
				{
					q: 'What happens to the payment if a Guest cancels?',
					a: 'Refunds to Guests are determined by your cancellation policy. If a Guest cancels within your free cancellation window, any collected funds are refunded to the Guest. If they cancel outside the window, the applicable fee is retained and paid out to you per your policy.'
				},
				{
					q: 'How do I update my payout bank account details?',
					a: 'Go to Dashboard → Settings → Payout Details to update your bank account or mobile money information. For security, changes to payout details require identity re-verification and take 48 hours to activate.'
				},
				{
					q: 'How does the review system work?',
					a: 'After each completed stay or rental, Guests are invited to rate their experience from 1 to 5 stars and leave a written review. Your overall rating is the average of all verified reviews and is displayed prominently on your listing.'
				},
				{
					q: 'Can I respond to Guest reviews?',
					a: 'Yes. You can post a public response to any Guest review from your Dashboard. Responding professionally to all reviews — especially negative ones — demonstrates good service and builds trust with future Guests.'
				},
				{
					q: 'What happens if I receive consistently poor reviews?',
					a: 'Listings that receive two consecutive reviews rated 1–2 stars may be automatically suspended pending review. You will be notified immediately and given the opportunity to respond and appeal. Kainook may investigate and work with you to address the issues. Maintaining accurate listings and communicating proactively with Guests is the best way to avoid poor reviews.'
				},
				{
					q: 'Can I report a fraudulent or unfair review?',
					a: "Yes. If you believe a review is fake, malicious, or violates Kainook's content guidelines, flag it through your Dashboard. Our moderation team will investigate and remove reviews that do not meet our standards."
				}
			]
		},
		{
			id: 'platform',
			title: 'General & Technical',
			description: 'Platform security, privacy, and technical troubleshooting.',
			icon: CATEGORY_ICONS.platform,
			items: [
				{
					q: 'How does Kainook verify Providers?',
					a: 'All Providers must submit business registration documents, licences, and insurance before listing. Hotel listings also undergo a star rating and quality review before going live. Kainook monitors Provider performance through Guest reviews, complaint reports, and periodic audits.'
				},
				{
					q: 'Is it safe to pay through Kainook?',
					a: 'Yes. All payments are processed by PCI DSS-certified processors (Stripe for cards, Tara for mobile money). Kainook never stores your full card number. Additionally, Kainook holds payment and only transfers funds to the Provider 24 hours after check-in, giving you an added layer of protection.'
				},
				{
					q: 'What should I do if I suspect fraud on the Platform?',
					a: 'Contact Kainook immediately at info@kainook.com with full details. Do not proceed with any payment outside the Platform. Kainook will investigate all fraud reports promptly.'
				},
				{
					q: 'Why can I not share my phone number or email in messages?',
					a: "The in-app messaging system automatically filters personal contact details to protect both Guests and Providers. This ensures all transactions are processed through the Platform, which provides payment protection, booking guarantees, and dispute resolution for both parties. Off-platform bookings are not covered by Kainook's policies."
				},
				{
					q: 'The app is not working. What should I do?',
					a: 'First, try closing and reopening the app. Ensure you have the latest version installed (check your App Store or Google Play Store for updates). If the problem persists, try uninstalling and reinstalling the app. If the issue continues, contact us at info@kainook.com with a description of the problem and your device type.'
				},
				{
					q: 'I am not receiving email notifications. What should I do?',
					a: 'Check your spam or junk mail folder and add noreply@kainook.com to your safe senders list. Also ensure notification permissions are enabled in your device settings for the Kainook app. Verify your email address is correct in Account Settings.'
				},
				{
					q: 'How do I report a bug or technical issue?',
					a: 'Go to Help → Report a Problem in the app, or email info@kainook.com with a description of the issue, the steps to reproduce it, your device type, and a screenshot if available. We take all bug reports seriously and aim to resolve critical issues within 48 hours.'
				},
				{
					q: 'Is Kainook available as a web app as well as mobile?',
					a: 'Yes. Kainook is accessible via the mobile app (iOS and Android) and as a Progressive Web App (PWA) at www.kainook.com, which can be added to your home screen for an app-like experience on any device.'
				},
				{
					q: 'How does Kainook use my personal data?',
					a: 'We use your data to operate the Platform, process bookings, manage payments, personalise your experience, and comply with legal obligations. We never sell your data. See our full Privacy Policy at kainook.com/legal/privacy for complete details.'
				},
				{
					q: 'How do I request a copy of my data?',
					a: 'Email info@kainook.com with the subject line "Data Access Request". We will provide a copy of all personal data held about you within 30 days, free of charge.'
				},
				{
					q: 'How do I opt out of marketing emails?',
					a: 'Click "Unsubscribe" at the bottom of any marketing email, or go to Account Settings → Notifications → Marketing Preferences and toggle off marketing communications. Transactional emails (booking confirmations, receipts) cannot be disabled as they are necessary for the service.'
				},
				{
					q: 'Does Kainook use cookies?',
					a: 'Yes. We use strictly necessary cookies (required for the Platform to function), as well as optional functional, analytics, and marketing cookies with your consent. Manage your preferences at any time via the Cookie Settings link in the footer. See our Privacy Policy for full details.'
				},
				{
					q: 'Where can I find the Terms of Use and Privacy Policy?',
					a: 'Both documents are available on the Platform at kainook.com/legal/terms and kainook.com/legal/privacy. They are also accessible from the footer of every page and in the app under Settings → Legal.'
				},
				{
					q: 'Which law governs Kainook?',
					a: 'Kainook Travel OÜ is governed by Estonian law and operates in compliance with the EU General Data Protection Regulation (GDPR). Disputes are subject to the jurisdiction of the courts of Tallinn, Estonia, unless mandatory local consumer protection law provides otherwise.'
				},
				{
					q: 'How do I make a formal complaint?',
					a: 'Submit your complaint in writing to info@kainook.com with your booking reference, a description of the issue, and supporting evidence (photos, screenshots). We acknowledge all complaints within 48 hours and aim to resolve them within 14 days.'
				}
			]
		}
	];

	let searchQuery = $state('');
	let activeCategory = $state('all');
	let openItems = $state<Record<string, boolean>>({});

	const filteredData = $derived.by(() => {
		let result = faqData;
		if (activeCategory !== 'all') {
			result = result.filter((cat) => cat.id === activeCategory);
		}
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result
				.map((cat) => ({
					...cat,
					items: cat.items.filter(
						(item) => item.q.toLowerCase().includes(query) || item.a.toLowerCase().includes(query)
					)
				}))
				.filter((cat) => cat.items.length > 0);
		}
		return result;
	});

	function toggleItem(q: string): void {
		openItems = { ...openItems, [q]: !openItems[q] };
	}
</script>

<svelte:head>
	<title>Help & FAQ — Kainook</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 font-sans text-slate-800">
	<!-- Hero Search -->
	<section class="bg-gradient-to-b from-[#0c2614] to-[#081b0d] px-4 py-12 text-center text-white">
		<div class="mx-auto max-w-3xl space-y-4">
			<span class="text-[10px] font-bold tracking-[0.3em] text-[#58B430] uppercase"
				>Support Centre</span
			>
			<h1 class="font-serif text-3xl font-bold tracking-tight md:text-5xl">How can we help you?</h1>
			<p class="mx-auto max-w-xl text-sm text-white/70 md:text-base">
				Find answers to common questions about bookings, payments, listing properties, and platform
				guidelines.
			</p>
			<div class="relative mx-auto mt-6 max-w-lg">
				<svg
					class="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
					/>
				</svg>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search questions, keywords, or topics..."
					class="w-full rounded-2xl border-none bg-white py-3 pr-4 pl-12 text-slate-900 shadow-lg transition focus:ring-2 focus:ring-[#1D8D2B] focus:ring-offset-2 focus:outline-none"
				/>
			</div>
		</div>
	</section>

	<!-- Main FAQ Area -->
	<main class="mx-auto max-w-6xl px-4 py-8">
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-4">
			<!-- Category Tabs -->
			<aside class="h-fit space-y-2 lg:sticky lg:top-24 lg:col-span-1">
				<h3 class="mb-2 px-3 text-xs font-bold tracking-wider text-slate-400 uppercase">
					Categories
				</h3>
				<button
					type="button"
					onclick={() => (activeCategory = 'all')}
					class={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
						activeCategory === 'all'
							? 'bg-[#0c2614] text-white shadow-md'
							: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
					}`}
				>
					<span class="flex items-center gap-2">
						<svg
							class="h-4 w-4"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
							/>
						</svg>
						All Questions
					</span>
				</button>
				{#each faqData as cat (cat.id)}
					<button
						type="button"
						onclick={() => (activeCategory = cat.id)}
						class={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
							activeCategory === cat.id
								? 'bg-[#0c2614] text-white shadow-md'
								: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
						}`}
					>
						<span class="flex items-center gap-2">
							<svg
								class="h-4 w-4"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								viewBox="0 0 24 24"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d={cat.icon} />
							</svg>
							{cat.title}
						</span>
						<span
							class={`rounded-full px-1.5 py-0.5 text-[10px] ${
								activeCategory === cat.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
							}`}
						>
							{cat.items.length}
						</span>
					</button>
				{/each}
			</aside>

			<!-- FAQ Accordions -->
			<section class="space-y-8 lg:col-span-3">
				{#if filteredData.length === 0}
					<div
						class="space-y-3 rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-sm"
					>
						<div
							class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"
						>
							<svg
								class="h-6 w-6"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
								/>
							</svg>
						</div>
						<h3 class="font-bold text-slate-800">No results found</h3>
						<p class="mx-auto max-w-sm text-sm text-slate-500">
							We couldn't find any FAQs matching "{searchQuery}". Please try a different term or
							search query.
						</p>
					</div>
				{:else}
					{#each filteredData as cat (cat.id)}
						<div
							class="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] md:p-8"
						>
							<div>
								<h2 class="font-serif text-xl font-bold text-slate-900">{cat.title}</h2>
								<p class="mt-0.5 text-xs text-slate-400">{cat.description}</p>
							</div>
							<div class="divide-y divide-slate-100">
								{#each cat.items as item (item.q)}
									{@const isOpen = !!openItems[item.q]}
									<div class="py-4 first:pt-0 last:pb-0">
										<button
											type="button"
											onclick={() => toggleItem(item.q)}
											class="group flex w-full items-start justify-between gap-4 text-left"
											aria-expanded={isOpen}
										>
											<span
												class="text-sm font-semibold text-slate-800 transition-colors group-hover:text-[#1D8D2B]"
											>
												{item.q}
											</span>
											<svg
												class={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#1D8D2B]' : ''}`}
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M19.5 8.25l-7.5 7.5-7.5-7.5"
												/>
											</svg>
										</button>
										{#if isOpen}
											<div class="mt-2">
												<p
													class="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs leading-relaxed whitespace-pre-line text-slate-600"
												>
													{item.a}
												</p>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				{/if}

				<!-- Contact Support Block -->
				<div
					class="flex flex-col items-center justify-between gap-6 rounded-3xl border border-[#1D8D2B]/10 bg-gradient-to-br from-[#1D8D2B]/5 to-[#58B430]/5 p-6 md:flex-row md:p-8"
				>
					<div class="space-y-1.5 text-center md:text-left">
						<h3 class="font-serif text-lg font-bold text-[#0c2614]">Still have questions?</h3>
						<p class="mx-auto max-w-md text-xs text-slate-600 md:mx-0">
							Our dedicated customer support team is happy to assist you 24/7. Reach out via email
							or through the Help Centre.
						</p>
					</div>
					<div class="flex shrink-0 flex-wrap gap-3">
						<a
							href="mailto:info@kainook.com"
							class="flex items-center gap-1.5 rounded-xl bg-[#0c2614] px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-[#081b0d]"
						>
							<svg
								class="h-3.5 w-3.5"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
								/>
							</svg>
							Email Support
						</a>
					</div>
				</div>
			</section>
		</div>
	</main>
</div>
