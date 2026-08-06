<script lang="ts">
	import { goto } from '$app/navigation';
	import { register, validateEmail, validatePassword, AuthApiError } from '$lib/auth-api';
	import { setSession } from '$lib/stores/auth.svelte';
	import AuthCard from '../AuthCard.svelte';

	let firstName = $state('');
	let lastName = $state('');
	let email = $state('');
	let dob = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let agreedToPrivacy = $state(false);
	let submitted = $state(false);

	let errors = $state<Record<string, string | undefined>>({});
	let submitting = $state(false);

	const is18OrOver = $derived.by(() => {
		if (!dob) return false;
		const birthDate = new Date(dob);
		if (isNaN(birthDate.getTime())) return false;
		const today = new Date();
		let age = today.getFullYear() - birthDate.getFullYear();
		const m = today.getMonth() - birthDate.getMonth();
		if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
		return age >= 18;
	});

	function handleSubmit(): void {
		const fe: Record<string, string | undefined> = {};

		if (!firstName.trim()) fe.firstName = 'First name is required';
		if (!lastName.trim()) fe.lastName = 'Last name is required';

		const emailErr = validateEmail(email);
		if (emailErr) fe.email = emailErr;

		if (!dob) {
			fe.dob = 'Date of birth is required';
		} else if (!is18OrOver) {
			fe.dob = 'You must be 18 years or older to register.';
		}

		const passwordErr = validatePassword(password);
		if (passwordErr) {
			fe.password = passwordErr;
		} else if (password !== confirmPassword) {
			fe.confirmPassword = 'Passwords do not match';
		}

		if (!agreedToPrivacy) fe.general = 'You must accept the Privacy Policy to continue.';

		errors = fe;
		if (Object.values(fe).some(Boolean)) return;

		submitting = true;
		void (async () => {
			try {
				const data = await register({
					firstName: firstName.trim(),
					lastName: lastName.trim(),
					email: email.trim().toLowerCase(),
					password,
					confirmPassword,
					dob,
					acceptedPrivacy: agreedToPrivacy
				});
				if (data.tokens?.accessToken && data.user) {
					setSession(data.tokens.accessToken, data.user);
					await goto('/');
					return;
				}
				submitted = true;
			} catch (err) {
				if (err instanceof AuthApiError) {
					errors = { ...err.fields, general: err.fields ? undefined : err.message };
				} else {
					errors = { general: 'Unable to connect. Please try again.' };
				}
			} finally {
				submitting = false;
			}
		})();
	}
</script>

