<script lang="ts">
	interface Props {
		children: import('svelte').Snippet;
	}
	let { children }: Props = $props();
</script>

<div class="flex min-h-[100dvh] min-h-screen flex-col bg-[#F8FAFC]">
	<header class="mx-auto flex w-full max-w-6xl items-center px-6 py-6">
		<a href="/" class="flex items-center gap-2.5">
			<img
				src="/kainook-logo.jpeg"
				alt="Kainook"
				class="h-9 w-9 rounded-xl ring-1 ring-slate-200"
			/>
			<span class="font-serif text-lg font-bold tracking-tight text-[#0c2614]">Kainook</span>
		</a>
	</header>
	<main class="mx-auto w-full max-w-md flex-1 px-6 pt-4 pb-16">{@render children()}</main>
</div>
