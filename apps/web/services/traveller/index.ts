import type { AxiosResponse } from "axios";
import { listingApi } from "@/lib/listing-api";

const LATEST_REVIEW_CONTEXT_KEY = "zika:last_review_context";

export const TRAVELLER_MESSAGE_LIMIT = 2_000;
export const TRAVELLER_REVIEW_RATING_MIN = 1;
export const TRAVELLER_REVIEW_RATING_MAX = 5;

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
}

type ApiPayload<T> = ApiEnvelope<T> | T;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function unwrapData<T>(payload: ApiPayload<T>): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as ApiEnvelope<T>).data;
    if (data !== undefined) return data;
  }
  return payload as T;
}

function readApiMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  const error = record.error;
  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    return readString(errorRecord.message) ?? readString(record.message);
  }

  return readString(record.message);
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const record = error as Record<string, unknown>;
  const response = record.response;
  if (response && typeof response === "object") {
    const responseRecord = response as Record<string, unknown>;
    const responseData = responseRecord.data;
    const message = readApiMessage(responseData);
    if (message) return message;
  }

  const message = readString(record.message);
  return message ?? fallback;
}

export interface ConversationLastMessage {
  body: string;
  senderId: string;
  senderType: "guest" | "provider" | string;
  createdAt: string;
}

export interface TravellerConversation {
  id: string;
  listingId: string;
  bookingId: string | null;
  guestId: string;
  providerId: string;
  status: "open" | "closed" | string;
  lastMessage: ConversationLastMessage | null;
  updatedAt: string;
}

export interface ConversationListResponse {
  conversations: TravellerConversation[];
  total: number;
  page: number;
  limit: number;
}

export interface ConversationMessage {
  id: string;
  senderId: string;
  senderType: "guest" | "provider" | string;
  body: string;
  isFiltered: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationMessagesResponse {
  messages: ConversationMessage[];
}

export interface StartConversationResponse {
  conversationId: string;
  isNew: boolean;
}

export interface SendConversationMessageResponse extends ConversationMessage {}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface ListingReview {
  id: string;
  guestId: string;
  rating: number;
  title: string | null;
  body: string | null;
  providerReply: string | null;
  providerRepliedAt: string | null;
  createdAt: string;
}

export interface ListingReviewsResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  averageRating: number | null;
  reviews: ListingReview[];
}

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

export interface MyReviewsResponse {
  reviews: MyReview[];
}

export interface SubmitReviewInput {
  bookingId?: string;
  rating: number;
  title?: string;
  body?: string;
}

export interface SubmitReviewResponse {
  reviewId: string;
  message: string;
}

export interface LatestReviewContext {
  bookingId: string;
  listingId: string;
  listingName?: string;
  completedAt: string;
}

export function readLatestReviewContext(): LatestReviewContext | null {
  if (typeof window === "undefined") return null;

  const raw = sessionStorage.getItem(LATEST_REVIEW_CONTEXT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<LatestReviewContext>;
    if (!readString(parsed.bookingId) || !readString(parsed.listingId)) return null;
    return {
      bookingId: parsed.bookingId!,
      listingId: parsed.listingId!,
      listingName: readString(parsed.listingName) ?? undefined,
      completedAt: readString(parsed.completedAt) ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function storeLatestReviewContext(context: LatestReviewContext) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LATEST_REVIEW_CONTEXT_KEY, JSON.stringify(context));
}

export function clearLatestReviewContext() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LATEST_REVIEW_CONTEXT_KEY);
}

export async function startConversation(listingId: string): Promise<StartConversationResponse> {
  const response: AxiosResponse<ApiPayload<StartConversationResponse>> = await listingApi.post("/conversations", { listingId });
  return unwrapData(response.data);
}

export async function fetchConversations(limit = 50): Promise<ConversationListResponse> {
  const response: AxiosResponse<ApiPayload<ConversationListResponse>> = await listingApi.get("/conversations", {
    params: { page: 1, limit },
  });
  return unwrapData(response.data);
}

export async function fetchConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
  const response: AxiosResponse<ApiPayload<ConversationMessagesResponse>> = await listingApi.get(`/conversations/${conversationId}/messages`, {
    params: { limit: 50 },
  });
  return unwrapData(response.data).messages ?? [];
}

export async function sendConversationMessage(
  conversationId: string,
  body: string,
): Promise<SendConversationMessageResponse> {
  const response: AxiosResponse<ApiPayload<SendConversationMessageResponse>> = await listingApi.post(`/conversations/${conversationId}/messages`, { body });
  return unwrapData(response.data);
}

export async function fetchUnreadConversationCount(): Promise<number> {
  const response: AxiosResponse<ApiPayload<UnreadCountResponse>> = await listingApi.get("/conversations/unread-count");
  return readNumber(unwrapData(response.data).unreadCount, 0);
}

export async function submitTravellerReview(input: SubmitReviewInput): Promise<SubmitReviewResponse> {
  const response: AxiosResponse<ApiPayload<SubmitReviewResponse>> = await listingApi.post("/reviews", input);
  return unwrapData(response.data);
}

export async function fetchListingReviews(listingId: string, page = 1, limit = 5): Promise<ListingReviewsResponse> {
  const response: AxiosResponse<ApiPayload<ListingReviewsResponse>> = await listingApi.get(`/listings/${listingId}/reviews`, {
    params: { page, limit },
  });
  return unwrapData(response.data);
}

export async function fetchMyReviews(): Promise<MyReview[]> {
  const response: AxiosResponse<ApiPayload<MyReviewsResponse>> = await listingApi.get("/reviews/me");
  return unwrapData(response.data).reviews ?? [];
}
