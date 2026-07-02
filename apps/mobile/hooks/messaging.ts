import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { listingApi } from "../lib/listing-api";
import type {
  ConversationsResponse,
  MessagesResponse,
  Message,
  UnreadCountResponse,
  StartConversationPayload,
  StartConversationResponse,
} from "../lib/types/messaging";

// ── Query keys ────────────────────────────────────────────────────────────────

export const MSG_QK = {
  conversations: ["conversations"] as const,
  messages:      (id: string) => ["conversations", id, "messages"] as const,
  unread:        ["conversations", "unread"] as const,
};

// ── Conversation list ─────────────────────────────────────────────────────────

export function useConversations() {
  return useQuery<ConversationsResponse>({
    queryKey: MSG_QK.conversations,
    queryFn: async () => {
      const res = await listingApi.get<{ data: ConversationsResponse }>("/conversations");
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

// ── Messages (paginated by date cursor) ──────────────────────────────────────

export function useMessages(conversationId: string | undefined) {
  return useInfiniteQuery<MessagesResponse>({
    queryKey: MSG_QK.messages(conversationId ?? ""),
    queryFn: async ({ pageParam }) => {
      const before = pageParam as string | undefined;
      const params: Record<string, string> = { limit: "30" };
      if (before) params.before = before;
      const res = await listingApi.get<{ data: MessagesResponse }>(
        `/conversations/${conversationId}/messages`,
        { params }
      );
      return res.data.data;
    },
    initialPageParam: undefined,
    getNextPageParam: (last) => {
      const msgs = last.messages ?? [];
      if (msgs.length < 30) return undefined;
      return msgs[0]?.createdAt; // oldest in page = date cursor for next fetch
    },
    enabled: !!conversationId,
    staleTime: 10_000,
  });
}

// ── Unread count ──────────────────────────────────────────────────────────────
// Note: endpoint may 404 on some deployments — retry disabled to avoid log spam.

export function useUnreadCount() {
  return useQuery<UnreadCountResponse>({
    queryKey: MSG_QK.unread,
    queryFn: async () => {
      const res = await listingApi.get<{ data: UnreadCountResponse }>(
        "/conversations/unread-count"
      );
      return res.data.data;
    },
    staleTime:       60_000,
    refetchInterval: 60_000,
    retry:           false,
  });
}

// ── Send message ──────────────────────────────────────────────────────────────

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const res = await listingApi.post<{ data: Message }>(
        `/conversations/${conversationId}/messages`,
        { body }
      );
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MSG_QK.messages(conversationId) });
      void qc.invalidateQueries({ queryKey: MSG_QK.conversations });
      void qc.invalidateQueries({ queryKey: MSG_QK.unread });
    },
  });
}

// ── Listing basics (name + first photo — for conversation cards/header) ───────

export interface ListingBasics {
  name: string | null;
  photoUrl: string | null;
  category: string;
  isInactive: boolean;
}

function isListingInactiveError(err: unknown): boolean {
  const res = (err as any)?.response;
  return (
    res?.status === 410 &&
    (res?.data?.error?.code === "LISTING_INACTIVE" || res?.data?.success === false)
  );
}

export const INACTIVE_LISTING: ListingBasics = {
  name: null,
  photoUrl: null,
  category: "",
  isInactive: true,
};

export function useListingBasics(listingId: string | null | undefined) {
  return useQuery<ListingBasics | null>({
    queryKey: ["listing-basics", listingId ?? ""],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{
          data: { name: string | null; photos: { cdnUrl: string; position: number }[]; category: string };
        }>(`/listings/${listingId}/public`);
        const d = res.data.data;
        const sorted = [...d.photos].sort((a, b) => a.position - b.position);
        return { name: d.name, photoUrl: sorted[0]?.cdnUrl ?? null, category: d.category, isInactive: false };
      } catch (err) {
        if (isListingInactiveError(err)) return INACTIVE_LISTING;
        throw err;
      }
    },
    enabled: !!listingId,
    staleTime: 5 * 60_000,
    retry: (failCount, err) => !isListingInactiveError(err) && failCount < 1,
  });
}

// ── Start conversation ────────────────────────────────────────────────────────

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StartConversationPayload) => {
      const res = await listingApi.post<{ data: StartConversationResponse }>(
        "/conversations",
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MSG_QK.conversations });
      void qc.invalidateQueries({ queryKey: MSG_QK.unread });
    },
  });
}
