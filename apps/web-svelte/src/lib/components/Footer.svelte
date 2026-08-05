<footer class="bg-[#0c2614] py-14 text-green-300/70">
	<div class="mx-auto max-w-7xl px-4 sm:px-6">
		<div class="mb-10 grid grid-cols-1 items-start gap-8 md:grid-cols-3 md:gap-12">
			<div class="max-w-sm">
				<p class="mb-1 font-serif text-xl font-light text-white">Kainook</p>
				<p class="mb-3 text-[10px] tracking-[0.2em] text-[#58B430]/70 uppercase">
					Private Collections
				</p>
				<p class="text-xs leading-relaxed">
					Redefining the standards of luxury travel through curated storytelling and architectural
					excellence.
				</p>
			</div>
			<div>
				<p class="mb-4 text-[10px] font-semibold tracking-[0.25em] text-white uppercase">Explore</p>
				<ul class="space-y-2.5 text-xs">
					{#each ['Destinations', 'Hotels', 'Villas', 'Car Rentals', 'Experiences'] as l (l)}
						<li><a href="/" class="transition-colors hover:text-white">{l}</a></li>
					{/each}
				</ul>
			</div>
			<div>
				<p class="mb-4 text-[10px] font-semibold tracking-[0.25em] text-white uppercase">Kainook</p>
				<ul class="space-y-2.5 text-xs">
					{#each ['Our Story', 'Sustainability', 'Rewards Program', 'Press & Media', 'Contact Us'] as l (l)}
						<li><a href="/" class="transition-colors hover:text-white">{l}</a></li>
					{/each}
				</ul>
			</div>
		</div>
		<div
			class="flex flex-col items-center justify-between gap-4 border-t border-[#081b0d]/60 pt-6 sm:flex-row"
		>
			<p class="text-[10px] tracking-wide">
				© {new Date().getFullYear()} Kainook · All rights reserved.
			</p>
			<div class="flex flex-wrap items-center gap-4 text-[10px]">
				<a href="/legal/privacy" class="transition-colors hover:text-white">Privacy</a>
				<a href="/legal/terms" class="transition-colors hover:text-white">Terms</a>
				<a href="/delete-account" class="transition-colors hover:text-white">Delete account</a>
			</div>
		</div>
	</div>
</footer>
