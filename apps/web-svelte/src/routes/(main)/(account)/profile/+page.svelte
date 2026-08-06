<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getMe,
		updateProfile,
		changePassword,
		validatePassword,
		AuthApiError
	} from '$lib/auth-api';
	import { auth, updateUser } from '$lib/stores/auth.svelte';
	import { ALL_COUNTRIES, getCountry } from '$lib/countries';
	import { cn, getInitials } from '$lib/utils';

	type FeedbackMsg = { type: 'success' | 'error'; text: string } | null;

	const TIER_CONFIG: Record<string, { label: string; className: string }> = {
		bronze: { label: 'Bronze', className: 'bg-amber-50 text-amber-800 border-amber-200' },
		silver: { label: 'Silver', className: 'bg-slate-100 text-slate-700 border-slate-300' },
		gold: { label: 'Gold', className: 'bg-yellow-50 text-yellow-800 border-yellow-300' },
		diamond: { label: 'Diamond', className: 'bg-cyan-50 text-cyan-800 border-cyan-200' }
	};

	let profileMsg = $state<FeedbackMsg>(null);
	let pwdMsg = $state<FeedbackMsg>(null);
	let savingProfile = $state(false);
	let savingPassword = $state(false);

	let firstName = $state('');
	let lastName = $state('');
	let country = $state('');

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	let loading = $state(true);

	onMount(async () => {
		try {
			const u = await getMe();
			updateUser(u);
			firstName = u.firstName ?? '';
			lastName = u.lastName ?? '';
			country = u.country ?? '';
		} catch {
			// fall back to the persisted user
			if (auth.user) {
				firstName = auth.user.firstName ?? '';
				lastName = auth.user.lastName ?? '';
				country = auth.user.country ?? '';
			}
		} finally {
			loading = false;
		}
	});

	const fullName = $derived(
		[auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(' ') || 'Traveller'
	);
	const initials = $derived(getInitials(fullName));
	const tier = $derived(
		TIER_CONFIG[auth.user?.currentTier?.toLowerCase() ?? 'bronze'] ?? TIER_CONFIG.bronze
	);
	const countryLabel = $derived(country ? (getCountry(country)?.name ?? country) : '—');

	function saveProfile(): void {
		if (!firstName.trim() || !lastName.trim()) {
			profileMsg = { type: 'error', text: 'First name and last name are required.' };
			return;
		}
		profileMsg = null;
		savingProfile = true;
		void (async () => {
			try {
				const u = await updateProfile({
					firstName: firstName.trim(),
					lastName: lastName.trim(),
					country: country || null
				});
				updateUser(u);
				profileMsg = { type: 'success', text: 'Profile updated successfully.' };
			} catch {
				profileMsg = { type: 'error', text: 'Profile update failed. Please try again.' };
			} finally {
				savingProfile = false;
			}
		})();
	}

	function resetProfile(): void {
		const u = auth.user;
		if (!u) return;
		firstName = u.firstName ?? '';
		lastName = u.lastName ?? '';
		country = u.country ?? '';
		profileMsg = null;
	}

	function savePassword(): void {
		if (newPassword !== confirmPassword) {
			pwdMsg = { type: 'error', text: 'New password and confirmation do not match.' };
			return;
		}
		const err = validatePassword(newPassword);
		if (err) {
			pwdMsg = { type: 'error', text: err };
			return;
		}
		pwdMsg = null;
		savingPassword = true;
		void (async () => {
			try {
				await changePassword({
					currentPassword,
					newPassword,
					confirmPassword
				});
				currentPassword = '';
				newPassword = '';
				confirmPassword = '';
				pwdMsg = { type: 'success', text: 'Password updated successfully.' };
			} catch (e) {
				pwdMsg = {
					type: 'error',
					text:
						e instanceof AuthApiError
							? e.message
							: 'Password update failed. Please verify your current password.'
				};
			} finally {
				savingPassword = false;
			}
		})();
	}

	const infoItems = $derived.by(() => [
		{ label: 'Email address', value: auth.user?.email },
		{ label: 'Account status', value: auth.user?.status },
		{ label: 'Country', value: countryLabel },
		{ label: 'Loyalty tier', value: tier.label },
		{ label: 'Loyalty points', value: (auth.user?.loyaltyPoints ?? 0).toLocaleString() }
	]);
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div class="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
		<p class="text-xs font-semibold tracking-[0.28em] text-emerald-700 uppercase">My account</p>
		<h1 class="mt-1 text-3xl font-bold text-slate-950">Profile</h1>
		<p class="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
			Manage your personal information and account security.
		</p>
	</div>

	<!-- Identity strip -->
	<div class="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
		{#if loading}
			<div class="flex animate-pulse items-center gap-4">
				<div class="h-16 w-16 rounded-full bg-slate-100"></div>
				<div class="space-y-2">
					<div class="h-5 w-44 rounded bg-slate-100"></div>
					<div class="h-4 w-32 rounded bg-slate-100"></div>
					<div class="h-5 w-24 rounded-full bg-slate-100"></div>
				</div>
			</div>
		{:else}
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-center gap-4">
					<div
						class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xl font-bold text-white shadow-md"
					>
						{initials}
					</div>
					<div>
						<h2 class="text-xl font-bold text-slate-950">{fullName}</h2>
						<p class="text-sm text-slate-500">{auth.user?.email}</p>
						<div class="mt-2 flex flex-wrap items-center gap-2">
							<span
								class={cn(
									'rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
									tier.className
								)}
							>
								{tier.label} Member
							</span>
							{#if auth.user?.emailVerified}
								<span class="flex items-center gap-1 text-xs font-medium text-emerald-700">
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
											d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
									Email verified
								</span>
							{:else}
								<span class="flex items-center gap-1 text-xs font-medium text-amber-600">
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
											d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
									Email unverified
								</span>
							{/if}
						</div>
					</div>
				</div>

				<div class="flex items-center gap-8 text-center">
					<div>
						<p class="text-2xl font-bold text-slate-950">
							{(auth.user?.loyaltyPoints ?? 0).toLocaleString()}
						</p>
						<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
							Loyalty Points
						</p>
					</div>
					<div>
						<p class="text-lg font-bold text-slate-950 capitalize">{auth.user?.status ?? '—'}</p>
						<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
							Account Status
						</p>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<div class="grid gap-6 xl:grid-cols-[440px_1fr]">
		<!-- Edit profile -->
		<div class="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
			<h3 class="text-lg font-bold text-slate-900">Edit Profile</h3>
			<p class="mt-0.5 text-sm text-slate-500">Update your personal information</p>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					saveProfile();
				}}
				class="mt-4 space-y-4"
			>
				<div>
					<label for="profile-first" class="mb-1.5 block text-sm font-medium text-slate-700">
						First name
					</label>
					<input
						id="profile-first"
						bind:value={firstName}
						maxlength="60"
						class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
					/>
				</div>
				<div>
					<label for="profile-last" class="mb-1.5 block text-sm font-medium text-slate-700">
						Last name
					</label>
					<input
						id="profile-last"
						bind:value={lastName}
						maxlength="60"
						class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
					/>
				</div>
				<div>
					<label for="profile-country" class="mb-1.5 block text-sm font-medium text-slate-700">
						Country
					</label>
					<select
						id="profile-country"
						bind:value={country}
						class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-3 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
					>
						<option value="">Select a country</option>
						{#each ALL_COUNTRIES as c (c.code)}
							<option value={c.code}>{c.name}</option>
						{/each}
					</select>
				</div>

				{#if profileMsg}
					<div
						class={cn(
							'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm',
							profileMsg.type === 'success'
								? 'border-emerald-200 bg-emerald-50 text-emerald-800'
								: 'border-red-200 bg-red-50 text-red-700'
						)}
					>
						<span>{profileMsg.text}</span>
						<button
							type="button"
							onclick={() => (profileMsg = null)}
							class="shrink-0 text-xs underline opacity-70 hover:opacity-100"
						>
							Dismiss
						</button>
					</div>
				{/if}

				<div class="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
					<button
						type="button"
						onclick={resetProfile}
						disabled={savingProfile}
						class="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
					>
						Reset
					</button>
					<button
						type="submit"
						disabled={savingProfile}
						class="flex items-center gap-2 rounded-xl bg-[#16a34a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{#if savingProfile}
							<span
								class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
							></span>
						{/if}
						Save changes
					</button>
				</div>
			</form>
		</div>

		<!-- Right column -->
		<div class="space-y-6">
			<!-- Account info (read-only) -->
			<div class="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
				<h3 class="text-lg font-bold text-slate-900">Account Information</h3>
				<p class="mt-0.5 text-sm text-slate-500">Read-only details from your account</p>
				<dl class="mt-4 grid gap-4 sm:grid-cols-2">
					{#each infoItems as item (item.label)}
						<div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
							<dt class="text-[11px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
								{item.label}
							</dt>
							<dd class="mt-2 text-sm font-semibold text-slate-900 capitalize">
								{item.value ?? '—'}
							</dd>
						</div>
					{/each}
				</dl>
			</div>

			<!-- Change password -->
			<div class="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
				<h3 class="text-lg font-bold text-slate-900">Change Password</h3>
				<p class="mt-0.5 text-sm text-slate-500">Use a strong password you don't reuse elsewhere</p>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						savePassword();
					}}
					class="mt-4 space-y-4"
				>
					<div>
						<label for="pwd-current" class="mb-1.5 block text-sm font-medium text-slate-700">
							Current password
						</label>
						<input
							id="pwd-current"
							type="password"
							bind:value={currentPassword}
							autocomplete="current-password"
							class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
						/>
					</div>
					<div>
						<label for="pwd-new" class="mb-1.5 block text-sm font-medium text-slate-700">
							New password
						</label>
						<input
							id="pwd-new"
							type="password"
							bind:value={newPassword}
							autocomplete="new-password"
							placeholder="At least 8 characters"
							class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
						/>
					</div>
					<div>
						<label for="pwd-confirm" class="mb-1.5 block text-sm font-medium text-slate-700">
							Confirm new password
						</label>
						<input
							id="pwd-confirm"
							type="password"
							bind:value={confirmPassword}
							autocomplete="new-password"
							class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
						/>
					</div>

					{#if pwdMsg}
						<div
							class={cn(
								'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm',
								pwdMsg.type === 'success'
									? 'border-emerald-200 bg-emerald-50 text-emerald-800'
									: 'border-red-200 bg-red-50 text-red-700'
							)}
						>
							<span>{pwdMsg.text}</span>
							<button
								type="button"
								onclick={() => (pwdMsg = null)}
								class="shrink-0 text-xs underline opacity-70 hover:opacity-100"
							>
								Dismiss
							</button>
						</div>
					{/if}

					<div class="flex justify-end border-t border-slate-100 pt-3">
						<button
							type="submit"
							disabled={savingPassword}
							class="flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{#if savingPassword}
								<span
									class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#1D8D2B]"
								></span>
							{/if}
							Update password
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
</div>
