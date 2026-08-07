"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Circle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";
import type { ProviderBooking } from "@/types/provider";

type SenderType = "provider" | "guest" | "system";

interface ApiEnvelope<T> {
  data?: T;
}

interface ConversationsResponse {
  conversations: ConversationDto[];
  total: number;
  page: number;
  limit: number;
}

interface ConversationListResult {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
}

interface ConversationDto {
  id: string;
  listingId: string;
  bookingId: string | null;
  guestId: string;
  providerId: string;
  guestName: string;
  providerName: string;
  bookingReference?: string | null;
  status: "open" | "closed";
  lastMessage: LastMessageDto | null;
  updatedAt: string;
}

interface LastMessageDto {
  body: string;
  senderId: string;
  senderType: SenderType;
  createdAt: string;
}

interface MessagesResponse {
  messages: MessageDto[];
}

interface MessageDto {
  id: string;
  senderId: string;
  senderType: SenderType;
  body: string;
  isFiltered: boolean;
  readAt: string | null;
  createdAt: string;
}

interface SendMessageResponse extends MessageDto {}

interface UnreadCountResponse {
  unreadCount: number;
}

interface ProviderBookingsResponse {
  bookings: ProviderBooking[];
  total: number;
}

interface BookingLookup {
  guestName: string;
  listingName: string;
  bookingReference: string;
}

interface Conversation {
  id: string;
  guestId?: string;
  guestName: string;
  guestAvatar?: string;
  listingId?: string;
  listingName: string;
  bookingId?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  isOnline: boolean;
  status?: string;
  updatedAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  body: string;
  senderType: SenderType;
  createdAt: string;
  readAt: string | null;
  status?: "sent" | "delivered" | "read";
}

interface Notice {
  type: "success" | "error";
  text: string;
}

const MESSAGE_LIMIT = 50;
const CONVERSATION_LIMIT = 30;
const MAX_MESSAGE_LENGTH = 2000;
const EMPTY_CONVERSATION_RESULT: ConversationListResult = {
  conversations: [],
  total: 0,
  page: 1,
  limit: CONVERSATION_LIMIT,
};

function unwrapData<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === "object" && "data" in payload && payload.data) {
    return payload.data;
  }
  return payload as T;
}

function readNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function shortId(value?: string | null) {
  return value ? value.slice(0, 8).toUpperCase() : "";
}

function normalizeConversation(item: ConversationDto, bookingLookup: Map<string, BookingLookup>): Conversation {
  const booking = item.bookingId ? bookingLookup.get(item.bookingId) : undefined;

  return {
    id: item.id,
    guestId: item.guestId,
    guestName: item.guestName || booking?.guestName || `Guest ${shortId(item.guestId)}`,
    listingId: item.listingId,
    listingName: booking?.listingName ?? `Listing ${shortId(item.listingId)}`,
    bookingId: item.bookingReference ?? booking?.bookingReference ?? item.bookingId ?? undefined,
    lastMessage: item.lastMessage?.body ?? "",
    lastMessageAt: item.lastMessage?.createdAt ?? item.updatedAt,
    unreadCount: 0,
    isOnline: false,
    status: item.status,
    updatedAt: item.updatedAt,
  };
}

function normalizeMessage(item: MessageDto, conversationId: string): Message {
  return {
    id: item.id,
    conversationId,
    body: item.body,
    senderType: item.senderType,
    createdAt: item.createdAt,
    readAt: item.readAt,
    status: item.readAt ? "read" : "sent",
  };
}

async function fetchBookingLookup() {
  const lookup = new Map<string, BookingLookup>();
  const limit = 50;
  let offset = 0;
  let total = 0;

  do {
    const response = await listingApi.get<ApiEnvelope<ProviderBookingsResponse> | ProviderBookingsResponse>("/provider/bookings", {
      params: { offset, limit },
    });
    const data = unwrapData<ProviderBookingsResponse>(response.data);
    total = readNumber(data.total, 0);

    for (const booking of data.bookings ?? []) {
      lookup.set(booking.id, {
        guestName: `${booking.guestFirstName} ${booking.guestLastName}`.trim() || "Guest",
        listingName: booking.listingTitle ?? "Listing",
        bookingReference: booking.reference,
      });
    }

    offset += limit;
  } while (offset < total);

  return lookup;
}

