<script lang="ts">
	import { forgotPassword } from '$lib/auth-api';
	import AuthCard from '../AuthCard.svelte';

	let email = $state('');
	let sent = $state(false);
	let sending = $state(false);

	function handleSubmit(): void {
		if (!email.includes('@')) return;
		sending = true;
		void (async () => {
			try {
				await forgotPassword(email);
			} catch {
				// Always show success (BR: enumeration prevention)
			} finally {
				sending = false;
				sent = true;
			}
		})();
	}
</script>

{#if sent}
	<AuthCard>
		<div class="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
			<div class="mb-4 text-5xl">📧</div>
			<h1 class="mb-2 text-2xl font-bold text-slate-900">Check your email</h1>
			<p class="mb-6 text-slate-500">
				If an account with that email exists, we've sent a password reset link. The link expires in
				1 hour.
			</p>
			<a href="/auth/login" class="font-semibold text-[#1D8D2B] hover:underline">Back to Sign In</a>
		</div>
	</AuthCard>
{:else}
	<AuthCard>
		<div class="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
			<h1 class="text-2xl font-bold text-slate-900">Reset password</h1>
			<p class="mt-1 mb-6 text-sm text-slate-500">
				Enter your email and we'll send you a reset link.
			</p>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
			>
				<label for="forgot-email" class="mb-1.5 block text-sm font-medium text-slate-700">
					Email address
				</label>
				<input
					id="forgot-email"
					type="email"
					bind:value={email}
					placeholder="you@example.com"
					autocomplete="email"
					class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-3 text-sm transition placeholder:text-slate-400 focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
				/>
				<button
					type="submit"
					disabled={!email.includes('@') || sending}
					class="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c2614] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#081b0d] disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if sending}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></span>
					{/if}
					Send reset link
				</button>
			</form>

			<p class="mt-6 text-center text-sm text-slate-500">
				<a href="/auth/login" class="font-semibold text-[#1D8D2B] hover:underline"
					>Back to Sign In</a
				>
			</p>
		</div>
	</AuthCard>
{/if}
