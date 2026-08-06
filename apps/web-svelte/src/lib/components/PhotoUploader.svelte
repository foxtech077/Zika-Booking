<script lang="ts">
	import { presignPhoto, confirmPhoto, deletePhoto, reorderPhotos } from '$lib/provider-api';

	let {
		listingId,
		photos = [],
		onChange
	}: {
		listingId: string;
		photos: { id: string; cdnUrl: string; position: number }[];
		onChange: () => void;
	} = $props();

	let uploading = $state(false);
	let uploadingName = $state('');
	let notice = $state('');
	let error = $state('');

	async function handleFiles(files: FileList | null): Promise<void> {
		if (!files || files.length === 0) return;
		error = '';
		for (const file of Array.from(files)) {
			if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
				error = 'Only JPEG, PNG and WEBP images are accepted.';
				continue;
			}
			if (file.size > 5 * 1024 * 1024) {
				error = 'Each photo must be under 5 MB.';
				continue;
			}
			uploading = true;
			uploadingName = file.name;
			try {
				const { uploadUrl, s3Key } = await presignPhoto(
					listingId,
					file.type,
					file.name,
					file.size
				);
				const res = await fetch(uploadUrl, {
					method: 'PUT',
					body: file,
					headers: { 'Content-Type': file.type }
				});
				if (!res.ok) throw new Error('S3 upload failed');
				await confirmPhoto(listingId, s3Key);
				notice = `${file.name} uploaded.`;
				onChange();
			} catch {
				error = `Could not upload ${file.name}.`;
			} finally {
				uploading = false;
				uploadingName = '';
			}
		}
	}

	async function remove(photoId: string): Promise<void> {
		try {
			await deletePhoto(listingId, photoId);
			onChange();
		} catch {
			error = 'Could not delete the photo.';
		}
	}

	async function move(id: string, dir: -1 | 1): Promise<void> {
		const idx = photos.findIndex((p) => p.id === id);
		const target = idx + dir;
		if (idx < 0 || target < 0 || target >= photos.length) return;
		const next = [...photos];
		const [moved] = next.splice(idx, 1);
		next.splice(target, 0, moved);
		// The API expects the full ordered id list.
		try {
			await reorderPhotos(
				listingId,
				next.map((p) => p.id)
			);
			onChange();
		} catch {
			error = 'Could not reorder photos.';
		}
	}
</script>

<div>
	{#if notice}
		<p class="mb-2 text-xs font-semibold text-emerald-700">{notice}</p>
	{/if}
	{#if error}
		<p class="mb-2 text-xs font-semibold text-red-600">{error}</p>
	{/if}

	<label
		class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-sm font-semibold text-slate-500 transition hover:border-[#1D8D2B]/50 hover:text-[#1D8D2B]"
	>
		<input
			type="file"
			accept="image/jpeg,image/png,image/webp"
			multiple
			class="hidden"
			onchange={(e) => void handleFiles((e.currentTarget as HTMLInputElement).files)}
		/>
		{uploading ? `Uploading ${uploadingName}…` : '+ Add photos'}
	</label>

	{#if photos.length > 0}
		<div class="mt-3 grid grid-cols-3 gap-2">
			{#each [...photos].sort((a, b) => a.position - b.position) as p (p.id)}
				<div class="group relative overflow-hidden rounded-lg border border-slate-200">
					<img src={p.cdnUrl} alt="Listing" class="h-20 w-full object-cover" />
					<div
						class="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100"
					>
						<button
							type="button"
							onclick={() => void move(p.id, -1)}
							class="rounded bg-white/90 px-1.5 py-0.5 text-xs font-bold text-slate-700"
							aria-label="Move earlier"
						>
							←
						</button>
						<button
							type="button"
							onclick={() => void move(p.id, 1)}
							class="rounded bg-white/90 px-1.5 py-0.5 text-xs font-bold text-slate-700"
							aria-label="Move later"
						>
							→
						</button>
						<button
							type="button"
							onclick={() => void remove(p.id)}
							class="rounded bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white"
							aria-label="Delete photo"
						>
							✕
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
