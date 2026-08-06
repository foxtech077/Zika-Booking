<script lang="ts">
	import type { AvailabilityRange } from '$lib/provider-api';

	let {
		ranges = []
	}: {
		// Combined booked + blocked ranges.
		ranges: AvailabilityRange[];
	} = $props();

	const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

	let viewYear = $state(new Date().getFullYear());
	let viewMonth = $state(new Date().getMonth()); // 0-indexed

	function isUnavailable(day: Date): boolean {
		const iso = toIso(day);
		return ranges.some((r) => {
			const start = r.start;
			const end = r.end ?? r.start;
			return iso >= start && iso <= end;
		});
	}

	function toIso(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function monthLabel(): string {
		return new Date(viewYear, viewMonth, 1).toLocaleDateString('en', {
			month: 'long',
			year: 'numeric'
		});
	}

	function grid(): (Date | null)[] {
		const first = new Date(viewYear, viewMonth, 1);
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const cells: (Date | null)[] = [];
		// Monday-first: JS getDay() is 0=Sunday; convert to 1=Monday..7=Sunday.
		const lead = (first.getDay() + 6) % 7;
		for (let i = 0; i < lead; i++) cells.push(null);
		for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
		while (cells.length % 7 !== 0) cells.push(null);
		return cells;
	}

	function prevMonth(): void {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear -= 1;
		} else {
			viewMonth -= 1;
		}
	}

	function nextMonth(): void {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear += 1;
		} else {
			viewMonth += 1;
		}
	}
</script>

<div>
	<div class="flex items-center justify-between">
		<h2 class="text-sm font-bold text-slate-900">{monthLabel()}</h2>
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={prevMonth}
				class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
			>
				←
			</button>
			<button
				type="button"
				onclick={nextMonth}
				class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
			>
				→
			</button>
		</div>
	</div>

	<div class="mt-3 grid grid-cols-7 gap-1 text-center">
		{#each WEEKDAYS as w (w)}
			<span class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{w}</span>
		{/each}
		{#each grid() as day, i (day ? day.getTime() : `pad-${i}`)}
			<div
				class="flex h-9 items-center justify-center rounded-lg text-xs font-semibold
					{day ? (isUnavailable(day) ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-slate-700') : ''}"
			>
				{day ? day.getDate() : ''}
			</div>
		{/each}
	</div>

	<div class="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
		<span class="flex items-center gap-1">
			<span class="h-3 w-3 rounded bg-emerald-50 ring-1 ring-slate-200"></span> Available
		</span>
		<span class="flex items-center gap-1">
			<span class="h-3 w-3 rounded bg-red-100"></span> Booked / blocked
		</span>
	</div>
</div>
