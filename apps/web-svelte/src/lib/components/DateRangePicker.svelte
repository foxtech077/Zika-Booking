<script lang="ts">
	const CAL_WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
	const CAL_MONTHS = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	function getTodayString(): string {
		const d = new Date();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${d.getFullYear()}-${m}-${day}`;
	}

	function calToStr(d: Date): string {
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${d.getFullYear()}-${m}-${day}`;
	}

	function fmtDisplayDate(dateStr: string): string {
		if (!dateStr) return '';
		const [y, m, d] = dateStr.split('-').map(Number);
		if (y && m && d && !isNaN(y) && !isNaN(m) && !isNaN(d)) {
			return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
				day: 'numeric',
				month: 'short'
			});
		}
		return dateStr;
	}

	function calcNights(startStr: string, endStr: string): number {
		if (!startStr || !endStr) return 0;
		try {
			const [sy, sm, sd] = startStr.split('-').map(Number);
			const [ey, em, ed] = endStr.split('-').map(Number);
			if (
				sy &&
				sm &&
				sd &&
				ey &&
				em &&
				ed &&
				!isNaN(sy) &&
				!isNaN(sm) &&
				!isNaN(sd) &&
				!isNaN(ey) &&
				!isNaN(em) &&
				!isNaN(ed)
			) {
				const s = new Date(sy, sm - 1, sd).getTime();
				const e = new Date(ey, em - 1, ed).getTime();
				return Math.max(1, Math.round((e - s) / 86400000));
			}
		} catch {
			// fall through
		}
		return 0;
	}

	let {
		startDate = '',
		endDate = '',
		onChange,
		label = 'Dates',
		placeholder = 'Add dates',
		isCar = false,
		minDate = getTodayString(),
		variant = 'default',
		...rest
	}: {
		startDate?: string;
		endDate?: string;
		onChange: (start: string, end: string) => void;
		label?: string;
		placeholder?: string;
		isCar?: boolean;
		minDate?: string;
		variant?: 'default' | 'searchBar' | 'minimal' | 'field';
		// Rest props are forwarded to the root element (e.g. `class`).
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	} = $props();

	const today = new Date();
	const todayStr = getTodayString();
	let isOpen = $state(false);
	let viewYear = $state(today.getFullYear());
	let viewMonth = $state(today.getMonth());
	let selStart = $state('');
	let selEnd = $state('');
	let containerRef = $state<HTMLDivElement | null>(null);

	// Keep local selection in sync with the parent's dates (runs on mount too).
	$effect(() => {
		selStart = startDate || '';
		selEnd = endDate || '';
	});

	function handleDayClick(d: Date): void {
		const ds = calToStr(d);
		if (!selStart || (selStart && selEnd)) {
			selStart = ds;
			selEnd = '';
		} else if (ds <= selStart) {
			selStart = ds;
			selEnd = '';
		} else {
			selEnd = ds;
		}
	}

	function handleApply(): void {
		if (selStart && selEnd) {
			onChange(selStart, selEnd);
			isOpen = false;
		}
	}

	function handleClear(): void {
		selStart = '';
		selEnd = '';
		onChange('', '');
		isOpen = false;
	}

	function prevMonth(): void {
		if (viewMonth === 0) {
			viewYear = viewYear - 1;
			viewMonth = 11;
		} else {
			viewMonth = viewMonth - 1;
		}
	}

	function nextMonth(): void {
		if (viewMonth === 11) {
			viewYear = viewYear + 1;
			viewMonth = 0;
		} else {
			viewMonth = viewMonth + 1;
		}
	}

	const daysArray = $derived.by(() => {
		const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const arr: (Date | null)[] = [];
		for (let i = 0; i < firstWeekday; i++) arr.push(null);
		for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(viewYear, viewMonth, d));
		return arr;
	});

	const isFilled = $derived(!!(startDate && endDate));
	const displayNights = $derived.by(() => {
		if (isFilled) return calcNights(startDate, endDate);
		return selStart && selEnd ? calcNights(selStart, selEnd) : 0;
	});

	const displayText = $derived.by(() => {
		if (isFilled) {
			const unit = isCar
				? displayNights !== 1
					? 'days'
					: 'day'
				: displayNights !== 1
					? 'nights'
					: 'night';
			return `${fmtDisplayDate(startDate)} – ${fmtDisplayDate(endDate)} (${displayNights} ${unit})`;
		}
		return placeholder;
	});

	const isSearchBar = $derived(variant === 'searchBar' || variant === 'minimal');
	const isField = $derived(variant === 'field');

	const selectedSummary = $derived.by(() => {
		if (!selStart || !selEnd) return '';
		const nights = calcNights(selStart, selEnd);
		const unit = isCar ? (nights !== 1 ? 'days' : 'day') : nights !== 1 ? 'nights' : 'night';
		return `${fmtDisplayDate(selStart)} – ${fmtDisplayDate(selEnd)} · ${nights} ${unit}`;
	});

	$effect(() => {
		function onClickOutside(e: MouseEvent) {
			if (containerRef && !containerRef.contains(e.target as Node)) isOpen = false;
		}
		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') isOpen = false;
		}
		document.addEventListener('mousedown', onClickOutside);
		document.addEventListener('keydown', onKeydown);
		return () => {
			document.removeEventListener('mousedown', onClickOutside);
			document.removeEventListener('keydown', onKeydown);
		};
	});
</script>

