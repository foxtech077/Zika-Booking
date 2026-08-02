/** Whole nights/days between two YYYY-MM-DD strings (minimum 1). */
export function nightsBetween(start: string, end: string): number {
	if (!start || !end) return 0;
	try {
		const [sy, sm, sd] = start.split('-').map(Number);
		const [ey, em, ed] = end.split('-').map(Number);
		if ([sy, sm, sd, ey, em, ed].some((n) => isNaN(n))) return 0;
		const s = new Date(sy, sm - 1, sd).getTime();
		const e = new Date(ey, em - 1, ed).getTime();
		return Math.max(1, Math.round((e - s) / 86400000));
	} catch {
		return 0;
	}
}

/** VAT / accommodation tax rate by country code, mirroring the listing service. */
export function getTaxRate(country?: string | null): number {
	const c = (country ?? '').toUpperCase();
	if (['KE', 'NG', 'GH'].includes(c)) return 0.16;
	if (['FR', 'GB'].includes(c)) return 0.2;
	if (['AE'].includes(c)) return 0.05;
	if (['ZA'].includes(c)) return 0.1;
	return 0;
}

export interface PriceBreakdown {
	nights: number;
	subtotal: number;
	serviceFee: number;
	taxAmount: number;
	deliveryFee: number;
	securityDeposit: number;
	/** Subtotal + service fee + taxes + delivery fee (the amount commission is applied to). */
	commissionableAmount: number;
	/** The amount the guest pays, refundable security deposit included. */
	total: number;
}

/** Client-side price estimate matching the listing service's billing rules. */
export function computePriceBreakdown(options: {
	pricePerNight: number;
	checkIn: string;
	checkOut: string;
	commissionRate?: number;
	taxRate?: number;
	category?: string;
	/** Delivery fee for car rentals with delivery requested. */
	deliveryFee?: number;
	/** Security deposit for cars; waived when the provider supplies a driver. */
	securityDeposit?: number;
	driverProvided?: boolean;
}): PriceBreakdown | null {
	const nights = nightsBetween(options.checkIn, options.checkOut);
	if (nights <= 0 || options.pricePerNight <= 0) return null;
	const subtotal = options.pricePerNight * nights;
	const serviceFee = Math.ceil(subtotal * (options.commissionRate ?? 0.15) * 100) / 100;
	const taxAmount = Number((subtotal * (options.taxRate ?? 0)).toFixed(2));
	const isCar = options.category === 'car';
	const deliveryFee = Number((options.deliveryFee ?? 0).toFixed(2));
	const securityDeposit =
		isCar && !options.driverProvided ? Number((options.securityDeposit ?? 0).toFixed(2)) : 0;
	const commissionableAmount = Number((subtotal + serviceFee + taxAmount + deliveryFee).toFixed(2));
	const total = Number((commissionableAmount + securityDeposit).toFixed(2));
	return {
		nights,
		subtotal,
		serviceFee,
		taxAmount,
		deliveryFee,
		securityDeposit,
		commissionableAmount,
		total
	};
}
