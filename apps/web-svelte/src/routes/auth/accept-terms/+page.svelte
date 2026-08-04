<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { acceptTerms, AuthApiError } from '$lib/auth-api';
	import { auth, updateUser, clearSession } from '$lib/stores/auth.svelte';
	import AuthCard from '../AuthCard.svelte';

	const next = $derived(page.url.searchParams.get('next') ?? '/');
	let agreedToPrivacy = $state(false);
	let error = $state<string | null>(null);
	let redirecting = $state(false);

	function handleContinue(): void {
		if (!agreedToPrivacy) {
			error = 'Please accept the Privacy Policy to continue.';
			return;
		}
		error = null;
		redirecting = true;
		void (async () => {
			try {
				const data = await acceptTerms({ acceptedPrivacy: true });
				updateUser({
					requiresPrivacyAcceptance: false,
					privacyAcceptedAt: data.acceptedAt
				});
				await goto(next);
			} catch (err) {
				redirecting = false;
				error =
					err instanceof AuthApiError
						? err.message
						: 'Could not save your acceptance. Please try again.';
			}
		})();
	}

	function handleSignOut(): void {
		clearSession();
		void goto('/auth/login');
	}
</script>

<AuthCard>
	<div class="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
		<h1 class="text-xl font-bold text-slate-900">Before you continue</h1>
		<p class="mt-2 text-sm text-slate-600">
			{auth.user?.firstName ? `${auth.user.firstName}, please` : 'Please'} review and accept our Privacy
			Policy to continue. We only need this once.
		</p>

		<div class="mt-6 space-y-4">
			<label class="flex cursor-pointer items-start gap-3">
				<input
					type="checkbox"
					bind:checked={agreedToPrivacy}
					class="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#1D8D2B]"
				/>
				<span class="text-sm text-slate-700">
					I have read and agree to the
					<a
						href="/legal/privacy"
						target="_blank"
						rel="noopener noreferrer"
						class="font-semibold text-[#1D8D2B] underline"
					>
						Privacy Policy
					</a>
					.
				</span>
			</label>
		</div>

		{#if error}
			<p class="mt-4 text-sm text-red-600">{error}</p>
		{/if}

		<button
			type="button"
			onclick={handleContinue}
			disabled={!agreedToPrivacy || redirecting}
			class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D8D2B] py-3 text-sm font-semibold text-white transition hover:bg-[#166f22] disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if redirecting}
				<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
				></span>
				Saving…
			{:else}
				Accept and continue
			{/if}
		</button>

		<button
			type="button"
			onclick={handleSignOut}
			disabled={redirecting}
			class="mt-3 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Sign out
		</button>
	</div>
</AuthCard>
