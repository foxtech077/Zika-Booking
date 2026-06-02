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
  UserRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";

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
  senderType: "provider" | "guest" | "system";
  createdAt: string;
  readAt?: string;
  status?: "sent" | "delivered" | "read";
}

interface Notice {
  type: "success" | "error";
  text: string;
}

const MESSAGE_LIMIT = 50;
const CONVERSATION_LIMIT = 30;
const MAX_MESSAGE_LENGTH = 2000;

function unwrapList(payload: unknown): unknown[] {
  const root = payload as Record<string, unknown>;
  const data = root?.data as Record<string, unknown> | undefined;
  for (const source of [data, root]) {
    if (!source) continue;
    for (const key of ["conversations", "messages", "items", "results", "data"]) {
      const value = source[key];
      if (Array.isArray(value)) return value;
    }
  }
  return Array.isArray(payload) ? payload : [];
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nestedName(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const item = value as Record<string, unknown>;
  return readString(item.name ?? item.fullName ?? item.title, fallback);
}

function normalizeConversation(raw: unknown): Conversation {
  const item = raw as Record<string, unknown>;
  const guest = (item.guest ?? item.customer ?? item.user ?? {}) as Record<string, unknown>;
  const listing = (item.listing ?? item.property ?? {}) as Record<string, unknown>;
  const booking = (item.booking ?? {}) as Record<string, unknown>;
  const lastMessage = (item.lastMessage ?? {}) as Record<string, unknown>;
  const id = readString(item.id ?? item._id ?? item.conversationId, crypto.randomUUID());

  return {
    id,
    guestId: readString(item.guestId ?? guest.id ?? guest._id),
    guestName: readString(item.guestName ?? guest.name ?? guest.fullName, "Guest"),
    guestAvatar: readString(item.guestAvatar ?? guest.avatar ?? guest.image),
    listingId: readString(item.listingId ?? listing.id ?? listing._id),
    listingName: readString(item.listingName ?? item.propertyName, nestedName(listing, "Listing")),
    bookingId: readString(item.bookingId ?? item.bookingReference ?? booking.id ?? booking.reference),
    lastMessage: readString(item.lastMessageText ?? item.preview ?? lastMessage.body ?? lastMessage.message),
    lastMessageAt: readString(item.lastMessageAt ?? lastMessage.createdAt ?? item.updatedAt),
    unreadCount: readNumber(item.unreadCount ?? item.unreadMessages, 0),
    isOnline: Boolean(item.isOnline ?? guest.isOnline),
    status: readString(item.status, "open"),
    updatedAt: readString(item.updatedAt ?? item.lastMessageAt ?? lastMessage.createdAt, new Date().toISOString()),
  };
}

function normalizeMessage(raw: unknown, conversationId: string): Message {
  const item = raw as Record<string, unknown>;
  const senderType = readString(item.senderType ?? item.senderRole ?? item.from, "guest").toLowerCase();

  return {
    id: readString(item.id ?? item._id ?? item.messageId, crypto.randomUUID()),
    conversationId,
    body: readString(item.body ?? item.message ?? item.text, ""),
    senderType: senderType === "provider" || senderType === "host" ? "provider" : senderType === "system" ? "system" : "guest",
    createdAt: readString(item.createdAt ?? item.sentAt, new Date().toISOString()),
    readAt: readString(item.readAt),
    status: readString(item.status, "sent") as Message["status"],
  };
}

async function fetchConversations(offset: number) {
  try {
    const response = await api.get("/conversations", {
      params: { offset, limit: CONVERSATION_LIMIT },
    });
    return unwrapList(response.data)
      .map(normalizeConversation)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

async function fetchMessages(conversationId: string) {
  try {
    const response = await api.get(`/conversations/${conversationId}/messages`, {
      params: { limit: MESSAGE_LIMIT },
    });
    return unwrapList(response.data).map((message) => normalizeMessage(message, conversationId));
  } catch {
    return [];
  }
}

async function fetchUnreadCount() {
  try {
    const response = await api.get("/conversations/unread-count");
    const data = response.data?.data ?? response.data;
    return readNumber(data?.count ?? data?.unreadCount ?? data?.total, 0);
  } catch {
    return 0;
  }
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);

  const {
    data: conversations = [],
    isLoading: loadingConversations,
    isFetching: fetchingConversations,
    refetch: refetchConversations,
  } = useQuery({
    queryKey: ["provider-conversations", offset],
    queryFn: () => fetchConversations(offset),
    refetchInterval: 30_000,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["provider-conversations-unread-count"],
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
  });

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );

  const {
    data: messages = [],
    isLoading: loadingMessages,
    isFetching: fetchingMessages,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["provider-conversation-messages", activeConversationId],
    queryFn: () => fetchMessages(activeConversationId!),
    enabled: !!activeConversationId,
    refetchInterval: 10_000,
  });

  const sendMutation = useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      api.post(`/conversations/${conversationId}/messages`, { body, message: body, text: body }),
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        <Card padding="none" className={cn("flex h-[calc(100vh-210px)] min-h-[620px] flex-col overflow-hidden", activeConversationId && "hidden lg:flex")}>
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
                          "w-full px-4 py-3.5 text-left transition-colors",
                          isActive ? "bg-primary-50" : "hover:bg-slate-50",
                          conversation.unreadCount > 0 && "bg-blue-50/60"
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
                                <p className="truncate text-sm font-semibold text-slate-950">{conversation.guestName}</p>
                                <p className="truncate text-xs text-slate-500">{conversation.listingName}</p>
                              </div>
                              <span className="shrink-0 text-[11px] text-slate-400">
                                {formatRelativeTime(conversation.lastMessageAt ?? conversation.updatedAt)}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <p className="min-w-0 flex-1 truncate text-xs text-slate-500">
                                {conversation.lastMessage || "No messages yet"}
                              </p>
                              {conversation.unreadCount > 0 && (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
                                  {conversation.unreadCount}
                                </span>
                              )}
                            </div>
                            {conversation.bookingId && (
                              <p className="mt-1 text-[11px] font-medium text-slate-400">Booking #{conversation.bookingId.slice(0, 10)}</p>
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
            <Button variant="ghost" size="sm" icon={<ChevronLeft />} disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - CONVERSATION_LIMIT))}>
              Prev
            </Button>
            <p className="text-xs text-slate-500">Showing {offset + 1}-{offset + filteredConversations.length}</p>
            <Button variant="ghost" size="sm" disabled={conversations.length < CONVERSATION_LIMIT} onClick={() => setOffset((value) => value + CONVERSATION_LIMIT)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <Card padding="none" className={cn("flex h-[calc(100vh-210px)] min-h-[620px] flex-col overflow-hidden", !activeConversationId && "hidden lg:flex")}>
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

              <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4">
                {loadingMessages ? (
                  <MessageSkeleton />
                ) : messages.length === 0 ? (
                  <EmptyState title="No messages yet" message="Send the first message to this guest conversation." />
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
                                  ? "rounded-tr-md bg-primary text-white"
                                  : "rounded-tl-md border border-border bg-white text-slate-800",
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
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {activeConversation.status !== "closed" && (
                <div className="sticky bottom-0 border-t border-border bg-white p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={2}
                      maxLength={MAX_MESSAGE_LENGTH}
                      placeholder="Type a message... Enter to send"
                      className="min-h-[48px] flex-1 resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary"
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