async function fetchConversations(page: number) {
  const [conversationResponse, bookingLookup] = await Promise.all([
    listingApi.get<ApiEnvelope<ConversationsResponse> | ConversationsResponse>("/conversations", {
      params: { page, limit: CONVERSATION_LIMIT },
    }),
    fetchBookingLookup().catch((err) => {
      console.warn("fetchBookingLookup failed:", err);
      return new Map<string, BookingLookup>();
    }),
  ]);
  const data = unwrapData<ConversationsResponse>(conversationResponse.data);

  return {
    conversations: (data?.conversations || [])
      .map((conversation) => normalizeConversation(conversation, bookingLookup))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    total: readNumber(data?.total, 0),
    page: readNumber(data?.page, page),
    limit: readNumber(data?.limit, CONVERSATION_LIMIT),
  };
}

async function fetchMessages(conversationId: string) {
  const response = await listingApi.get<ApiEnvelope<MessagesResponse> | MessagesResponse>(`/conversations/${conversationId}/messages`, {
    params: { limit: MESSAGE_LIMIT },
  });
  const data = unwrapData<MessagesResponse>(response.data);
  return data.messages.map((message) => normalizeMessage(message, conversationId));
}

async function sendMessage(conversationId: string, body: string) {
  const response = await listingApi.post<ApiEnvelope<SendMessageResponse> | SendMessageResponse>(`/conversations/${conversationId}/messages`, { body });
  return unwrapData<SendMessageResponse>(response.data);
}

async function fetchUnreadCount() {
  const response = await listingApi.get<ApiEnvelope<UnreadCountResponse> | UnreadCountResponse>("/conversations/unread-count");
  const data = unwrapData<UnreadCountResponse>(response.data);
  return readNumber(data.unreadCount, 0);
}

function isNearBottom(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
}

function scrollToBottom(element: HTMLDivElement | null, behavior: ScrollBehavior = "smooth") {
  element?.scrollTo({ top: element.scrollHeight, behavior });
}

function ConversationSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex gap-3 animate-pulse">
          <div className="h-11 w-11 rounded-full bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-slate-100" />
            <div className="h-3 w-full rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className={cn("flex animate-pulse", index % 2 ? "justify-end" : "justify-start")}>
          <div className={cn("h-16 rounded-2xl bg-slate-100", index % 2 ? "w-64" : "w-72")} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <MessageSquare className="h-7 w-7" />
      </div>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
    </div>
  );
}

