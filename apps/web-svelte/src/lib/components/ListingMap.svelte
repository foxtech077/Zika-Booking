<script lang="ts">
	import { browser } from '$app/environment';
	import type { PublicListingDetail } from '$lib/listing-api';
	import L from 'leaflet';
	import 'leaflet/dist/leaflet.css';

	let {
		listings,
		hoveredId = null,
		onHover = () => {},
		onSelect = () => {}
	}: {
		listings: PublicListingDetail[];
		hoveredId?: string | null;
		onHover?: (id: string | null) => void;
		onSelect?: (id: string) => void;
	} = $props();

	let container = $state<HTMLDivElement | null>(null);

	type Pinnable = PublicListingDetail & { lat: number; lng: number };
	const pinnable = $derived(
		listings.filter((l): l is Pinnable => typeof l.lat === 'number' && typeof l.lng === 'number')
	);
	const center = $derived.by((): [number, number] =>
		pinnable.length > 0 ? [pinnable[0].lat, pinnable[0].lng] : [-1.2921, 36.8219]
	);

	function makePriceIcon(listing: PublicListingDetail, isHovered: boolean) {
		const label = `${listing.currency} ${(listing.pricePerNight || 0).toLocaleString()}`;
		return L.divIcon({
			className: '',
			iconAnchor: [36, 14],
			html: `<div style="
				background:${isHovered ? '#0B1E3F' : '#fff'};
				color:${isHovered ? '#fff' : '#0B1E3F'};
				border:2px solid #0B1E3F;
				padding:3px 10px;
				border-radius:20px;
				font-size:11px;
				font-weight:800;
				font-family:system-ui,sans-serif;
				white-space:nowrap;
				box-shadow:0 2px 10px rgba(0,0,0,0.18);
				cursor:pointer;
				transform:${isHovered ? 'scale(1.13)' : 'scale(1)'};
				transition:all 0.15s;
			">${label}</div>`
		});
	}

	let map: L.Map | null = null;
	let markers: L.Marker[] = [];

	function renderMarkers(): void {
		if (!map) return;
		markers.forEach((m) => m.remove());
		markers = pinnable.map((listing) => {
			const marker = L.marker([listing.lat, listing.lng], {
				icon: makePriceIcon(listing, hoveredId === listing.id)
			});
			const unit = listing.category === 'car' ? 'day' : 'night';
			const rating = listing.starRating ? `<span style="font-size:10px;color:#94a3b8;margin-top:2px;display:block">⭐ ${listing.starRating}</span>` : '';
			marker.bindPopup(
				`<div style="min-width:140px;font-family:system-ui,sans-serif">
					<p style="font-weight:700;font-size:12px;color:#0f172a;margin:0 0 2px">${listing.name}</p>
					<p style="font-weight:700;font-size:11px;color:#0B1E3F;margin:0">${listing.currency} ${(listing.pricePerNight || 0).toLocaleString()} / ${unit}</p>
					${rating}
				</div>`
			);
			marker.on('click', () => onSelect(listing.id));
			marker.on('mouseover', () => onHover(listing.id));
			marker.on('mouseout', () => onHover(null));
			marker.addTo(map!);
			return marker;
		});
	}

	function destroy(): void {
		markers.forEach((m) => m.remove());
		markers = [];
		if (map) {
			map.remove();
			map = null;
		}
	}

	$effect(() => {
		if (!browser || !container) return;
		map = L.map(container, { scrollWheelZoom: true });
		map.setView(center, 12);
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
		}).addTo(map);
		return destroy;
	});

	const centerKey = $derived(pinnable[0] ? `${pinnable[0].lat},${pinnable[0].lng}` : 'none');

	$effect(() => {
		if (!map) return;
		void centerKey;
		map.setView(center, map.getZoom(), { animate: true });
	});

	$effect(() => {
		if (!map) return;
		void hoveredId;
		renderMarkers();
	});
</script>

<div class="relative h-full w-full">
	{#if !browser}
		<div
			class="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-slate-100"
		>
			<div
				class="h-6 w-6 animate-spin rounded-full border-4 border-[#0B1E3F] border-t-transparent"
			></div>
			<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Loading map…</p>
		</div>
	{:else}
		<div bind:this={container} class="z-0 h-full w-full"></div>
	{/if}
</div>
