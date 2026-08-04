<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getHostProfile, submitHostProfile, AuthApiError } from '$lib/auth-api';
	import { auth, updateUser } from '$lib/stores/auth.svelte';
	import { refreshAccessToken } from '$lib/token-refresh';

	interface HostProfile {
		status: 'approved' | 'pending' | 'rejected' | null;
		businessName: string | null;
		registrationNo: string | null;
		taxId: string | null;
		documentsUrl: string | null;
		submittedAt: string | null;
		reviewedAt: string | null;
		rejectionReason: string | null;
	}

	let hostProfile = $state<HostProfile | null>(null);
	let loading = $state(true);
	let loadingError = $state('');

	let businessName = $state('');
	let registrationNo = $state('');
	let taxId = $state('');
	let documentsUrl = $state('');
	let submitError = $state('');
	let submitting = $state(false);

	$effect(() => {
		if (!auth.isAuthenticated) {
			void goto(`/auth/login?next=/host`);
		}
	});

	async function load(): Promise<void> {
		loading = true;
		loadingError = '';
		try {
			const p = await getHostProfile();
			hostProfile = p as HostProfile | null;
			if (p) {
				businessName = p.businessName ?? '';
				registrationNo = p.registrationNo ?? '';
				taxId = p.taxId ?? '';
				documentsUrl = p.documentsUrl ?? '';
			}
			// hostStatus is now a normal profile field populated from /auth/me
			// and the refresh response, so no manual store patch is needed for
			// the header. A just-approved host still needs a token refresh — the
			// backend listing routes gate on the hostStatus JWT claim, which was
			// minted before the approval.
			if (p?.status === 'approved' && auth.user?.hostStatus !== 'approved') {
				void refreshAccessToken().catch(() => {});
			}
		} catch {
			loadingError = 'Could not load your host profile.';
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function handleSubmit(): void {
		if (!businessName.trim()) {
			submitError = 'Business name is required.';
			return;
		}
		if (documentsUrl.trim() && !isValidUrl(documentsUrl.trim())) {
			submitError = 'Please enter a valid documents URL.';
			return;
		}
		submitError = '';
		submitting = true;
		void (async () => {
			try {
				const res = await submitHostProfile({
					businessName: businessName.trim(),
					...(registrationNo.trim() ? { registrationNo: registrationNo.trim() } : {}),
					...(taxId.trim() ? { taxId: taxId.trim() } : {}),
					...(documentsUrl.trim() ? { documentsUrl: documentsUrl.trim() } : {})
				});
				const p = res.hostProfile as HostProfile | null;
				hostProfile = p;
				// Submitting always moves the accreditation to pending — keep the
				// profile field in sync so the header reflects it immediately.
				updateUser({ hostStatus: 'pending' });
			} catch (e) {
				submitError =
					e instanceof AuthApiError ? e.message : 'Could not submit your host application.';
			} finally {
				submitting = false;
			}
		})();
	}

	function isValidUrl(value: string): boolean {
		try {
			const u = new URL(value);
			return u.protocol === 'http:' || u.protocol === 'https:';
		} catch {
			return false;
		}
	}

	// hostStatus is a normal profile field now — read it from the user object
	// (the backend REST body) so the banner and header always agree.
	const status = $derived(auth.user?.hostStatus ?? null);
</script>

<div class="mx-auto w-full max-w-3xl space-y-6">
	<div class="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
		<p class="text-xs font-semibold tracking-[0.28em] text-emerald-700 uppercase">Kainook Host</p>
		<h1 class="mt-1 text-3xl font-bold text-slate-950">Host onboarding</h1>
		<p class="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
			Become a host — fill in your business details to start listing properties.
		</p>
	</div>

	{#if loading}
		<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<p class="py-4 text-sm text-slate-400">Loading host profile…</p>
		</div>
	{:else if loadingError}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
			<p class="text-sm text-red-600">{loadingError}</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else}
		{#if status === 'approved'}
			<div class="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
				<svg
					class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<div>
					<h3 class="font-semibold text-emerald-900">Host application approved</h3>
					<p class="mt-1 text-sm text-emerald-700">You can now create and manage listings.</p>
				</div>
			</div>
		{:else if status === 'pending'}
			<div class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
				<svg
					class="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
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
				<div>
					<h3 class="font-semibold text-amber-900">Host application under review</h3>
					<p class="mt-1 text-sm text-amber-700">
						Our team is reviewing your business details. You'll be able to create listings once your
						application is approved. Submitting again below updates your application.
					</p>
				</div>
			</div>
		{:else if status === 'rejected'}
			<div class="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
				<svg
					class="mt-0.5 h-5 w-5 shrink-0 text-red-600"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<div>
					<h3 class="font-semibold text-red-900">Host application not approved</h3>
					<p class="mt-1 text-sm text-red-700">
						{hostProfile?.rejectionReason
							? `Reason: ${hostProfile.rejectionReason}`
							: 'Please correct the details below and resubmit your application.'}
					</p>
				</div>
			</div>
		{/if}

		<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="space-y-4"
			>
				<div>
					<label for="host-business-name" class="mb-1.5 block text-sm font-medium text-slate-700">
						Business name
					</label>
					<input
						id="host-business-name"
						bind:value={businessName}
						placeholder="e.g. Kainook Rentals Ltd"
						class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
					/>
				</div>
				<div>
					<label for="host-reg-no" class="mb-1.5 block text-sm font-medium text-slate-700">
						Business registration number
					</label>
					<input
						id="host-reg-no"
						bind:value={registrationNo}
						placeholder="Optional"
						class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
					/>
				</div>
				<div>
					<label for="host-tax-id" class="mb-1.5 block text-sm font-medium text-slate-700"
						>Tax ID</label
					>
					<input
						id="host-tax-id"
						bind:value={taxId}
						placeholder="Optional"
						class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
					/>
				</div>
				<div>
					<label for="host-docs-url" class="mb-1.5 block text-sm font-medium text-slate-700">
						Business documents URL
					</label>
					<input
						id="host-docs-url"
						type="url"
						bind:value={documentsUrl}
						placeholder="Optional — link to business licence, permits, certificates"
						class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
					/>
				</div>

				{#if submitError}
					<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
						<p class="text-sm text-red-600">{submitError}</p>
					</div>
				{/if}

				<div class="flex items-center gap-3 pt-2">
					<button
						type="submit"
						disabled={submitting}
						class="flex items-center justify-center gap-2 rounded-xl bg-[#0c2614] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#081b0d] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{#if submitting}
							<span
								class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
							></span>
						{/if}
						{status === 'pending' ? 'Update application' : 'Submit host application'}
					</button>
					<a
						href="/"
						class="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
					>
						Back to browsing
					</a>
				</div>
			</form>
		</div>

		<div
			class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-slate-600"
		>
			<svg
				class="mt-0.5 h-5 w-5 shrink-0 text-slate-400"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
				/>
			</svg>
			<p class="text-xs leading-relaxed">
				You can book and browse the platform as a guest or a user at any time. Hosting is an
				additional step — once your application is approved you'll be able to create hotel,
				apartment and car listings from your dashboard.
			</p>
		</div>
	{/if}
</div>
