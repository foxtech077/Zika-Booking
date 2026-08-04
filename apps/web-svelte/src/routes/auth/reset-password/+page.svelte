<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resetPassword, validatePassword, AuthApiError } from '$lib/auth-api';
	import { setSession } from '$lib/stores/auth.svelte';
	import AuthCard from '../AuthCard.svelte';

	const token = $derived(page.url.searchParams.get('token') ?? '');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let errors = $state<Record<string, string | undefined>>({});
	let submitting = $state(false);

	function handleSubmit(): void {
		const fe: Record<string, string | undefined> = {};
		const passwordErr = validatePassword(password);
		if (passwordErr) {
			fe.password = passwordErr;
		} else if (password !== confirmPassword) {
			fe.confirmPassword = 'Passwords do not match';
		}
		errors = fe;
		if (Object.values(fe).some(Boolean)) return;

		submitting = true;
		void (async () => {
			try {
				const data = await resetPassword({ token, password, confirmPassword });
				setSession(data.tokens.accessToken, data.user);
				await goto('/');
			} catch (err) {
				if (err instanceof AuthApiError) {
					if (err.code === 'TOKEN_EXPIRED') {
						errors = { general: 'This password reset link has expired. Please request a new one.' };
					} else if (err.code === 'TOKEN_USED') {
						errors = { general: 'This reset link has already been used.' };
					} else if (err.fields) {
						errors = err.fields;
					} else {
						errors = { general: err.message ?? 'Something went wrong.' };
					}
				} else {
					errors = { general: 'Something went wrong.' };
				}
			} finally {
				submitting = false;
			}
		})();
	}
</script>

{#if !token}
	<AuthCard>
		<div class="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
			<div class="mb-4 text-5xl">❌</div>
			<h1 class="mb-2 text-xl font-bold text-slate-900">Invalid link</h1>
			<p class="mb-4 text-slate-500">This password reset link is invalid.</p>
			<a href="/auth/forgot-password" class="font-semibold text-[#1D8D2B] hover:underline">
				Request a new link
			</a>
		</div>
	</AuthCard>
{:else}
	<AuthCard>
		<div class="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
			<h1 class="text-2xl font-bold text-slate-900">Set new password</h1>
			<p class="mt-1 mb-6 text-sm text-slate-500">Choose a strong password for your account.</p>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="space-y-4"
			>
				<div>
					<label for="reset-password" class="mb-1.5 block text-sm font-medium text-slate-700">
						New password
					</label>
					<div class="relative">
						<input
							id="reset-password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							placeholder="Min. 8 characters"
							autocomplete="new-password"
							class="w-full rounded-xl border bg-[#f6fdf8] px-4 py-3 pr-11 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none {errors.password
								? 'border-red-400'
								: 'border-slate-200'}"
						/>
						<button
							type="button"
							tabindex="-1"
							onclick={() => (showPassword = !showPassword)}
							class="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400 hover:text-slate-600"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{showPassword ? '🙈' : '👁️'}
						</button>
					</div>
					{#if errors.password}
						<p class="mt-1 text-xs text-red-500">{errors.password}</p>
					{/if}
				</div>

				<div>
					<label for="reset-confirm" class="mb-1.5 block text-sm font-medium text-slate-700">
						Confirm new password
					</label>
					<input
						id="reset-confirm"
						type="password"
						bind:value={confirmPassword}
						placeholder="Repeat password"
						autocomplete="new-password"
						class="w-full rounded-xl border bg-[#f6fdf8] px-4 py-3 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none {errors.confirmPassword
							? 'border-red-400'
							: 'border-slate-200'}"
					/>
					{#if errors.confirmPassword}
						<p class="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>
					{/if}
				</div>

				{#if errors.general}
					<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
						<p class="text-sm text-red-600">{errors.general}</p>
						{#if errors.general.includes('expired')}
							<a
								href="/auth/forgot-password"
								class="mt-1 block text-sm font-semibold text-[#1D8D2B]"
							>
								Request a new link →
							</a>
						{/if}
					</div>
				{/if}

				<button
					type="submit"
					disabled={submitting}
					class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c2614] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#081b0d] disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if submitting}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></span>
					{/if}
					Set new password
				</button>
			</form>
		</div>
	</AuthCard>
{/if}
