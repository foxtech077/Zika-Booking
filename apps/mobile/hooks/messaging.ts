import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { listingApi } from "../lib/listing-api";
import type {
  ConversationsResponse,
  ConversationSummary,
  MessagesResponse,
  Message,
  UnreadCountResponse,
  StartConversationPayload,
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

// ── Messages (paginated) ──────────────────────────────────────────────────────

export function useMessages(conversationId: string | undefined) {
  return useInfiniteQuery<MessagesResponse>({
    queryKey: MSG_QK.messages(conversationId ?? ""),
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as string | undefined;
      const params: Record<string, string> = { limit: "30" };
      if (cursor) params.cursor = cursor;
      const res = await listingApi.get<{ data: MessagesResponse }>(
        `/conversations/${conversationId}/messages`,
        { params }
      );
      return res.data.data;
    },
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!conversationId,
    staleTime: 10_000,
  });
}

// ── Unread count (polled every minute) ────────────────────────────────────────

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

// ── Start conversation ────────────────────────────────────────────────────────

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StartConversationPayload) => {
      const res = await listingApi.post<{ data: ConversationSummary }>(
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
