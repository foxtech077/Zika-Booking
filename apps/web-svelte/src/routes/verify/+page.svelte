<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { verifyEmail, AuthApiError } from '$lib/auth-api';
	import { setSession } from '$lib/stores/auth.svelte';

	let status = $state('loading');
	let email = $state<string | null>(null);
	const token = $derived(page.url.searchParams.get('token') ?? '');

	onMount(() => {
		if (!token || token.length !== 64) {
			status = 'invalid';
			return;
		}
		void (async () => {
			try {
				const data = await verifyEmail(token);
				setSession(data.tokens.accessToken, data.user);
				status = data.message.includes('already') ? 'already_verified' : 'success';
				email = data.user.email;
				setTimeout(() => void goto('/'), 2000);
			} catch (err) {
				if (err instanceof AuthApiError) {
					if (err.code === 'TOKEN_EXPIRED') {
						// The error body carries the email so "Send a new link"
						// always works, even when the user never reached success.
						email = err.fields?.email ?? email;
						status = 'expired';
					} else if (err.code === 'TOKEN_USED') status = 'used';
					else if (err.code === 'INVALID_TOKEN') status = 'invalid';
					else status = 'error';
				} else {
					status = 'error';
				}
			}
		})();
	});
</script>

<svelte:head>
	<title>Verify email | Kainook</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4">
	<div
		class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
	>
		{#if status === 'loading'}
			<div class="mb-4 text-5xl">⏳</div>
			<h1 class="mb-3 text-2xl font-bold text-slate-900">Verifying your email…</h1>
			<p class="text-slate-500">Please wait a moment.</p>
		{:else if status === 'success'}
			<div class="mb-4 text-5xl">🎉</div>
			<h1 class="mb-3 text-2xl font-bold text-slate-900">Email verified!</h1>
			<p class="text-slate-500">Welcome to Kainook! Redirecting you now…</p>
		{:else if status === 'already_verified'}
			<div class="mb-4 text-5xl">✅</div>
			<h1 class="mb-3 text-2xl font-bold text-slate-900">Already verified</h1>
			<p class="text-slate-500">You're already verified. Redirecting…</p>
		{:else if status === 'expired'}
			<div class="mb-4 text-5xl">⌛</div>
			<h1 class="mb-3 text-2xl font-bold text-slate-900">Link expired</h1>
			<div class="space-y-4">
				<p class="text-slate-500">
					Your verification link has expired (links are valid for 24 hours).
				</p>
				{#if email}
					<a
						href={`/auth/verify-pending?email=${encodeURIComponent(email)}`}
						class="inline-block rounded-lg bg-[#1D8D2B] px-6 py-2.5 font-semibold text-white"
					>
						Send a new link
					</a>
				{:else}
					<a href="/auth/login" class="inline-block font-semibold text-[#1D8D2B]">
						Back to Sign In
					</a>
				{/if}
			</div>
		{:else if status === 'used'}
			<div class="mb-4 text-5xl">🔒</div>
			<h1 class="mb-3 text-2xl font-bold text-slate-900">Link already used</h1>
			<div class="space-y-4">
				<p class="text-slate-500">This verification link has already been used.</p>
				<a href="/auth/login" class="inline-block font-semibold text-[#1D8D2B]">
					Sign in to your account
				</a>
			</div>
		{:else if status === 'invalid'}
			<div class="mb-4 text-5xl">❌</div>
			<h1 class="mb-3 text-2xl font-bold text-slate-900">Invalid link</h1>
			<div class="space-y-4">
				<p class="text-slate-500">This verification link is invalid.</p>
				<a href="/auth/register" class="inline-block font-semibold text-[#1D8D2B]">
					Create an account
				</a>
			</div>
		{:else}
			<div class="mb-4 text-5xl">⚠️</div>
			<h1 class="mb-3 text-2xl font-bold text-slate-900">Something went wrong</h1>
			<p class="text-slate-500">
				Please try clicking the link again, or
				<a href="/auth/login" class="font-semibold text-[#1D8D2B]">sign in</a>.
			</p>
		{/if}
	</div>
</div>