{#if submitted}
	<AuthCard>
		<div class="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
			<div
				class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#1D8D2B]/10"
			>
				<svg class="h-8 w-8 text-[#1D8D2B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.8"
						d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
					/>
				</svg>
			</div>
			<h1 class="mb-2 text-2xl font-bold tracking-tight text-slate-900">Check your email</h1>
			<p class="mb-1 text-sm text-slate-500">We've sent a verification link to</p>
			<p class="mb-5 font-semibold text-slate-800">{email}</p>
			<p class="mb-7 text-xs leading-relaxed text-slate-400">
				Click the link in your email to activate your account. It expires in 24 hours.
			</p>
			<a
				href="/auth/login"
				class="inline-block w-full rounded-xl bg-[#1D8D2B] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#166f22]"
			>
				Back to Sign In
			</a>
		</div>
	</AuthCard>
{:else}
	<AuthCard>
		<div class="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
			<h1 class="text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
			<p class="mt-1 text-sm text-slate-500">It takes less than a minute to get started.</p>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="mt-6 space-y-3"
			>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="reg-firstname" class="mb-1.5 block text-xs font-medium text-slate-700">
							First name
						</label>
						<input
							id="reg-firstname"
							bind:value={firstName}
							placeholder="Ada"
							autocomplete="given-name"
							class="w-full rounded-xl border bg-[#f6fdf8] px-3 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none {errors.firstName
								? 'border-red-400'
								: 'border-slate-200'}"
						/>
						{#if errors.firstName}
							<p class="mt-1 text-xs text-red-500">{errors.firstName}</p>
						{/if}
					</div>
					<div>
						<label for="reg-lastname" class="mb-1.5 block text-xs font-medium text-slate-700">
							Last name
						</label>
						<input
							id="reg-lastname"
							bind:value={lastName}
							placeholder="Okafor"
							autocomplete="family-name"
							class="w-full rounded-xl border bg-[#f6fdf8] px-3 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none {errors.lastName
								? 'border-red-400'
								: 'border-slate-200'}"
						/>
						{#if errors.lastName}
							<p class="mt-1 text-xs text-red-500">{errors.lastName}</p>
						{/if}
					</div>
				</div>

				<div>
					<label for="reg-email" class="mb-1.5 block text-xs font-medium text-slate-700">
						Email address
					</label>
					<input
						id="reg-email"
						type="email"
						bind:value={email}
						placeholder="you@example.com"
						autocomplete="email"
						class="w-full rounded-xl border bg-[#f6fdf8] px-3 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none {errors.email
							? 'border-red-400'
							: 'border-slate-200'}"
					/>
					{#if errors.email}
						<p class="mt-1 text-xs text-red-500">{errors.email}</p>
					{/if}
				</div>

				<div>
					<label for="reg-dob" class="mb-1.5 block text-xs font-medium text-slate-700">
						Date of Birth
					</label>
					<input
						id="reg-dob"
						type="date"
						bind:value={dob}
						class="w-full rounded-xl border bg-[#f6fdf8] px-3 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none {errors.dob
							? 'border-red-400'
							: 'border-slate-200'}"
					/>
					{#if errors.dob}
						<p class="mt-1 text-xs text-red-500">{errors.dob}</p>
					{/if}
				</div>

				<div>
					<label for="reg-password" class="mb-1.5 block text-xs font-medium text-slate-700">
						Password
					</label>
					<div class="relative">
						<input
							id="reg-password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							placeholder="Min. 8 chars"
							autocomplete="new-password"
							class="w-full rounded-xl border bg-[#f6fdf8] px-3 py-2.5 pr-9 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none {errors.password
								? 'border-red-400'
								: 'border-slate-200'}"
						/>
						<button
							type="button"
							tabindex="-1"
							onclick={() => (showPassword = !showPassword)}
							class="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
					<label for="reg-confirm-password" class="mb-1.5 block text-xs font-medium text-slate-700">
						Confirm password
					</label>
					<div class="relative">
						<input
							id="reg-confirm-password"
							type={showConfirmPassword ? 'text' : 'password'}
							bind:value={confirmPassword}
							placeholder="Repeat password"
							autocomplete="new-password"
							class="w-full rounded-xl border bg-[#f6fdf8] px-3 py-2.5 pr-9 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none {errors.confirmPassword
								? 'border-red-400'
								: 'border-slate-200'}"
						/>
						<button
							type="button"
							tabindex="-1"
							onclick={() => (showConfirmPassword = !showConfirmPassword)}
							class="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600"
							aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
						>
							{showConfirmPassword ? '🙈' : '👁️'}
						</button>
					</div>
					{#if errors.confirmPassword}
						<p class="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>
					{/if}
				</div>

				{#if errors.general}
					<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
						<p class="text-sm text-red-600">{errors.general}</p>
					</div>
				{/if}

				<label class="flex cursor-pointer items-start gap-2.5">
					<input
						id="agree-privacy"
						type="checkbox"
						bind:checked={agreedToPrivacy}
						class="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#1D8D2B]"
					/>
					<span class="text-xs leading-relaxed text-slate-600">
						I have read and accept the
						<a
							href="/legal/privacy"
							target="_blank"
							rel="noopener noreferrer"
							class="font-semibold text-[#1D8D2B] hover:underline"
						>
							Privacy Policy
						</a>
						.
					</span>
				</label>

				<button
					id="register-submit-btn"
					type="submit"
					disabled={submitting || !agreedToPrivacy || !is18OrOver}
					class="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c2614] py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#081b0d] disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if submitting}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></span>
						Creating Account…
					{:else}
						Create Account
					{/if}
				</button>
			</form>

			<p class="mt-5 text-center text-sm text-slate-500">
				Already have an account?
				<a href="/auth/login" class="font-semibold text-[#1D8D2B] hover:underline">Sign In</a>
			</p>
		</div>
	</AuthCard>
{/if}
