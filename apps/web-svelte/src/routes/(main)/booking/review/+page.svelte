<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { PageProps } from './$types';
	import { parsePhoneNumber } from 'libphonenumber-js';
	import { isTaraCountry } from '$lib/tara';
	import type { Stripe, StripeCardElement } from '@stripe/stripe-js';
	import { currencySymbol } from '$lib/utils';
	import { fmtDates, derivePlatform, fmtPlatform } from '$lib/booking-utils';
	import ShimmerImage from '$lib/components/ShimmerImage.svelte';
	import {
		ensureAnonymousToken,
		initiateBooking,
		createBooking,
		renewLock,
		releaseLock,
		validateVoucher,
		clearToken,
		type PricingPreview,
		type CreateBookingResult
	} from '$lib/booking-api';
	import {
		createPaymentIntent,
		initiatePayment,
		fetchPaymentStatus,
		cancelPayment,
		convertFx,
		type CreateIntentResult
	} from '$lib/payment-api';
	import { auth } from '$lib/stores/auth.svelte';

	let { data }: PageProps = $props();

	const detail = $derived(data.detail);
	const sp = $derived(page.url.searchParams);
	const listingId = $derived(sp.get('listingId') ?? '');
	const start = $derived(sp.get('start') ?? '');
	const end = $derived(sp.get('end') ?? '');
	const nights = $derived(Number(sp.get('nights') ?? 0) || 0);
	const guests = $derived(Number(sp.get('guests') ?? 2) || 2);
	const currency = $derived(sp.get('currency') ?? detail.currency);
	const roomTypeId = $derived(sp.get('roomTypeId') ?? '');

	const isCar = $derived(detail.category === 'car');

	/** Payment-phase hold window (seconds) — matches the listing service's
	 *  pending_payment availability block (5 minutes from booking creation). */
	const PAYMENT_HOLD_SECONDS = 300;

	// ── Lock + timer state ───────────────────────────────────────────────────
	let lockToken = $state<string | null>(null);
	let lockExpiresAt = $state<number | null>(null);
	let pricingPreview = $state<PricingPreview | null>(null);
	let secondsLeft = $state<number | null>(null);
	let renewed = $state(false);
	let showExpiry = $state(false);
	let sessionExpired = $state(false);
	let initError = $state('');
	let initializing = $state(true);

	// ── Guest details form ───────────────────────────────────────────────────
	let firstName = $state('');
	let lastName = $state('');
	let email = $state('');
	let phone = $state('');
	let specialRequests = $state('');

	// Pre-fill the guest details from the signed-in account so a logged-in
	// traveller doesn't retype their name/email at checkout. Guests keep the
	// blank form.
	$effect(() => {
		const u = auth.user;
		if (!u) return;
		firstName = u.firstName;
		lastName = u.lastName;
		email = u.email;
		phone = u.phone ?? phone;
	});

	// ── Car rental form ──────────────────────────────────────────────────────
	let driverFirstName = $state('');
	let driverLastName = $state('');
	let driverAge = $state<string>('');
	let deliveryRequested = $state(false);
	let deliveryAddress = $state('');

	// ── Voucher state ────────────────────────────────────────────────────────
	let voucherCode = $state('');
	let voucherError = $state('');
	let voucherApplying = $state(false);
	let voucherDiscount = $state(0);
	let voucherApplied = $state(false);

	// ── Submit / confirmation state ──────────────────────────────────────────
	let submitting = $state(false);
	let submitError = $state('');
	let confirmed = $state<CreateBookingResult | null>(null);

	// ── Payment state ───────────────────────────────────────────────────────
	type PayStep = 'payment' | 'stripe_card' | 'polling' | 'confirmed';
	let payStep = $state<PayStep | null>(null);
	let payProvider = $state<'stripe' | 'tara'>('stripe');
	let bookingId = $state('');
	let bookingRef = $state('');
	let bookingTotal = $state(0);
	let mobileNumber = $state('');
	let payError = $state('');
	let paymentId = $state<string | null>(null);
	let taraXafAmount = $state<number | null>(null);
	let taraXafLoading = $state(false);
	let confirmedPayment = $state<{
		reference: string;
		paymentMethod: string;
		transactionId: string;
		totalAmount: number;
		currency: string;
		baseAmount: number;
		serviceFee: number;
		taxes: number;
		discount: number;
		securityDeposit?: number;
		deliveryFee?: number;
	} | null>(null);
	let stripeInstance = $state.raw<Stripe | null>(null);
	let stripeCardElement = $state.raw<StripeCardElement | null>(null);
	let stripeClientSecret = $state('');
	let cardRef = $state<HTMLDivElement | null>(null);
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let pollCountdownTimer: ReturnType<typeof setInterval> | null = null;
	let pollSecondsLeft = $state(120);
	const POLL_WINDOW_SECONDS = 120;

	const taraEligible = $derived(isTaraCountry(detail.country));

	// Fetch the XAF amount shown when Tara is selected and the listing currency
	// is not already XAF (Tara only charges in XAF).
	$effect(() => {
		if (payProvider !== 'tara' || !confirmed || !breakdown) {
			taraXafAmount = null;
			taraXafLoading = false;
			return;
		}
		if ((breakdown.listingCurrency ?? '').toUpperCase() === 'XAF') {
			taraXafAmount = null;
			taraXafLoading = false;
			return;
		}
		let cancelled = false;
		taraXafLoading = true;
		void convertFx(breakdown.total, breakdown.listingCurrency, 'XAF')
			.then((res) => {
				if (!cancelled) taraXafAmount = res?.converted ?? null;
			})
			.catch(() => {
				if (!cancelled) taraXafAmount = null;
			})
			.finally(() => {
				if (!cancelled) taraXafLoading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	// Mount the Stripe card element once we reach the card step.
	$effect(() => {
		if (payStep !== 'stripe_card' || !stripeInstance || !cardRef) return;
		const elements = stripeInstance.elements() as unknown as {
			create(type: 'card', options?: Record<string, unknown>): StripeCardElement;
		};
		const card = elements.create('card', {
			style: {
				base: { fontSize: '15px', color: '#1e293b', fontFamily: 'inherit' },
				'::placeholder': { color: '#94a3b8' }
			}
		});
		card.mount(cardRef);
		stripeCardElement = card;
		return () => {
			try {
				card.destroy();
			} catch {
				// ignore teardown errors
			}
		};
	});

	const unit = $derived(isCar ? 'day' : 'night');

	/** Converts a YYYY-MM-DD date to an ISO datetime (as the booking API expects for car rentals). */
	function toIsoDatetime(dateStr: string): string {
		if (!dateStr) return '';
		if (dateStr.includes('T')) return dateStr;
		return new Date(dateStr + 'T00:00:00Z').toISOString();
	}

	/** Symbol for the listing currency — the line items are billed in it. */
	const sym = $derived(currencySymbol(detail.currency));

	function fmt(n: number): string {
		if (typeof n !== 'number' || isNaN(n)) return '0';
		return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	const breakdown = $derived.by(() => {
		if (!pricingPreview) return null;
		const pp = pricingPreview;
		const base = pp.baseAmount ?? 0;
		const serviceFee = pp.serviceFee ?? 0;
		const taxAmount = pp.taxAmount ?? 0;
		const deliveryFee = pp.deliveryFee ?? 0;
		const securityDeposit = pp.securityDeposit ?? 0;
		const discount = voucherApplied ? voucherDiscount : (pp.promotionDiscount ?? 0);
		const subtotal = Math.max(0, base - discount);
		const total = subtotal + serviceFee + taxAmount + deliveryFee + securityDeposit;
		const info = derivePlatform(pp, pp.currency ?? detail.currency, total);
		return {
			base,
			discount,
			subtotal,
			serviceFee,
			taxes: taxAmount,
			deliveryFee,
			securityDeposit,
			total,
			platformCurrency: info.platformCurrency,
			platformAmount: info.platformAmount,
			platformRate: info.platformRate,
			listingCurrency: pp.currency ?? detail.currency
		};
	});

	// ── Lock acquisition (client only) ───────────────────────────────────────
	// The initial lock is acquired once on mount. The car delivery toggle
	// releases and re-acquires explicitly, so the two never race.

	/** True when the API rejected the request with an auth error after the
	 *  auto-retry already ran — at that point the anonymous session is gone. */
	function isAuthFailure(err: unknown): boolean {
		const e = err as Error & { code?: string; status?: number };
		return e?.status === 401 || e?.code === 'NO_TOKEN' || e?.code === 'INVALID_TOKEN';
	}

	// Quiet re-lock used after the delivery toggle — it updates the lock and
	// pricing without flashing the full-page skeleton (showSkeleton=false), and
	// surfaces errors via initError rather than leaving the form blank.
	async function acquireLock(showSkeleton = true): Promise<void> {
		if (!browser || !listingId) return;
		if (showSkeleton) {
			initializing = true;
			initError = '';
		}
		try {
			await ensureAnonymousToken();
			const res = await initiateBooking({
				listingId,
				roomTypeId: roomTypeId || undefined,
				checkIn: isCar ? undefined : start,
				checkOut: isCar ? undefined : end,
				pickupDatetime: isCar ? toIsoDatetime(start) || undefined : undefined,
				returnDatetime: isCar ? toIsoDatetime(end) || undefined : undefined,
				deliveryRequested: isCar ? deliveryRequested || undefined : undefined,
				guests,
				currency
			});
			lockToken = res.lockToken;
			lockExpiresAt = new Date(res.expiresAt).getTime();
			pricingPreview = res.pricingPreview;
			secondsLeft = Math.max(0, Math.floor((lockExpiresAt - Date.now()) / 1000));
		} catch (err) {
			if (isAuthFailure(err)) {
				clearToken();
				sessionExpired = true;
			} else {
				initError = (err as Error)?.message ?? 'Unable to secure these dates. Please try again.';
			}
		} finally {
			if (showSkeleton) initializing = false;
		}
	}

	onMount(() => {
		if (!browser || !listingId) return;
		void acquireLock(true);
	});

	// When the guest toggles car delivery after locking, release the old lock
	// and then re-acquire with the new preference. The re-lock runs quietly
	// (no skeleton) so the form doesn't jump away while pricing updates.
	let lockedDelivery = $state(false);

	$effect(() => {
		if (!browser || !isCar || !lockToken || confirmed) return;
		if (lockedDelivery === deliveryRequested) return;
		lockedDelivery = deliveryRequested;
		initError = '';
		const token = lockToken;
		lockToken = null;
		pricingPreview = null;
		secondsLeft = null;
		void (async () => {
			await releaseLock(token);
			await acquireLock(false);
		})();
	});

	// ── Countdown timer ──────────────────────────────────────────────────────
	$effect(() => {
		const remaining = secondsLeft;
		if (remaining === null || !browser) return;
		if (remaining <= 0) {
			// Once the booking exists the dates are held by the pending_payment
			// record, so the countdown reaching zero should not expire it.
			if (!confirmed) showExpiry = true;
			return;
		}
		const timer = setTimeout(() => (secondsLeft = remaining - 1), 1000);
		return () => clearTimeout(timer);
	});

	// ── Release lock on abandon / unload ─────────────────────────────────────
	$effect(() => {
		if (!browser || !lockToken) return;
		const token = lockToken;
		const onUnload = () => {
			void releaseLock(token);
		};
		window.addEventListener('pagehide', onUnload);
		return () => window.removeEventListener('pagehide', onUnload);
	});

	// Cancel an open Stripe payment when the guest leaves mid-checkout.
	$effect(() => {
		if (!browser || !paymentId || payProvider !== 'stripe') return;
		const onUnload = () => firePaymentCancel();
		const onBeforeUnload = () => firePaymentCancel();
		window.addEventListener('pagehide', onUnload);
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => {
			window.removeEventListener('pagehide', onUnload);
			window.removeEventListener('beforeunload', onBeforeUnload);
		};
	});

	function timerColor(): string {
		if (secondsLeft === null) return 'text-slate-500';
		if (secondsLeft > 120) return 'text-emerald-600';
		if (secondsLeft > 30) return 'text-amber-500';
		return 'text-red-600';
	}

	function timerBg(): string {
		if (secondsLeft === null) return 'bg-slate-100 border-slate-200';
		if (secondsLeft > 120) return 'bg-emerald-50 border-emerald-200';
		if (secondsLeft > 30) return 'bg-amber-50 border-amber-200';
		return 'bg-red-50 border-red-200';
	}

	function timerDisplay(): string {
		if (secondsLeft === null) return '—:——';
		const mm = Math.floor(secondsLeft / 60)
			.toString()
			.padStart(2, '0');
		const ss = (secondsLeft % 60).toString().padStart(2, '0');
		return `${mm}:${ss}`;
	}

	function timerMsg(): string {
		if (secondsLeft === null || secondsLeft <= 0) return '';
		const mm = Math.floor(secondsLeft / 60)
			.toString()
			.padStart(2, '0');
		const ss = (secondsLeft % 60).toString().padStart(2, '0');
		if (confirmed) {
			if (secondsLeft > 120) return 'Dates held — complete payment';
			if (secondsLeft > 30) return `Complete payment — ${mm}:${ss} left`;
			return 'Payment window expiring soon!';
		}
		if (secondsLeft > 120) return 'Booking held — complete your booking';
		if (secondsLeft > 30) return `Hurry — only ${mm}:${ss} remaining!`;
		return 'Expiring soon!';
	}

	async function handleRenew(): Promise<void> {
		if (!lockToken || renewed) return;
		try {
			const res = await renewLock(lockToken);
			renewed = true;
			lockExpiresAt = new Date(res.expiresAt).getTime();
			secondsLeft = Math.max(0, Math.floor((lockExpiresAt - Date.now()) / 1000));
		} catch {
			initError = 'Could not extend the reservation. Please try again.';
		}
	}

	function handleCancel(): void {
		if (lockToken) void releaseLock(lockToken);
		void goto(`/listings/${listingId}`);
	}

	async function handleVoucherApply(): Promise<void> {
		const code = voucherCode.trim();
		if (!code || !breakdown || voucherApplying) return;
		voucherError = '';
		voucherApplying = true;
		try {
			const res = await validateVoucher({
				code,
				totalAmount: breakdown.base,
				activity: isCar ? 'cars' : detail.category === 'apartment' ? 'apartments' : 'hotels',
				guestId: auth.user?.id ?? 'guest',
				guestCountry: detail.country
			});
			if (res.valid && res.discountAmount > 0) {
				voucherApplied = true;
				voucherDiscount = res.discountAmount;
				voucherCode = code;
			} else {
				voucherApplied = false;
				voucherDiscount = 0;
				voucherError = res.message || 'This voucher is not valid for this booking.';
			}
		} catch (err) {
			voucherError = (err as Error)?.message ?? 'Could not validate this voucher.';
		} finally {
			voucherApplying = false;
		}
	}

	function removeVoucher(): void {
		voucherApplied = false;
		voucherDiscount = 0;
		voucherCode = '';
	}

	async function handleCompleteBooking(): Promise<void> {
		if (!lockToken || submitting) return;
		if (!firstName.trim() || !lastName.trim() || !email.trim()) {
			submitError = 'Please fill in your name and email.';
			return;
		}
		if (isCar && (!driverFirstName.trim() || !driverLastName.trim())) {
			submitError = 'Please fill in the driver name.';
			return;
		}
		if (isCar && driverAge.trim()) {
			const age = Number(driverAge);
			if (isNaN(age) || age < 18) {
				submitError = 'Driver must be at least 18 years old.';
				return;
			}
		}
		if (isCar && deliveryRequested && !deliveryAddress.trim()) {
			submitError = 'Please enter a delivery address.';
			return;
		}
		submitting = true;
		submitError = '';
		try {
			const res = await createBooking({
				lockToken,
				listingId,
				roomTypeId: roomTypeId || undefined,
				checkIn: isCar ? undefined : start,
				checkOut: isCar ? undefined : end,
				pickupDatetime: isCar ? toIsoDatetime(start) || undefined : undefined,
				returnDatetime: isCar ? toIsoDatetime(end) || undefined : undefined,
				guestFirstName: firstName.trim(),
				guestLastName: lastName.trim(),
				guestEmail: email.trim(),
				guestPhone: phone.trim() || undefined,
				adults: guests,
				children: 0,
				specialRequests: specialRequests.trim() || undefined,
				driverFirstName: isCar ? driverFirstName.trim() : undefined,
				driverLastName: isCar ? driverLastName.trim() : undefined,
				driverAge: isCar && driverAge.trim() ? Number(driverAge) : undefined,
				deliveryRequested: isCar ? deliveryRequested : undefined,
				deliveryAddress:
					isCar && deliveryRequested ? deliveryAddress.trim() || undefined : undefined,
				voucherCode: voucherApplied ? voucherCode : undefined,
				currency
			});
			confirmed = res;
			bookingId = res.bookingId;
			bookingRef = res.bookingReference;
			bookingTotal = Number(res.totalAmount) || (breakdown?.total ?? 0);
			lockToken = null;
			// The Redis reservation lock is consumed on booking creation — the
			// pending_payment record now holds the dates for its own 5-minute
			// window, so rebase the countdown to that payment window.
			lockExpiresAt = Date.now() + PAYMENT_HOLD_SECONDS * 1000;
			secondsLeft = PAYMENT_HOLD_SECONDS;
			payError = '';
			payStep = 'payment';
		} catch (err) {
			const code = (err as Error & { code?: string })?.code;
			if (code === 'LOCK_EXPIRED') {
				showExpiry = true;
			} else if (isAuthFailure(err)) {
				clearToken();
				sessionExpired = true;
			} else {
				submitError =
					(err as Error)?.message ?? 'Could not complete your booking. Please try again.';
			}
		} finally {
			submitting = false;
		}
	}

	// ── Payment handlers ─────────────────────────────────────────────────────
	function clearPoll(): void {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
		if (pollCountdownTimer) {
			clearInterval(pollCountdownTimer);
			pollCountdownTimer = null;
		}
		pollSecondsLeft = POLL_WINDOW_SECONDS;
	}

	function startPolling(method: string): void {
		if (!paymentId) return;
		clearPoll();
		const pmId = paymentId;
		const startedAt = Date.now();
		pollSecondsLeft = POLL_WINDOW_SECONDS;
		pollCountdownTimer = setInterval(() => {
			pollSecondsLeft = Math.max(
				0,
				POLL_WINDOW_SECONDS - Math.floor((Date.now() - startedAt) / 1000)
			);
		}, 1000);
		pollTimer = setInterval(async () => {
			if (Date.now() - startedAt > 120_000) {
				clearPoll();
				payError = 'Payment took too long. Please try again.';
				payStep = 'payment';
				return;
			}
			try {
				const status = await fetchPaymentStatus(pmId);
				if (status.status === 'captured') {
					clearPoll();
					paymentResolvedRef.current = true;
					confirmedPayment = {
						reference: bookingRef,
						paymentMethod: method,
						transactionId: status.transactionId ?? status.displayId ?? pmId,
						totalAmount: Number(status.amount) || bookingTotal,
						currency: status.currency || currency,
						baseAmount: breakdown?.base ?? 0,
						serviceFee: breakdown?.serviceFee ?? 0,
						taxes: breakdown?.taxes ?? 0,
						discount: breakdown?.discount ?? 0,
						securityDeposit: breakdown?.securityDeposit,
						deliveryFee: breakdown?.deliveryFee
					};
					payStep = 'confirmed';
				} else if (status.status === 'failed' || status.status === 'timed_out') {
					clearPoll();
					paymentResolvedRef.current = true;
					payError = 'Payment failed. Please try again.';
					payStep = 'payment';
				}
			} catch {
				// keep polling on transient errors
			}
		}, 3000);
	}

	async function handlePay(): Promise<void> {
		if (!bookingId || submitting) return;
		submitting = true;
		payError = '';
		try {
			if (payProvider === 'stripe') {
				const intent: CreateIntentResult = await createPaymentIntent(bookingId);
				paymentId = intent.paymentId;
				stripeClientSecret = intent.clientSecret;
				const publishableKey =
					intent.publishableKey ?? import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
				const { loadStripe } = await import('@stripe/stripe-js');
				const stripe = await loadStripe(publishableKey);
				if (!stripe) {
					payError = 'Could not load the payment provider. Please try again.';
					return;
				}
				stripeInstance = stripe;
				payStep = 'stripe_card';
			} else {
				// Tara mobile money
				const trimmed = mobileNumber.trim();
				if (!trimmed) {
					payError = 'Please enter your mobile number.';
					return;
				}
				let phoneCountry = '';
				try {
					phoneCountry = parsePhoneNumber(trimmed)?.country ?? '';
				} catch {
					phoneCountry = '';
				}
				if (!phoneCountry || !isTaraCountry(phoneCountry)) {
					payError =
						'Mobile money is only available for supported African countries. Please use card payment instead.';
					return;
				}
				const payRes = await initiatePayment({
					bookingId,
					paymentProvider: 'tara',
					mobileNumber: trimmed
				});
				paymentId = payRes.paymentId;
				payStep = 'polling';
				startPolling('Mobile Money');
			}
		} catch (err) {
			if (isAuthFailure(err)) {
				clearToken();
				sessionExpired = true;
			} else {
				payError = (err as Error)?.message ?? 'Payment initiation failed. Please try again.';
			}
		} finally {
			submitting = false;
		}
	}

	async function handleStripeConfirm(): Promise<void> {
		if (!stripeInstance || !stripeCardElement || !stripeClientSecret) return;
		submitting = true;
		payError = '';
		try {
			const result = await stripeInstance.confirmCardPayment(stripeClientSecret, {
				payment_method: { card: stripeCardElement }
			});
			if (result.error) {
				payError = result.error.message ?? 'Card payment failed. Please check your details.';
			} else {
				payStep = 'polling';
				startPolling('Card');
			}
		} catch (err) {
			payError = (err as Error)?.message ?? 'Card payment failed.';
		} finally {
			submitting = false;
		}
	}

	// Cancel the open Stripe payment if the guest leaves mid-checkout (idempotent).
	const paymentResolvedRef = { current: false };
	let lastCancelledPaymentRef: string | null = null;

	function firePaymentCancel(): void {
		const pmId = paymentId;
		if (!pmId || payProvider !== 'stripe' || paymentResolvedRef.current) return;
		if (lastCancelledPaymentRef === pmId) return;
		lastCancelledPaymentRef = pmId;
		void cancelPayment(pmId);
	}

	function handlePaymentBack(): void {
		if (payStep === 'stripe_card' || payStep === 'polling') {
			firePaymentCancel();
			clearPoll();
		}
		payStep = 'payment';
		payError = '';
	}

	function handleCancelAfterBooking(): void {
		firePaymentCancel();
		clearPoll();
		void goto(`/listings/${listingId}`);
	}

	function expiryAction(path: string): void {
		if (lockToken) void releaseLock(lockToken);
		void goto(path);
	}
</script>

<svelte:head>
	<title>Booking Review | Kainook</title>
	<meta name="description" content="Review and complete your Kainook booking." />
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
	{#if confirmedPayment && payStep === 'confirmed'}
		<!-- ── Confirmation ── -->
		<div class="mx-auto max-w-2xl space-y-6">
			<div class="py-8 text-center">
				<div
					class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 shadow-inner"
				>
					<svg
						class="h-10 w-10 text-emerald-600"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<h1 class="mt-4 text-2xl font-bold text-slate-900">Booking confirmed</h1>
				<p class="mt-1 text-sm text-slate-500">
					A confirmation email will be sent to <span class="font-semibold">{email}</span>
				</p>
			</div>

			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div class="flex items-center justify-between border-b border-slate-100 pb-4">
					<span class="text-xs font-semibold tracking-wider text-slate-400 uppercase"
						>Booking reference</span
					>
					<span class="font-mono text-lg font-bold text-[#0B1E3F]"
						>{confirmedPayment.reference}</span
					>
				</div>
				<dl class="mt-4 space-y-2 text-sm">
					<div class="flex justify-between">
						<dt class="text-slate-400">Listing</dt>
						<dd class="font-semibold text-slate-700">{detail.name}</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-slate-400">Dates</dt>
						<dd class="font-semibold text-slate-700">{fmtDates(start, end)}</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-slate-400">Guests</dt>
						<dd class="font-semibold text-slate-700">{guests} guest{guests !== 1 ? 's' : ''}</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-slate-400">Total</dt>
						<dd class="font-semibold text-slate-700">
							{fmtPlatform(confirmedPayment.totalAmount, confirmedPayment.currency)}
						</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-slate-400">Paid with</dt>
						<dd class="font-semibold text-slate-700">{confirmedPayment.paymentMethod}</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-slate-400">Transaction</dt>
						<dd class="font-mono text-slate-700">{confirmedPayment.transactionId}</dd>
					</div>
				</dl>
			</div>

			<div class="flex items-center justify-center gap-3">
				<a
					href="/"
					class="rounded-xl bg-[#0B1E3F] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#07152B]"
				>
					Back to home
				</a>
				<a
					href={`/listings/${listingId}`}
					class="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
				>
					View listing
				</a>
			</div>
		</div>
	{:else}
		<!-- ── Header with timer ── -->
		<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
			<h1 class="font-serif text-2xl font-bold text-slate-900">Review your booking</h1>
			{#if secondsLeft !== null}
				<div
					class={`flex items-center gap-2 rounded-xl border px-3.5 py-1.5 font-mono text-sm font-semibold ${timerBg()}`}
				>
					<span class={`h-2 w-2 animate-pulse rounded-full ${timerColor()}`}></span>
					<span class={timerColor()}>{timerDisplay()}</span>
					<span class={`hidden text-xs font-medium sm:inline ${timerColor()}`}>{timerMsg()}</span>
				</div>
			{/if}
			<button
				type="button"
				onclick={handleCancel}
				class="text-xs font-semibold text-slate-500 transition hover:text-red-500"
			>
				Cancel booking
			</button>
		</div>

		{#if initializing}
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
				<div class="space-y-6">
					<div class="h-40 animate-pulse rounded-2xl bg-slate-100"></div>
					<div class="h-64 animate-pulse rounded-2xl bg-slate-100"></div>
				</div>
				<div class="h-80 animate-pulse rounded-2xl bg-slate-100"></div>
			</div>
		{:else if initError}
			<div
				class="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700"
			>
				<p class="font-semibold">{initError}</p>
				<button
					type="button"
					onclick={() => goto(`/listings/${listingId}`)}
					class="mt-4 rounded-xl bg-[#0B1E3F] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#07152B]"
				>
					Back to listing
				</button>
			</div>
		{:else if !payStep}
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
				<!-- ── Left column: listing + guest details + voucher ── -->
				<div class="space-y-6">
					<!-- Step indicator -->
					<div class="flex items-center gap-0">
						<div class="flex items-center gap-1.5 text-xs font-semibold text-[#0B1E3F]">
							<span
								class="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B1E3F] text-[10px] font-bold text-white"
								>1</span
							>
							Review
						</div>
						<div class="mx-2 h-px w-12 bg-slate-200"></div>
						<div class="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
							<span
								class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500"
								>2</span
							>
							Confirm
						</div>
					</div>

					<!-- Your Booking -->
					<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<h3 class="mb-4 flex items-center gap-2 font-bold text-slate-800">Your Booking</h3>
						<div class="flex gap-4">
							{#if detail.primaryPhotoUrl}
								<ShimmerImage
									src={detail.primaryPhotoUrl}
									alt={detail.name}
									class="h-20 w-24 shrink-0 rounded-xl object-cover"
								/>
							{:else}
								<div
									class="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl"
								>
									{isCar ? '🚗' : '🏨'}
								</div>
							{/if}
							<div class="min-w-0">
								<p class="mb-0.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
									{detail.category}
								</p>
								<h3 class="text-base leading-snug font-bold text-slate-800">{detail.name}</h3>
								{#if roomTypeId}
									<p class="mt-0.5 text-xs font-semibold text-[#1D8D2B]">
										{detail.roomTypes?.find((r) => r.id === roomTypeId)?.name}
									</p>
								{/if}
								<p class="mt-0.5 text-sm text-slate-500">
									{detail.town}{detail.country ? `, ${detail.country}` : ''}
								</p>
							</div>
						</div>
						<div class="mt-4 grid grid-cols-2 gap-3 text-sm">
							{#if isCar}
								<div>
									<p class="mb-0.5 text-xs font-medium text-slate-400">Pick-up</p>
									<p class="font-semibold text-slate-700">{fmtDates(start, '')}</p>
								</div>
								<div>
									<p class="mb-0.5 text-xs font-medium text-slate-400">Return</p>
									<p class="font-semibold text-slate-700">{fmtDates('', end)}</p>
								</div>
							{:else}
								<div>
									<p class="mb-0.5 text-xs font-medium text-slate-400">Check-in</p>
									<p class="font-semibold text-slate-700">{fmtDates(start, '')}</p>
								</div>
								<div>
									<p class="mb-0.5 text-xs font-medium text-slate-400">Check-out</p>
									<p class="font-semibold text-slate-700">{fmtDates('', end)}</p>
								</div>
							{/if}
							<div>
								<p class="mb-0.5 text-xs font-medium text-slate-400">Duration</p>
								<p class="font-semibold text-slate-700">
									{nights}
									{unit}{nights !== 1 ? 's' : ''}
								</p>
							</div>
							<div>
								<p class="mb-0.5 text-xs font-medium text-slate-400">Guests</p>
								<p class="font-semibold text-slate-700">{guests} guest{guests !== 1 ? 's' : ''}</p>
							</div>
						</div>
					</section>

					<!-- Guest Details -->
					<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<h3 class="mb-4 flex items-center gap-2 font-bold text-slate-800">Guest Details</h3>
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div>
								<label for="guest-first" class="mb-1 block text-xs font-semibold text-slate-600"
									>First name</label
								>
								<input
									id="guest-first"
									type="text"
									bind:value={firstName}
									placeholder="First name"
									class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1D8D2B]"
								/>
							</div>
							<div>
								<label for="guest-last" class="mb-1 block text-xs font-semibold text-slate-600"
									>Last name</label
								>
								<input
									id="guest-last"
									type="text"
									bind:value={lastName}
									placeholder="Last name"
									class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1D8D2B]"
								/>
							</div>
							<div>
								<label for="guest-email" class="mb-1 block text-xs font-semibold text-slate-600"
									>Email</label
								>
								<input
									id="guest-email"
									type="email"
									bind:value={email}
									placeholder="you@example.com"
									class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1D8D2B]"
								/>
							</div>
							<div>
								<label for="guest-phone" class="mb-1 block text-xs font-semibold text-slate-600"
									>Phone (optional)</label
								>
								<input
									id="guest-phone"
									type="tel"
									bind:value={phone}
									placeholder="+254…"
									class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1D8D2B]"
								/>
							</div>
							<div class="sm:col-span-2">
								<label for="guest-special" class="mb-1 block text-xs font-semibold text-slate-600"
									>Special requests (optional)</label
								>
								<textarea
									id="guest-special"
									bind:value={specialRequests}
									rows="2"
									placeholder="Anything the host should know?"
									class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1D8D2B]"
								></textarea>
							</div>

							{#if isCar}
								<div class="sm:col-span-2">
									<p
										class="mb-2 border-t border-slate-100 pt-3 text-xs font-semibold tracking-wider text-slate-400 uppercase"
									>
										Driver details
									</p>
								</div>
								<div>
									<label for="driver-first" class="mb-1 block text-xs font-semibold text-slate-600"
										>Driver first name</label
									>
									<input
										id="driver-first"
										type="text"
										bind:value={driverFirstName}
										placeholder="Driver first name"
										class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1D8D2B]"
									/>
								</div>
								<div>
									<label for="driver-last" class="mb-1 block text-xs font-semibold text-slate-600"
										>Driver last name</label
									>
									<input
										id="driver-last"
										type="text"
										bind:value={driverLastName}
										placeholder="Driver last name"
										class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1D8D2B]"
									/>
								</div>
								<div>
									<label for="driver-age" class="mb-1 block text-xs font-semibold text-slate-600"
										>Driver age (optional)</label
									>
									<input
										id="driver-age"
										type="number"
										min="18"
										bind:value={driverAge}
										placeholder="18"
										class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1D8D2B]"
									/>
								</div>

								{#if detail.deliveryAvailable}
									<div class="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
										<label
											class="flex cursor-pointer items-center justify-between gap-2 select-none"
										>
											<div>
												<p class="text-sm font-semibold text-slate-800">Request vehicle delivery</p>
												<p class="mt-0.5 text-xs text-slate-400">
													{detail.deliveryFee != null && detail.deliveryFee > 0
														? `${sym}${detail.deliveryFee.toLocaleString()} delivery fee`
														: 'Free delivery'}
													{detail.deliveryRadiusKm ? ` · within ${detail.deliveryRadiusKm} km` : ''}
												</p>
											</div>
											<input
												type="checkbox"
												bind:checked={deliveryRequested}
												class="rounded border-slate-300 text-[#1D8D2B] focus:ring-[#1D8D2B]"
											/>
										</label>
										{#if deliveryRequested}
											<input
												id="delivery-address"
												type="text"
												bind:value={deliveryAddress}
												placeholder="Delivery address"
												class="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1D8D2B]"
											/>
										{/if}
									</div>
								{/if}
							{/if}
						</div>
					</section>

					<!-- Voucher -->
					<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<h3 class="mb-4 flex items-center gap-2 font-bold text-slate-800">Discount Code</h3>
						{#if voucherApplied}
							<div class="flex items-center justify-between">
								<span class="text-sm font-semibold text-emerald-700">
									✓ {voucherCode} — saves {sym}{fmt(voucherDiscount)}
								</span>
								<button
									type="button"
									onclick={removeVoucher}
									class="text-xs font-medium text-slate-400 transition hover:text-red-500"
								>
									Remove
								</button>
							</div>
						{:else}
							<div class="flex items-center gap-2">
								<input
									type="text"
									bind:value={voucherCode}
									placeholder="Promo / voucher code"
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											void handleVoucherApply();
										}
									}}
									class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#1D8D2B]"
								/>
								<button
									type="button"
									onclick={() => void handleVoucherApply()}
									disabled={voucherApplying || !voucherCode.trim()}
									class="shrink-0 rounded-xl border border-[#0B1E3F] px-3 py-2.5 text-xs font-bold text-[#0B1E3F] transition hover:bg-[#0B1E3F] hover:text-white disabled:opacity-40"
								>
									{voucherApplying ? '…' : 'Apply'}
								</button>
							</div>
							{#if voucherError}
								<p class="mt-2 text-xs font-medium text-red-600">{voucherError}</p>
							{/if}
						{/if}
					</section>

					{#if renewed && secondsLeft !== null && secondsLeft > 0}
						<p class="text-center text-xs font-medium text-emerald-600">
							Reservation lock extended.
						</p>
					{:else if secondsLeft !== null && secondsLeft <= 120 && secondsLeft > 0}
						<div class="text-center">
							<button
								type="button"
								onclick={() => void handleRenew()}
								class="text-xs font-semibold text-[#1D8D2B] underline-offset-2 hover:underline"
							>
								Extend reservation by 5 minutes
							</button>
						</div>
					{/if}

					{#if submitError}
						<div
							class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600"
						>
							{submitError}
						</div>
					{/if}

					<button
						type="button"
						onclick={() => void handleCompleteBooking()}
						disabled={submitting || secondsLeft === null || secondsLeft <= 0}
						class="w-full rounded-xl bg-[#0B1E3F] py-3.5 text-sm font-bold text-white transition hover:bg-[#07152B] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{submitting ? 'Completing booking…' : 'Continue to payment'}
					</button>
					<p class="text-center text-xs text-slate-400">
						Your dates are held. Payment is taken after you confirm.
					</p>
				</div>

				<!-- ── Right column: price summary ── -->
				<aside class="lg:sticky lg:top-20 lg:self-start">
					<div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<h3 class="font-bold text-slate-800">Price Breakdown</h3>

						<div class="flex gap-3 border-b border-slate-100 pb-4">
							{#if detail.primaryPhotoUrl}
								<ShimmerImage
									src={detail.primaryPhotoUrl}
									alt=""
									class="h-14 w-16 shrink-0 rounded-xl object-cover"
								/>
							{:else}
								<div
									class="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl"
								>
									{isCar ? '🚗' : '🏨'}
								</div>
							{/if}
							<div class="min-w-0">
								<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
									{detail.category}
								</p>
								<p class="truncate text-sm font-bold text-slate-800">{detail.name}</p>
								{#if roomTypeId}
									<p class="truncate text-[10px] font-semibold text-[#1D8D2B]">
										{detail.roomTypes?.find((r) => r.id === roomTypeId)?.name}
									</p>
								{/if}
							</div>
						</div>

						{#if breakdown}
							<div class="space-y-2.5 text-sm">
								<div class="flex justify-between text-slate-600">
									<span>
										{sym}
										{pricingPreview?.nightlyRate?.toLocaleString() ?? breakdown.base}
										× {pricingPreview?.units ?? nights}
										{unit}{nights !== 1 ? 's' : ''}
									</span>
									<span>{sym}{fmt(breakdown.base)}</span>
								</div>
								{#if breakdown.discount > 0}
									<div class="flex justify-between font-semibold text-emerald-600">
										<span>{voucherApplied ? 'Voucher discount' : 'Promotional discount'}</span>
										<span>−{sym}{fmt(breakdown.discount)}</span>
									</div>
								{/if}
								<div class="flex justify-between text-slate-600">
									<span> Subtotal </span>
									<span>{sym}{fmt(breakdown.subtotal)}</span>
								</div>
								<div class="flex justify-between text-slate-600">
									<span>
										Service fee{pricingPreview?.commissionRate
											? ` (${Math.round(pricingPreview.commissionRate * 100)}%)`
											: ''}
									</span>
									<span>{sym}{fmt(breakdown.serviceFee)}</span>
								</div>
								{#if breakdown.taxes > 0}
									<div class="flex justify-between text-slate-600">
										<span>
											Taxes{pricingPreview?.taxRate
												? ` (${Math.round(pricingPreview.taxRate * 100)}%)`
												: ''}
										</span>
										<span>{sym}{fmt(breakdown.taxes)}</span>
									</div>
								{/if}
								{#if breakdown.deliveryFee > 0}
									<div class="flex justify-between text-slate-600">
										<span>Delivery fee</span>
										<span>{sym}{fmt(breakdown.deliveryFee)}</span>
									</div>
								{/if}
								{#if breakdown.securityDeposit > 0}
									<div class="flex justify-between text-slate-600">
										<span>Security deposit</span>
										<span>{sym}{fmt(breakdown.securityDeposit)}</span>
									</div>
								{/if}
								<div
									class="flex items-baseline justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900"
								>
									<span>Total</span>
									<span class="text-right">
										<div>
											{fmtPlatform(breakdown.platformAmount, breakdown.platformCurrency)}
										</div>
										{#if breakdown.platformCurrency !== breakdown.listingCurrency}
											<div class="text-[10px] font-normal text-slate-400">
												Billed as approx.
												{fmtPlatform(breakdown.total, breakdown.listingCurrency)}
											</div>
										{/if}
									</span>
								</div>
							</div>
						{:else}
							<p class="text-sm text-slate-400">Loading price…</p>
						{/if}
					</div>
				</aside>
			</div>
		{:else if payStep === 'payment'}
			<!-- ── PAYMENT step ── -->
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
				<div class="space-y-6">
					<!-- Step indicator -->
					<div class="flex items-center gap-0">
						<div class="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
							<span
								class="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white"
								>✓</span
							>
							Review
						</div>
						<div class="mx-2 h-px w-12 bg-slate-200"></div>
						<div class="flex items-center gap-1.5 text-xs font-semibold text-[#0B1E3F]">
							<span
								class="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B1E3F] text-[10px] font-bold text-white"
								>2</span
							>
							Payment
						</div>
					</div>

					{#if secondsLeft !== null}
						<div
							class={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 ${timerBg()}`}
						>
							<div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
								<svg
									class={`h-4 w-4 animate-pulse ${timerColor()}`}
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<span>Your dates are held</span>
							</div>
							<div class="flex items-center gap-2">
								<span class={`font-mono text-base font-bold ${timerColor()}`}>{timerDisplay()}</span
								>
								<span class={`hidden text-xs font-medium sm:inline ${timerColor()}`}>
									{timerMsg()}
								</span>
							</div>
						</div>
					{/if}

					<!-- Payment method selector -->
					<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<h3 class="mb-4 flex items-center gap-2 font-bold text-slate-800">Payment Method</h3>
						<div class="grid grid-cols-2 gap-3">
							<button
								type="button"
								onclick={() => (payProvider = 'stripe')}
								class={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-semibold transition ${
									payProvider === 'stripe'
										? 'border-[#0B1E3F] bg-[#0B1E3F]/5 text-[#0B1E3F]'
										: 'border-slate-200 text-slate-500 hover:border-slate-300'
								}`}
							>
								<span class="text-2xl">💳</span>
								<span>Card & Digital Wallets</span>
								{#if !taraEligible}
									<span
										class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
									>
										Recommended
									</span>
								{/if}
							</button>
							{#if taraEligible}
								<button
									type="button"
									onclick={() => (payProvider = 'tara')}
									class={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-semibold transition ${
										payProvider === 'tara'
											? 'border-[#0B1E3F] bg-[#0B1E3F]/5 text-[#0B1E3F]'
											: 'border-slate-200 text-slate-500 hover:border-slate-300'
									}`}
								>
									<span class="text-2xl">📱</span>
									<span>Mobile Money</span>
									<span
										class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
									>
										Recommended
									</span>
								</button>
							{/if}
						</div>
					</section>

					{#if payProvider === 'tara'}
						<!-- Mobile Money -->
						<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<h3 class="mb-4 flex items-center gap-2 font-bold text-slate-800">Mobile Money</h3>
							<label for="tara-phone" class="mb-1.5 block text-sm font-medium text-slate-700"
								>Mobile Number</label
							>
							<input
								id="tara-phone"
								type="tel"
								bind:value={mobileNumber}
								placeholder="+254 700 000 000"
								class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#0B1E3F]"
							/>
							{#if taraXafLoading}
								<p class="mt-2 text-xs text-slate-400">Converting to XAF…</p>
							{:else if taraXafAmount != null}
								<p class="mt-2 text-xs text-slate-500">
									You'll pay approximately {taraXafAmount.toLocaleString()} XAF (mobile money is charged
									in XAF).
								</p>
							{:else if (breakdown?.listingCurrency ?? '').toUpperCase() !== 'XAF'}
								<p class="mt-2 text-xs text-slate-500">
									Mobile money is charged in XAF (Central African CFA Franc).
								</p>
							{/if}
							<p class="mt-2 text-xs text-slate-400">
								You will receive a payment prompt on this number.
							</p>
						</section>
					{:else}
						<!-- Card & digital wallets -->
						<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<h3 class="mb-4 flex items-center gap-2 font-bold text-slate-800">Secure Payment</h3>
							<p class="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
								<span class="text-emerald-500">✓</span> Your payment is processed securely.
							</p>
							<div class="mb-4 flex flex-wrap gap-2">
								{#each ['Visa', 'Mastercard', 'Amex', 'Apple Pay', 'Google Pay', 'PayPal'] as c (c)}
									<span
										class="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500"
									>
										{c}
									</span>
								{/each}
							</div>
							<p class="text-xs text-slate-400">
								You will be prompted to enter your card details on the next step.
							</p>
						</section>
					{/if}

					{#if payError}
						<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{payError}
						</div>
					{/if}

					<div class="flex gap-3">
						<button
							type="button"
							onclick={handlePaymentBack}
							class="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
						>
							← Back
						</button>
						<button
							type="button"
							onclick={() => void handlePay()}
							disabled={submitting}
							class="flex-[2] rounded-xl bg-[#0B1E3F] py-3.5 text-sm font-bold text-white transition hover:bg-[#07152B] disabled:opacity-50"
						>
							{submitting
								? 'Please wait…'
								: payProvider === 'tara'
									? 'Send Payment Request'
									: breakdown
										? `Pay ${fmtPlatform(breakdown.platformAmount, breakdown.platformCurrency)}`
										: 'Pay'}
						</button>
					</div>
					<button
						type="button"
						onclick={handleCancelAfterBooking}
						class="w-full text-center text-xs font-semibold text-slate-400 transition hover:text-red-500"
					>
						Cancel booking
					</button>
				</div>

				<!-- Right column: price summary -->
				<aside class="lg:sticky lg:top-20 lg:self-start">
					<div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<h3 class="font-bold text-slate-800">Price Breakdown</h3>
						<div class="flex gap-3 border-b border-slate-100 pb-4">
							{#if detail.primaryPhotoUrl}
								<ShimmerImage
									src={detail.primaryPhotoUrl}
									alt=""
									class="h-14 w-16 shrink-0 rounded-xl object-cover"
								/>
							{:else}
								<div
									class="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl"
								>
									{isCar ? '🚗' : '🏨'}
								</div>
							{/if}
							<div class="min-w-0">
								<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
									{detail.category}
								</p>
								<p class="truncate text-sm font-bold text-slate-800">{detail.name}</p>
							</div>
						</div>
						{#if breakdown}
							<div class="space-y-2.5 text-sm">
								<div class="flex justify-between text-slate-600">
									<span>Base amount</span>
									<span>{fmtPlatform(breakdown.base, breakdown.listingCurrency)}</span>
								</div>
								{#if breakdown.discount > 0}
									<div class="flex justify-between font-semibold text-emerald-600">
										<span>{voucherApplied ? 'Voucher discount' : 'Promotional discount'}</span>
										<span>−{fmtPlatform(breakdown.discount, breakdown.listingCurrency)}</span>
									</div>
								{/if}
								<div class="flex justify-between text-slate-600">
									<span>Service fee</span>
									<span>{fmtPlatform(breakdown.serviceFee, breakdown.listingCurrency)}</span>
								</div>
								{#if breakdown.taxes > 0}
									<div class="flex justify-between text-slate-600">
										<span>Taxes</span>
										<span>{fmtPlatform(breakdown.taxes, breakdown.listingCurrency)}</span>
									</div>
								{/if}
								{#if breakdown.deliveryFee > 0}
									<div class="flex justify-between text-slate-600">
										<span>Delivery fee</span>
										<span>{fmtPlatform(breakdown.deliveryFee, breakdown.listingCurrency)}</span>
									</div>
								{/if}
								{#if breakdown.securityDeposit > 0}
									<div class="flex justify-between text-slate-600">
										<span>Security deposit</span>
										<span>{fmtPlatform(breakdown.securityDeposit, breakdown.listingCurrency)}</span>
									</div>
								{/if}
								<div
									class="flex items-baseline justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900"
								>
									<span>Total</span>
									<span class="text-right">
										<div>{fmtPlatform(breakdown.platformAmount, breakdown.platformCurrency)}</div>
										{#if breakdown.platformCurrency !== breakdown.listingCurrency}
											<div class="text-[10px] font-normal text-slate-400">
												Billed as approx.
												{fmtPlatform(breakdown.total, breakdown.listingCurrency)}
											</div>
										{/if}
									</span>
								</div>
							</div>
						{:else}
							<p class="text-sm text-slate-400">Loading price…</p>
						{/if}
					</div>
				</aside>
			</div>
		{:else if payStep === 'stripe_card'}
			<!-- ── STRIPE CARD step ── -->
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
				<div class="space-y-6">
					<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<h3 class="mb-4 flex items-center gap-2 font-bold text-slate-800">Secure Payment</h3>
						<p class="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
							<span class="text-emerald-500">✓</span> Your payment is processed securely.
						</p>
						<div class="mb-5 flex flex-wrap gap-2">
							{#each ['Visa', 'Mastercard', 'Amex', 'UnionPay', 'Apple Pay', 'Google Pay', 'PayPal', 'Bank Debit', 'Klarna'] as c (c)}
								<span
									class="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500"
								>
									{c}
								</span>
							{/each}
						</div>
						<div
							bind:this={cardRef}
							class="min-h-[48px] rounded-xl border border-slate-200 bg-white p-4"
						></div>
						{#if payError}
							<p class="mt-4 text-sm text-red-600">{payError}</p>
						{/if}
						<button
							type="button"
							onclick={() => void handleStripeConfirm()}
							disabled={submitting}
							class="mt-6 w-full rounded-xl bg-[#0B1E3F] py-3.5 text-sm font-bold text-white transition hover:bg-[#07152B] disabled:opacity-50"
						>
							{submitting
								? 'Processing…'
								: `Pay ${breakdown ? fmtPlatform(breakdown.platformAmount, breakdown.platformCurrency) : ''}`}
						</button>
						{#if breakdown && breakdown.platformCurrency !== breakdown.listingCurrency}
							<p class="mt-2 text-xs text-slate-400">
								Billed as approx. {fmtPlatform(breakdown.total, breakdown.listingCurrency)} · charged
								in {breakdown.platformCurrency}
							</p>
						{/if}
					</section>
					<button
						type="button"
						onclick={handlePaymentBack}
						class="text-xs font-semibold text-slate-500 transition hover:text-red-500"
					>
						← Back to payment methods
					</button>
				</div>
				<aside class="lg:sticky lg:top-20 lg:self-start">
					<div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<h3 class="font-bold text-slate-800">Price Breakdown</h3>
						{#if breakdown}
							<div class="space-y-2.5 text-sm">
								<div class="flex justify-between font-bold text-slate-900">
									<span>Total</span>
									<span class="text-right">
										<div>{fmtPlatform(breakdown.platformAmount, breakdown.platformCurrency)}</div>
										{#if breakdown.platformCurrency !== breakdown.listingCurrency}
											<div class="text-[10px] font-normal text-slate-400">
												Billed as approx.
												{fmtPlatform(breakdown.total, breakdown.listingCurrency)}
											</div>
										{/if}
									</span>
								</div>
							</div>
						{/if}
					</div>
				</aside>
			</div>
		{:else if payStep === 'polling'}
			<!-- ── POLLING ── -->
			<div class="mx-auto max-w-md py-20 text-center">
				<div class="relative mx-auto h-20 w-20">
					<div class="absolute inset-0 rounded-full border-4 border-slate-200"></div>
					<div
						class="absolute inset-0 animate-spin rounded-full border-4 border-t-[#1D8D2B] border-r-[#1D8D2B]/40 border-b-[#1D8D2B]/20"
					></div>
				</div>
				<h2 class="mt-6 text-xl font-bold text-slate-800">
					{payProvider === 'tara' ? 'Payment Request Sent' : 'Processing Payment'}
				</h2>
				<p class="mt-2 text-sm leading-relaxed text-slate-500">
					{payProvider === 'tara'
						? 'A payment request has been sent to your phone. Please approve it to complete your booking.'
						: 'Please wait while we confirm your payment.'}
				</p>
				<p class="mt-3 animate-pulse text-xs text-slate-400">Waiting for payment confirmation…</p>

				{#if payProvider === 'tara'}
					<div class="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">
						<div
							class="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500"
						>
							<span>Waiting for approval on your phone</span>
							<span class="font-mono text-sm font-bold text-[#0B1E3F]">{pollSecondsLeft}s</span>
						</div>
						<div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
							<div
								class="h-full rounded-full bg-[#1D8D2B] transition-all duration-1000 ease-linear"
								style="width: {Math.round((pollSecondsLeft / POLL_WINDOW_SECONDS) * 100)}%"
							></div>
						</div>
						<p class="mt-2 text-[10px] text-slate-400">
							If you miss the prompt, you can retry from the payment step.
						</p>
					</div>
				{:else}
					<div
						class="mx-auto mt-6 flex max-w-xs items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm"
					>
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#0B1E3F]"
						></div>
						<span class="font-mono text-sm font-semibold text-slate-600">
							Confirmation pending — {pollSecondsLeft}s
						</span>
					</div>
				{/if}

				{#if payError}
					<p class="mt-4 text-sm text-red-600">{payError}</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<!-- ── Session Expired Modal ── -->
{#if sessionExpired}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
	>
		<div class="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
			<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
				<span class="text-3xl">🕐</span>
			</div>
			<h2 class="mt-4 text-xl font-bold text-slate-800">Your session has expired</h2>
			<p class="mt-2 text-sm leading-relaxed text-slate-500">
				You were away for a while and your checkout session expired. Please start your booking
				again.
			</p>
			<div class="mt-4 flex gap-3">
				<button
					type="button"
					onclick={() => expiryAction('/')}
					class="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
				>
					Search again
				</button>
				<button
					type="button"
					onclick={() => expiryAction(`/listings/${listingId}`)}
					class="flex-1 rounded-xl bg-[#0B1E3F] py-2.5 text-sm font-bold text-white transition hover:bg-[#07152B]"
				>
					Try to rebook
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ── Expiry Modal ── -->
{#if showExpiry}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
	>
		<div class="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
			<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
				<span class="text-3xl">⏰</span>
			</div>
			<h2 class="mt-4 text-xl font-bold text-slate-800">Reservation Expired</h2>
			<p class="mt-2 text-sm leading-relaxed text-slate-500">
				Your reservation hold has expired and is no longer available.
			</p>
			<div class="mt-4 flex gap-3">
				<button
					type="button"
					onclick={() => expiryAction('/')}
					class="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
				>
					Search again
				</button>
				<button
					type="button"
					onclick={() => expiryAction(`/listings/${listingId}`)}
					class="flex-1 rounded-xl bg-[#0B1E3F] py-2.5 text-sm font-bold text-white transition hover:bg-[#07152B]"
				>
					Try to rebook
				</button>
			</div>
		</div>
	</div>
{/if}
