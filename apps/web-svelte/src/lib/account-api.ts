import { LISTING_API_URL } from '$lib/config';
import { apiRequest } from '$lib/http';

/**
 * Traveller account API — bookings, notifications, favourites, reviews and
 * conversations against the listing service. All endpoints require the
 * account access token (the shared request helper attaches + refreshes it).
 */

// ── Notifications ────────────────────────────────────────────────────────────

export interface AppNotification {
	id: string;
	type: string;
	title: string;
	body: string;
	isRead: boolean;
	createdAt: string;
	data?: Record<string, string>;
}

export interface NotificationsResponse {
	notifications: AppNotification[];
	nextCursor: string | null;
}

export async function getNotifications(): Promise<AppNotification[]> {
	const data = await apiRequest<NotificationsResponse | AppNotification[]>(
		LISTING_API_URL,
		'/notifications?limit=50'
	);
	if (Array.isArray(data)) return data;
	if (Array.isArray((data as { notifications?: unknown }).notifications)) {
		return (data as { notifications: AppNotification[] }).notifications;
	}
	return [];
}

export async function getUnreadNotificationCount(): Promise<number> {
	const data = await apiRequest<{ unreadCount: number }>(
		LISTING_API_URL,
		'/notifications/unread-count'
	);
	return data.unreadCount;
}

export async function markNotificationRead(id: string): Promise<void> {
	await apiRequest<unknown>(LISTING_API_URL, `/notifications/${encodeURIComponent(id)}/read`, {
		method: 'PATCH',
		body: JSON.stringify({})
	});
}

