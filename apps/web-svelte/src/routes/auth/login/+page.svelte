<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { login, oauthGoogle, AuthApiError } from '$lib/auth-api';
	import { auth, setSession } from '$lib/stores/auth.svelte';

	// Web Application OAuth client — identical to the `webClientId` the mobile
	// app configures and to the audience auth-service verifies id_tokens against.
	// Client IDs are public, not secrets.
	const GOOGLE_CLIENT_ID_WEB =
		'1022728776661-50ctighki9jm25ig10b39matcr0ihslr.apps.googleusercontent.com';

	interface GoogleIdentityServices {
		accounts: {
			id: {
				initialize(opts: {
					client_id: string;
					callback: (r: { credential: string }) => void;
				}): void;
				renderButton(el: HTMLElement, opts: Record<string, string | number | boolean>): void;
			};
		};
	}

	function gsi(): GoogleIdentityServices | null {
		return (window as unknown as { google?: GoogleIdentityServices })?.google ?? null;
	}

	let gsiReady = $state(false);
	let googleLoading = $state(false);
	let googleBtnRef = $state<HTMLDivElement | null>(null);
	let appleModalOpen = $state(false);

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let error = $state<string | null>(null);
	let submitting = $state(false);

	const next = $derived(page.url.searchParams.get('next') ?? '/');

	function postLoginPath(user: { requiresPrivacyAcceptance?: boolean }): string {
		if (user.requiresPrivacyAcceptance) {
			return `/auth/accept-terms?next=${encodeURIComponent(next)}`;
		}
		return next;
	}

	function accountAccessError(user: { emailVerified?: boolean; status?: string }): string | null {
		if (!user.emailVerified || user.status === 'pending_verification') {
			return 'Please verify your email address to sign in.';
		}
		if (user.status === 'suspended') {
			return 'Your account has been suspended. Please contact support for assistance.';
		}
		if (user.status === 'banned') {
			return 'Your account has been permanently removed from Kainook.';
		}
		return null;
	}

	function handleGoogleCredential(response: { credential: string }): void {
		error = null;
		googleLoading = true;
		void (async () => {
			try {
				const data = await oauthGoogle(response.credential);
				const accessError = accountAccessError(data.user);
				if (accessError) {
					error = accessError;
					googleLoading = false;
					return;
				}
				setSession(data.tokens.accessToken, data.user);
				await goto(postLoginPath(data.user));
			} catch (err) {
				googleLoading = false;
				error =
					err instanceof AuthApiError
						? err.message
						: 'Sign in with Google failed. Please try again.';
			}
		})();
	}

	onMount(() => {
		// Already signed in? Don't show the login form — send the user to the
		// landing page (or wherever the `next` param points). onMount runs once
		// before the login flow flips auth state, so it never fires during an
		// in-page login.
		if (auth.isAuthenticated) {
			void goto(next);
			return;
		}
		const script = document.createElement('script');
		script.src = 'https://accounts.google.com/gsi/client';
		script.async = true;
		script.defer = true;
		script.onload = () => {
			const google = gsi();
			if (google) {
				google.accounts.id.initialize({
					client_id: GOOGLE_CLIENT_ID_WEB,
					callback: handleGoogleCredential
				});
			}
			gsiReady = true;
		};
		document.body.appendChild(script);
		return () => {
			document.body.removeChild(script);
		};
	});

	// Re-render the Google button once the SDK is ready and its mount point exists.
	$effect(() => {
		const google = gsi();
		if (!gsiReady || !googleBtnRef || !google) return;
		const el = googleBtnRef;
		el.innerHTML = '';
		google.accounts.id.renderButton(el, {
			theme: 'outline',
			size: 'large',
			width: 384,
			text: 'continue_with',
			shape: 'rectangular'
		});
	});

	function handleSubmit(): void {
		if (!email || !password) {
			error = 'Please enter your email and password.';
			return;
		}
		error = null;
		submitting = true;
		void (async () => {
			try {
				const data = await login({ email, password });
				const accessError = accountAccessError(data.user);
				if (accessError) {
					error = accessError;
					return;
				}
				setSession(data.tokens.accessToken, data.user);
				await goto(postLoginPath(data.user));
			} catch (err) {
				if (err instanceof AuthApiError) {
					if (err.code === 'EMAIL_NOT_VERIFIED') {
						await goto(`/auth/verify-pending?email=${encodeURIComponent(email)}`);
						return;
					}
					if (err.code === 'ACCOUNT_PENDING_APPROVAL') {
						await goto('/');
						return;
					}
					error = err.message;
				} else {
					error = 'Unable to connect. Please check your network and try again.';
				}
			} finally {
				submitting = false;
			}
		})();
	}

	const trustPoints = [
		'Instant confirmation on every booking',
		'Verified stays, homes and car rentals',
		'Your data protected end to end'
	];
