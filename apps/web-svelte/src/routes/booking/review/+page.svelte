<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { PageProps } from './$types';
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
			showExpiry = true;
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
				guestId: 'guest',
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
			lockToken = null;
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
	{#if confirmed}
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
						>{confirmed.bookingReference}</span
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
							{fmtPlatform(confirmed.totalAmount, confirmed.currency)}
						</dd>
					</div>
				</dl>
			</div>

			<div
				class="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs leading-relaxed text-amber-800"
			>
				This booking is awaiting payment. Payment options are coming soon — you will be able to
				complete payment before your stay.
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
		{:else}
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
						{submitting ? 'Completing booking…' : 'Complete booking'}
					</button>
					<p class="text-center text-xs text-slate-400">
						You won't be charged yet — payment is coming soon.
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