export async function markAllNotificationsRead(): Promise<void> {
	await apiRequest<unknown>(LISTING_API_URL, '/notifications/read-all', {
		method: 'PATCH',
		body: JSON.stringify({})
	});
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export type BookingStatus =
	| 'confirmed'
	| 'pending_payment'
	| 'completed'
	| 'cancelled_by_guest'
	| 'cancelled_by_provider'
	| 'cancelled_by_system';

export interface GuestBooking {
	id: string;
	reference: string;
	status: BookingStatus;
	listingId: string;
	listingType: string;
	listingTitle: string;
	listingPrimaryPhotoUrl: string | null;
	checkIn: string | null;
	checkOut: string | null;
	pickupDatetime: string | null;
	returnDatetime: string | null;
	nightsOrDays: number;
	totalAmount: number;
	currency: string;
	voucherDiscount?: number;
	pointsDiscount?: number;
	earnedPoints?: number;
	redeemPoints?: number;
	adults?: number;
	children?: number;
	createdAt: string;
}

export interface MyBookingsResponse {
	total: number;
	nextCursor: string | null;
	bookings: GuestBooking[];
}

export async function getMyBookings(
	params: {
		status?: string;
		cursor?: string | number;
		q?: string;
	} = {}
): Promise<GuestBooking[]> {
	const query = new URLSearchParams();
	if (params.status && params.status !== 'all') query.set('status', params.status);
	if (params.cursor != null) query.set('cursor', String(params.cursor));
	if (params.q) query.set('q', params.q);
	const data = await apiRequest<MyBookingsResponse | GuestBooking[]>(
		LISTING_API_URL,
		`/guests/me/bookings${query.size ? `?${query.toString()}` : ''}`
	);
	if (Array.isArray(data)) return data;
	return (data as { bookings?: GuestBooking[] }).bookings ?? [];
}

export interface BookingDetail {
	id: string;
	reference: string;
	status: string;
	listingType: string;
	listing: {
		id: string;
		title: string;
		address: string;
		town: string;
		neighborhood: string;
		country: string;
		primaryPhotoUrl: string | null;
	};
	checkIn: string | null;
	checkOut: string | null;
	pickupDatetime: string | null;
	returnDatetime: string | null;
	nightsOrDays: number;
	adults: number;
	children: number;
	specialRequests: string | null;
	guestFirstName: string;
	guestLastName: string;
	guestEmail: string;
	subtotal: number;
	discountAmount: number;
	deliveryFee: number;
	serviceFee: number;
	taxAmount: number;
	securityDeposit: number;
	voucherCode: string | null;
	voucherDiscount: number;
	totalAmount: number;
	currency: string;
	priceBreakdownJson: unknown;
	cancellationPolicy: string;
	refundAmount: number | null;
	cancelledAt: string | null;
	confirmedAt: string | null;
	completedAt: string | null;
	createdAt: string;
	canCancel: boolean;
}

export async function getBookingDetail(id: string): Promise<BookingDetail> {
	return apiRequest<BookingDetail>(
		LISTING_API_URL,
		`/guests/me/bookings/${encodeURIComponent(id)}`
	);
}

export async function cancelBooking(id: string): Promise<{
	refundAmount: number;
	currency: string;
	message: string;
}> {
	return apiRequest(LISTING_API_URL, `/bookings/${encodeURIComponent(id)}/cancel`, {
		method: 'POST',
		body: JSON.stringify({})
	});
}

export async function failPendingBooking(id: string): Promise<void> {
	await apiRequest<unknown>(LISTING_API_URL, `/bookings/${encodeURIComponent(id)}/fail`, {
		method: 'PATCH',
		body: JSON.stringify({ failureReason: 'Cancelled by guest' })
	});
}

// ── Favourites / wishlist ────────────────────────────────────────────────────

export interface FavouriteListing {
	listingId: string;
	savedAt: string;
	listing: {
		id: string;
		title: string;
		category: string;
		status: string;
		city: string;
		neighborhood: string;
		countryCode: string;
		nightlyRate: number;
		currency: string;
		localizedNightlyRate?: number;
		localizedCurrency?: string;
		primaryPhotoUrl: string | null;
	} | null;
}

export async function getFavourites(): Promise<FavouriteListing[]> {
	const data = await apiRequest<{ favourites: FavouriteListing[] } | FavouriteListing[]>(
		LISTING_API_URL,
		'/guests/me/favourites'
	);
	if (Array.isArray(data)) return data;
	return data.favourites;
}

export async function addFavourite(listingId: string): Promise<void> {
	await apiRequest<unknown>(LISTING_API_URL, '/guests/me/favourites', {
		method: 'POST',
		body: JSON.stringify({ listingId })
	});
}

export async function removeFavourite(listingId: string): Promise<void> {
	await apiRequest<unknown>(
		LISTING_API_URL,
		`/guests/me/favourites/${encodeURIComponent(listingId)}`,
		{
			method: 'DELETE'
		}
	);
}

// ── Reviews ──────────────────────────────────────────────────────────────────

export interface MyReview {
	id: string;
	listingId: string;
	listingName: string;
	bookingId: string;
	rating: number;
	title: string | null;
	body: string | null;
	providerReply: string | null;
	providerRepliedAt: string | null;
	isHidden: boolean;
	createdAt: string;
}

export async function getMyReviews(): Promise<MyReview[]> {
	const data = await apiRequest<{ reviews: MyReview[] } | MyReview[]>(
		LISTING_API_URL,
		'/reviews/me'
	);
	if (Array.isArray(data)) return data;
	return data.reviews;
}

export async function submitReview(input: {
	bookingId: string;
	rating: number;
	title?: string;
	body?: string;
}): Promise<{ reviewId: string; message: string }> {
	return apiRequest(LISTING_API_URL, '/reviews', {
		method: 'POST',
		body: JSON.stringify({
			bookingId: input.bookingId,
			rating: input.rating,
			...(input.title ? { title: input.title } : {}),
			...(input.body ? { body: input.body } : {})
		})
	});
}

// ── Conversations / messages ─────────────────────────────────────────────────

export interface ConversationLastMessage {
	body: string;
	senderId: string;
	senderType: string;
	createdAt: string;
}

export interface Conversation {
	id: string;
	listingId: string;
	bookingId: string | null;
	guestId: string;
	providerId: string;
	guestName: string;
	providerName: string;
	bookingReference: string | null;
	status: string;
	lastMessage: ConversationLastMessage | null;
	updatedAt: string;
}

export interface ConversationMessage {
	id: string;
	senderId: string;
	senderType: string;
	body: string;
	isFiltered: boolean;
	readAt: string | null;
	createdAt: string;
}

export async function getConversations(): Promise<Conversation[]> {
	const data = await apiRequest<{ conversations: Conversation[]; total: number }>(
		LISTING_API_URL,
		'/conversations?limit=50'
	);
	return data.conversations;
}

export async function getUnreadConversationCount(): Promise<number> {
	const data = await apiRequest<{ unreadCount: number }>(
		LISTING_API_URL,
		'/conversations/unread-count'
	);
	return data.unreadCount;
}

export async function getConversationMessages(
	conversationId: string
): Promise<ConversationMessage[]> {
	const data = await apiRequest<{ messages: ConversationMessage[] }>(
		LISTING_API_URL,
		`/conversations/${encodeURIComponent(conversationId)}/messages?limit=50`
	);
	return data.messages;
}

export async function sendMessage(
	conversationId: string,
	body: string
): Promise<ConversationMessage> {
	return apiRequest<ConversationMessage>(
		LISTING_API_URL,
		`/conversations/${encodeURIComponent(conversationId)}/messages`,
		{
			method: 'POST',
			body: JSON.stringify({ body })
		}
	);
}