</script>

<div class="relative min-h-[100dvh] min-h-screen w-full bg-white lg:grid lg:grid-cols-[1.05fr_1fr]">
	<!-- ── Left: full-bleed brand panel (desktop) ── -->
	<aside class="relative hidden overflow-hidden lg:sticky lg:top-0 lg:block lg:h-screen">
		<img
			src="/Login.webp"
			alt=""
			class="absolute inset-0 h-full w-full object-cover"
			loading="eager"
		/>
		<!-- Layered scrim — keeps the photo readable behind text without flattening it -->
		<div
			class="absolute inset-0 bg-gradient-to-t from-[#03301f] via-[#03301f]/60 to-[#03301f]/20"
		></div>
		<div
			class="absolute inset-0 bg-[radial-gradient(115%_75%_at_50%_0%,transparent_35%,rgba(3,48,31,0.5)_100%)]"
		></div>

		<div class="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
			<a href="/" class="flex w-fit items-center gap-3">
				<img
					src="/kainook-logo.jpeg"
					alt="Kainook"
					class="h-12 w-12 rounded-2xl ring-1 ring-white/20"
				/>
				<span class="text-xl font-bold tracking-[0.16em] text-white">KAINOOK</span>
			</a>

			<div class="max-w-md">
				<h2 class="text-4xl leading-[1.08] font-bold tracking-tight text-white xl:text-5xl">
					Welcome back.
				</h2>
				<p class="mt-4 text-base leading-relaxed text-white/75">
					Pick up where you left off — your trips, your saved stays and your rewards, all in one
					place.
				</p>

				<ul class="mt-10 space-y-3.5">
					{#each trustPoints as point (point)}
						<li class="flex items-center gap-3 text-sm text-white/80">
							<span
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4ade80]/15 ring-1 ring-[#4ade80]/30"
							>
								<svg
									class="h-3.5 w-3.5 text-[#4ade80]"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2.5"
										d="M4.5 12.75l6 6 9-13.5"
									/>
								</svg>
							</span>
							{point}
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</aside>

	<!-- ── Right: form ── -->
	<main class="flex min-h-[100dvh] min-h-screen flex-col lg:h-screen lg:overflow-y-auto">
		<!-- Mobile hero — same photograph, compact -->
		<div class="relative h-44 w-full shrink-0 overflow-hidden lg:hidden">
			<img src="/Login.webp" alt="" class="absolute inset-0 h-full w-full object-cover" />
			<div
				class="absolute inset-0 bg-gradient-to-t from-[#03301f] via-[#03301f]/65 to-[#03301f]/25"
			></div>
			<div class="absolute inset-0 flex flex-col justify-center px-6 sm:px-8">
				<a href="/" class="flex w-fit items-center gap-2.5">
					<img
						src="/kainook-logo.jpeg"
						alt="Kainook"
						class="h-9 w-9 rounded-xl ring-1 ring-white/20"
					/>
					<span class="text-base font-bold tracking-[0.16em] text-white">KAINOOK</span>
				</a>
				<h2 class="mt-3 text-2xl font-bold tracking-tight text-white">Welcome back.</h2>
			</div>
		</div>

		<div class="mx-auto my-auto w-full max-w-[600px] px-6 py-10 sm:px-8 lg:px-10 lg:py-14">
			<div class="mb-8">
				<h1 class="text-[26px] font-bold tracking-tight text-gray-900">Sign in</h1>
				<p class="mt-1.5 text-sm text-gray-500">Enter your details to access your account.</p>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				novalidate
				class="space-y-4"
			>
				<!-- Email -->
				<div>
					<label for="login-email" class="mb-1.5 block text-sm font-medium text-gray-700">
						Email address
					</label>
					<div class="relative">
						<span
							class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-gray-400"
						>
							<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.8"
									d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
								/>
							</svg>
						</span>
						<input
							id="login-email"
							type="email"
							bind:value={email}
							placeholder="you@example.com"
							autocomplete="email"
							class="w-full rounded-xl border border-gray-200 bg-[#f6fdf8] py-3.5 pr-4 pl-10 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/25 focus:outline-none"
						/>
					</div>
				</div>

				<!-- Password -->
				<div>
					<div class="mb-1.5 flex items-baseline justify-between">
						<label for="login-password" class="text-sm font-medium text-gray-700"> Password </label>
						<a
							href="/auth/forgot-password"
							class="text-xs font-medium text-[#16a34a] hover:underline"
						>
							Forgot password?
						</a>
					</div>
					<div class="relative">
						<span
							class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-gray-400"
						>
							<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.8"
									d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
								/>
							</svg>
						</span>
						<input
							id="login-password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							placeholder="••••••••"
							autocomplete="current-password"
							class="w-full rounded-xl border border-gray-200 bg-[#f6fdf8] py-3.5 pr-11 pl-10 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/25 focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							<svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.8"
									d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
								/>
							</svg>
						</button>
					</div>
				</div>

				<!-- Error -->
				{#if error}
					<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
						<p class="text-sm text-red-600">{error}</p>
					</div>
				{/if}

				<!-- Submit -->
				<button
					id="login-submit-btn"
					type="submit"
					disabled={submitting}
					class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] py-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#15803d] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if submitting}
						<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
						</svg>
						Signing in…
					{:else}
						Sign In
					{/if}
				</button>
			</form>

			<!-- Divider -->
			<div class="relative my-6">
				<div class="absolute inset-0 flex items-center">
					<div class="w-full border-t border-gray-200"></div>
				</div>
				<div class="relative flex justify-center">
					<span class="bg-white px-3 text-xs tracking-wider text-gray-400 uppercase">
						or continue with
					</span>
				</div>
			</div>

			<!-- Google — two stacked layers: a proxy div the SDK renders into
			     (invisible, catches clicks) over a static styled fallback. -->
			<div class="relative mb-2.5 h-12 w-full">
				<div
					aria-hidden="true"
					class={`pointer-events-none absolute inset-0 flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm transition-opacity ${googleLoading ? 'opacity-70' : ''}`}
				>
					{#if googleLoading}
						<svg class="h-4 w-4 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
						</svg>
						Signing in…
					{:else}
						<svg class="h-[18px] w-[18px]" viewBox="0 0 48 48">
							<path
								fill="#FFC107"
								d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
							/>
							<path
								fill="#FF3D00"
								d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
							/>
							<path
								fill="#4CAF50"
								d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
							/>
							<path
								fill="#1976D2"
								d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
							/>
						</svg>
						Continue with Google
					{/if}
				</div>
				<div
					bind:this={googleBtnRef}
					class={`google-btn-proxy absolute inset-0 overflow-hidden opacity-0 ${googleLoading ? 'pointer-events-none' : ''}`}
				></div>
			</div>

			<!-- Apple -->
			<button
				id="login-apple-btn"
				type="button"
				onclick={() => (appleModalOpen = true)}
				class="flex w-full items-center justify-center gap-2.5 rounded-xl bg-black py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-gray-900"
			>
				<svg class="h-[18px] w-[18px] fill-current" viewBox="0 0 24 24">
					<path
						d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.62.71-1.16 1.85-1.02 2.97 1.1.09 2.23-.55 2.97-1.41z"
					/>
				</svg>
				Sign in with Apple
			</button>

			<p class="mt-8 text-center text-sm text-gray-500">
				Don't have an account?
				<a href="/auth/register" class="font-semibold text-[#16a34a] hover:underline">
					Create one
				</a>
			</p>
		</div>
	</main>

	<!-- Apple Modal -->
	{#if appleModalOpen}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
				<h3 class="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
					<svg class="h-5 w-5 fill-current" viewBox="0 0 24 24">
						<path
							d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.62.71-1.16 1.85-1.02 2.97 1.1.09 2.23-.55 2.97-1.41z"
						/>
					</svg>
					Sign In with Apple (Web)
				</h3>
				<p class="text-sm leading-relaxed text-gray-500">
					Apple Sign-In on web operates via HTTP POST redirects which are restricted to verified,
					production-grade HTTPS domains.
					<br /><br />
					This feature is fully implemented on our backend and mobile clients. For local web testing,
					please sign in using Google or Email/Password.
				</p>
				<button
					type="button"
					onclick={() => (appleModalOpen = false)}
					class="mt-5 w-full rounded-xl bg-[#16a34a] py-2.5 text-sm font-semibold text-white transition hover:bg-[#15803d]"
				>
					Close
				</button>
			</div>
		</div>
	{/if}
</div>