export default function MessagingPage() {
  const queryClient = useQueryClient();
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const previousConversationRef = useRef<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<Notice | null>(null);

  const {
    data: conversationResult = EMPTY_CONVERSATION_RESULT,
    isLoading: loadingConversations,
    isFetching: fetchingConversations,
    isError: conversationsError,
    refetch: refetchConversations,
  } = useQuery({
    queryKey: ["provider-conversations", page],
    queryFn: () => fetchConversations(page),
    refetchInterval: 30_000,
    retry: false,
  });
  const conversations = conversationResult.conversations;

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["provider-conversations-unread-count"],
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
    retry: false,
  });

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );

  const {
    data: messages = [],
    isLoading: loadingMessages,
    isFetching: fetchingMessages,
    isError: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["provider-conversation-messages", activeConversationId],
    queryFn: () => fetchMessages(activeConversationId!),
    enabled: !!activeConversationId,
    refetchInterval: 10_000,
    retry: false,
  });

  const sendMutation = useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) => sendMessage(conversationId, body),
    onSuccess: () => {
      setMessageText("");
      setNotice(null);
      queryClient.invalidateQueries({ queryKey: ["provider-conversation-messages", activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ["provider-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["provider-conversations-unread-count"] });
    },
    onError: () => {
      setNotice({ type: "error", text: "Message could not be sent. Please try again." });
    },
  });

  const filteredConversations = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return conversations;
    return conversations.filter((conversation) =>
      `${conversation.guestName} ${conversation.listingName} ${conversation.lastMessage ?? ""} ${conversation.bookingId ?? ""}`
        .toLowerCase()
        .includes(text)
    );
  }, [conversations, search]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (previousConversationRef.current !== activeConversationId) {
      previousConversationRef.current = activeConversationId;
      scrollToBottom(container, "auto");
      return;
    }

    if (isNearBottom(container)) {
      scrollToBottom(container);
    }
  }, [messages.length, activeConversationId]);

  const handleSend = () => {
    const body = messageText.trim();
    if (!activeConversationId || !body || sendMutation.isPending) return;
    sendMutation.mutate({ conversationId: activeConversationId, body });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Messages"
        subtitle="Chat with guests, track unread messages, and manage booking conversations."
        action={
          <Button
            variant="outline"
            icon={<RefreshCw />}
            loading={fetchingConversations && !loadingConversations}
            onClick={() => {
              refetchConversations();
              if (activeConversationId) refetchMessages();
            }}
          >
            Retry
          </Button>
        }
      />

      {notice && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            notice.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          )}
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {notice.text}
          </span>
          <button className="rounded-lg px-2 py-1 hover:bg-white/70" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card padding="none" className={cn("flex h-[calc(100vh-210px)] min-h-[560px] flex-col overflow-hidden", activeConversationId && "hidden lg:flex")}>
          <div className="border-b border-border p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">Conversations</p>
                <p className="text-xs text-slate-500">{unreadCount} unread message{unreadCount === 1 ? "" : "s"}</p>
              </div>
              <Badge label={`${unreadCount} unread`} status={unreadCount ? "pending" : "confirmed"} />
            </div>
            <Input
              placeholder="Search guest, listing, or message"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leftIcon={<Search />}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <ConversationSkeleton />
            ) : conversationsError ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <p className="mt-4 font-semibold text-slate-900">Unable to load conversations.</p>
                <p className="mt-1 text-sm text-slate-500">Please try again.</p>
                <Button className="mt-4" variant="outline" icon={<RefreshCw />} onClick={() => refetchConversations()}>
                  Retry
                </Button>
              </div>
            ) : filteredConversations.length === 0 ? (
              <EmptyState
                title="No conversations available"
                message={search ? "No conversations match your search." : "Guest conversations will appear here once bookings start messaging."}
              />
            ) : (
              <ul className="divide-y divide-border">
                {filteredConversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;
                  return (
                    <li key={conversation.id}>
                      <button
                        onClick={() => setActiveConversationId(conversation.id)}
                        className={cn(
                          "w-full px-4 py-3.5 text-left transition-all duration-200",
                          isActive ? "bg-slate-950 text-white shadow-inner" : "hover:bg-slate-50",
                          conversation.unreadCount > 0 && !isActive && "bg-green-50/60"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className="relative shrink-0">
                            {conversation.guestAvatar ? (
                              <img src={conversation.guestAvatar} alt={conversation.guestName} className="h-11 w-11 rounded-full object-cover" />
                            ) : (
                              <Avatar name={conversation.guestName} size="md" />
                            )}
                            <span
                              className={cn(
                                "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white",
                                conversation.isOnline ? "bg-emerald-500" : "bg-slate-300"
                              )}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className={cn("truncate text-sm font-semibold", isActive ? "text-white" : "text-slate-950")}>{conversation.guestName}</p>
                                <p className={cn("truncate text-xs", isActive ? "text-slate-300" : "text-slate-500")}>{conversation.listingName}</p>
                              </div>
                              <span className={cn("shrink-0 text-[11px]", isActive ? "text-slate-300" : "text-slate-400")}>
                                {formatRelativeTime(conversation.lastMessageAt ?? conversation.updatedAt)}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <p className={cn("min-w-0 flex-1 truncate text-xs", isActive ? "text-slate-300" : "text-slate-500")}>
                                {conversation.lastMessage || "No messages yet"}
                              </p>
                              {conversation.unreadCount > 0 && (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
                                  {conversation.unreadCount}
                                </span>
                              )}
                            </div>
                            {conversation.bookingId && (
                              <p className={cn("mt-1 text-[11px] font-medium", isActive ? "text-slate-300" : "text-slate-400")}>Booking #{conversation.bookingId}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border p-3">
            <Button variant="ghost" size="sm" icon={<ChevronLeft />} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Prev
            </Button>
            <p className="text-xs text-slate-500">
              {conversationResult.total === 0
                ? "No conversations"
                : `Showing ${(page - 1) * CONVERSATION_LIMIT + 1}-${Math.min(page * CONVERSATION_LIMIT, conversationResult.total)} of ${conversationResult.total}`}
            </p>
            <Button variant="ghost" size="sm" disabled={page * CONVERSATION_LIMIT >= conversationResult.total} onClick={() => setPage((value) => value + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <Card padding="none" className={cn("flex h-[calc(100vh-210px)] min-h-[560px] flex-col overflow-hidden", !activeConversationId && "hidden lg:flex")}>
          {!activeConversation ? (
            <EmptyState title="Select a conversation to start messaging" message="Choose a guest conversation from the sidebar to view the message history." />
          ) : (
            <>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-white p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 lg:hidden"
                    onClick={() => setActiveConversationId(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  {activeConversation.guestAvatar ? (
                    <img src={activeConversation.guestAvatar} alt={activeConversation.guestName} className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    <Avatar name={activeConversation.guestName} size="md" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-slate-950">{activeConversation.guestName}</p>
                      <Circle className={cn("h-2.5 w-2.5 fill-current", activeConversation.isOnline ? "text-emerald-500" : "text-slate-300")} />
                    </div>
                    <p className="truncate text-xs text-slate-500">{activeConversation.listingName}</p>
                    {activeConversation.bookingId && (
                      <p className="truncate text-[11px] text-slate-400">Booking #{activeConversation.bookingId}</p>
                    )}
                  </div>
                </div>
                {fetchingMessages && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </div>

              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto bg-slate-50/70 p-4">
                {loadingMessages ? (
                  <MessageSkeleton />
                ) : messagesError ? (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                      <AlertCircle className="h-6 w-6" />
                    </div>
                    <p className="mt-4 font-semibold text-slate-900">Unable to load messages.</p>
                    <p className="mt-1 text-sm text-slate-500">Please try again.</p>
                    <Button className="mt-4" variant="outline" icon={<RefreshCw />} onClick={() => refetchMessages()}>
                      Retry
                    </Button>
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyState title="No messages yet." message="Start the conversation." />
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => {
                      const isProvider = message.senderType === "provider";
                      const previous = messages[index - 1];
                      const grouped = previous?.senderType === message.senderType;

                      return (
                        <div key={message.id} className={cn("flex gap-2", isProvider && "flex-row-reverse")}>
                          {!grouped ? (
                            <Avatar name={isProvider ? "You" : activeConversation.guestName} size="xs" className="mt-1 shrink-0" />
                          ) : (
                            <div className="w-6 shrink-0" />
                          )}
                          <div className={cn("max-w-[78%]", isProvider && "flex flex-col items-end")}>
                            <div
                              className={cn(
                                "rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm",
                                isProvider
                                  ? "rounded-tr-md bg-slate-900 text-white"
                                  : "rounded-tl-md border border-slate-200 bg-slate-50 text-slate-950",
                                message.senderType === "system" && "bg-slate-200 text-slate-600"
                              )}
                            >
                              {message.body}
                            </div>
                            <p className="mt-1 flex items-center gap-1 px-1 text-[11px] text-slate-400">
                              {formatDateTime(message.createdAt)}
                              {isProvider && (
                                <CheckCheck className={cn("h-3.5 w-3.5", message.readAt || message.status === "read" ? "text-primary" : "text-slate-400")} />
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div />
                  </div>
                )}
              </div>

              {activeConversation.status !== "closed" && (
                <div className="sticky bottom-0 border-t border-border bg-white p-3">
                  <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                    <textarea
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={2}
                      maxLength={MAX_MESSAGE_LENGTH}
                      placeholder="Type a message... Enter to send"
                      className="min-h-[48px] flex-1 resize-none rounded-xl border-0 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:ring-0"
                    />
                    <Button
                      variant="primary"
                      icon={<Send />}
                      loading={sendMutation.isPending}
                      disabled={!messageText.trim() || sendMutation.isPending}
                      onClick={handleSend}
                    >
                      Send
                    </Button>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className={cn(messageText.length >= MAX_MESSAGE_LENGTH ? "text-red-500" : "text-slate-400")}>
                      {messageText.length}/{MAX_MESSAGE_LENGTH}
                    </span>
                    <span className="text-slate-400">Shift + Enter for a new line</span>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
