<script lang="ts">
	import { page } from '$app/state';
	import { resendVerification, AuthApiError } from '$lib/auth-api';
	import AuthCard from '../AuthCard.svelte';

	const email = $derived(page.url.searchParams.get('email') ?? '');
	let success = $state(false);
	let error = $state<string | null>(null);
	let sending = $state(false);

	function handleResend(): void {
		error = null;
		sending = true;
		void (async () => {
			try {
				await resendVerification(email);
				success = true;
			} catch (err) {
				error = err instanceof AuthApiError ? err.message : 'Failed to resend verification email.';
			} finally {
				sending = false;
			}
		})();
	}
</script>

<AuthCard>
	<div class="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
		<div class="mb-4 text-5xl">✉️</div>
		<h1 class="mb-2 text-2xl font-bold text-slate-900">Verify your email</h1>
		<p class="mb-6 text-slate-500">
			A verification link was sent to
			<strong class="text-slate-800">{email || 'your email'}</strong>. Please click the link to
			activate your account.
		</p>

		{#if success}
			<div class="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
				<p class="text-sm text-green-600">A new verification link has been sent!</p>
			</div>
		{/if}

		{#if error}
			<div class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
				<p class="text-sm text-red-600">{error}</p>
			</div>
		{/if}

		<button
			type="button"
			onclick={handleResend}
			disabled={!email || success || sending}
			class="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c2614] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#081b0d] disabled:cursor-not-allowed disabled:opacity-60"
		>
			{#if sending}
				<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
				></span>
			{/if}
			Resend verification email
		</button>

		<a href="/auth/login" class="block text-sm font-semibold text-[#1D8D2B] hover:underline">
			Back to Sign In
		</a>
	</div>
</AuthCard>