<div class="relative" bind:this={containerRef} {...rest}>
	{#if isField}
		{#if label}
			<span class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase"
				>{label}</span
			>
		{/if}
		<button
			type="button"
			onclick={() => (isOpen = !isOpen)}
			class="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:border-slate-400 focus:border-[#1D8D2B] focus:outline-none"
		>
			<svg
				class="h-3.5 w-3.5 shrink-0 text-slate-400"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
				/>
			</svg>
			<span
				class="truncate text-xs {isFilled
					? 'font-bold text-slate-800'
					: 'font-normal text-slate-400'}"
			>
				{displayText}
			</span>
		</button>
	{:else if isSearchBar}
		<button
			type="button"
			onclick={() => (isOpen = !isOpen)}
			class="group flex w-full cursor-pointer items-center gap-2 text-left focus:outline-none"
		>
			<svg
				class="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-[#1D8D2B]"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
				/>
			</svg>
			<div class="min-w-0 flex-1">
				{#if label}
					<p class="mb-0.5 text-[9px] font-bold tracking-widest text-slate-400 uppercase">
						{label}
					</p>
				{/if}
				<p
					class="truncate text-sm font-semibold {isFilled
						? 'font-bold text-slate-800'
						: 'font-normal text-slate-400'}"
				>
					{displayText}
				</p>
			</div>
		</button>
	{:else}
		{#if label}
			<span class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase"
				>{label}</span
			>
		{/if}
		<button
			type="button"
			onclick={() => (isOpen = !isOpen)}
			class="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:border-slate-400 focus:border-[#0B1E3F] focus:outline-none"
		>
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<svg
					class="h-4 w-4 shrink-0 text-slate-400"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
				<span
					class="truncate text-xs font-bold {isFilled
						? 'text-slate-800'
						: 'font-normal text-slate-400'}"
				>
					{displayText}
				</span>
			</div>
			<svg
				class="h-4 w-4 shrink-0 text-slate-400 transition-transform {isOpen ? 'rotate-180' : ''}"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</button>
	{/if}

	{#if isOpen}
		<div
			class="absolute left-0 z-[100] mt-3 w-[min(340px,calc(100vw-2rem))] animate-fade-in rounded-3xl border border-slate-200/80 bg-white p-5 text-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] md:left-1/2 md:w-[340px] md:-translate-x-1/2"
		>
			<!-- Pointer arrow -->
			<div
				class="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[3px] border-t border-l border-slate-200/80 bg-white"
			></div>

			<div class="mb-4 flex items-center justify-between">
				<button
					type="button"
					onclick={prevMonth}
					class="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
					aria-label="Previous month"
				>
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
				<span class="font-serif text-base font-bold tracking-wide text-slate-900">
					{CAL_MONTHS[viewMonth]}
					{viewYear}
				</span>
				<button
					type="button"
					onclick={nextMonth}
					class="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
					aria-label="Next month"
				>
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			</div>

			<div
				class="mb-1 grid grid-cols-7 text-center text-[10px] font-bold tracking-wider text-slate-400 uppercase"
			>
				{#each CAL_WEEKDAYS as w (w)}
					<div class="pb-2">{w}</div>
				{/each}
			</div>

			<div class="grid grid-cols-7 gap-y-1 text-xs">
				{#each daysArray as d, idx (idx)}
					{#if !d}
						<div class="h-10"></div>
					{:else}
						{@const ds = calToStr(d)}
						{@const isDisabled = ds < minDate}
						{@const isStart = ds === selStart}
						{@const isEnd = ds === selEnd}
						{@const isInRange = selStart && selEnd && ds > selStart && ds < selEnd}
						{@const isToday = ds === todayStr}
						{#if isDisabled}
							<button
								type="button"
								disabled
								class="flex h-10 cursor-not-allowed items-center justify-center rounded-full text-xs text-slate-300"
							>
								{d.getDate()}
							</button>
						{:else if isStart || isEnd}
							<button
								type="button"
								onclick={() => handleDayClick(d)}
								class="flex h-10 items-center justify-center rounded-full bg-[#0c2614] text-xs font-bold text-white shadow-md transition-transform hover:scale-105"
							>
								{d.getDate()}
							</button>
						{:else if isInRange}
							<button
								type="button"
								onclick={() => handleDayClick(d)}
								class="flex h-10 items-center justify-center rounded-full bg-[#E8F5E9] text-xs font-semibold text-[#1D8D2B]"
							>
								{d.getDate()}
							</button>
						{:else}
							<button
								type="button"
								onclick={() => handleDayClick(d)}
								class={isToday
									? 'flex h-10 items-center justify-center rounded-full text-xs font-semibold text-[#0c2614] ring-1 ring-[#1D8D2B]/40 transition-colors hover:bg-[#E8F5E9]'
									: 'flex h-10 items-center justify-center rounded-full text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100'}
							>
								{d.getDate()}
							</button>
						{/if}
					{/if}
				{/each}
			</div>

			<div class="mt-4 border-t border-slate-100 pt-3 text-center">
				{#if !selStart}
					<p class="text-[11px] font-medium text-slate-400">
						Select {isCar ? 'pickup' : 'check-in'} date
					</p>
				{:else if selStart && !selEnd}
					<p class="text-[11px] font-medium text-slate-400">
						Select {isCar ? 'return' : 'check-out'} date
					</p>
				{:else if selStart && selEnd}
					<p
						class="inline-block rounded-full bg-[#E8F5E9]/60 px-3 py-1.5 text-xs font-bold text-[#1D8D2B]"
					>
						{selectedSummary}
					</p>
				{/if}
			</div>

			<div class="mt-3 flex gap-2 pt-1">
				<button
					type="button"
					onclick={handleClear}
					class="flex-1 rounded-xl py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
				>
					Clear
				</button>
				<button
					type="button"
					disabled={!selStart || !selEnd}
					onclick={handleApply}
					class="flex-1 rounded-xl bg-[#0c2614] py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1D8D2B] disabled:cursor-not-allowed disabled:opacity-40"
				>
					Apply
				</button>
			</div>
		</div>
	{/if}
</div>
