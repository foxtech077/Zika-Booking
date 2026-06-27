"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";
import {
  TRAVELLER_MESSAGE_LIMIT,
  fetchConversationMessages,
  fetchConversations,
  fetchUnreadConversationCount,
  getApiErrorMessage,
  sendConversationMessage,
  type ConversationMessage,
  type TravellerConversation,
} from "@/services/traveller";
import { TravellerHeader } from "../components/TravellerHeader";

function shortId(value?: string | null) {
  return value ? value.replace(/-/g, "").slice(0, 8).toUpperCase() : "—";
}

function conversationSummary(conversation: TravellerConversation) {
  const pieces = [`Listing ${shortId(conversation.listingId)}`];
  if (conversation.bookingId) {
    pieces.push(`Booking ${shortId(conversation.bookingId)}`);
  }
  return pieces.join(" · ");
}

function ConversationSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={cn("flex gap-3", index % 2 === 0 && "flex-row-reverse")}>
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="max-w-[78%] space-y-2">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]" padding="lg">
      <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <MessageSquare className="h-7 w-7" />
        </div>
        <p className="mt-4 font-semibold text-slate-950">{title}</p>
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{message}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </Card>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isMine = message.senderType === "guest";
  const isSystem = message.senderType === "system";

  return (
    <div className={cn("flex gap-3", isMine && "flex-row-reverse", isSystem && "justify-center")}>
      {!isSystem && (
        <div
          className={cn(
            "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
            isMine ? "border-[#0c2614] bg-[#0c2614] text-white" : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {isMine ? "Me" : "Pr"}
        </div>
      )}
      <div className={cn("max-w-[82%] space-y-2", isMine && "flex flex-col items-end", isSystem && "max-w-[92%]")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
            isMine
              ? "rounded-tr-md bg-[#0c2614] text-white"
              : "rounded-tl-md border border-slate-200 bg-white text-slate-900",
            isSystem && "rounded-full border border-amber-200 bg-amber-50 text-amber-800",
          )}
        >
          {message.body}
        </div>
        <div className={cn("flex items-center gap-2 px-1 text-[11px] text-slate-400", isMine && "justify-end")}>
          <span>{formatDateTime(message.createdAt)}</span>
          {message.isFiltered && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
              Filtered
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TravellerMessagesPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const hasAutoFocused = useRef(false);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [urlConversationId, setUrlConversationId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextConversationId = new URLSearchParams(window.location.search).get("conversationId");
    setUrlConversationId(nextConversationId);
  }, []);

  useEffect(() => {
    if (urlConversationId) {
      setActiveConversationId(urlConversationId);
    }
  }, [urlConversationId]);

  const {
    data: conversationResult,
    isLoading: loadingConversations,
    isFetching: fetchingConversations,
    isError: conversationsError,
    error: conversationsErrorValue,
    refetch: refetchConversations,
  } = useQuery({
    queryKey: ["traveller-conversations"],
    queryFn: () => fetchConversations(50),
    refetchInterval: 20_000,
    retry: false,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["traveller-unread-count"],
    queryFn: fetchUnreadConversationCount,
    refetchInterval: 30_000,
    retry: false,
  });

  const conversations = conversationResult?.conversations ?? [];

  useEffect(() => {
    if (activeConversationId || conversations.length === 0) return;
    setActiveConversationId(conversations[0]!.id);
  }, [activeConversationId, conversations]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );

  const {
    data: messages = [],
    isLoading: loadingMessages,
    isFetching: fetchingMessages,
    isError: messagesError,
    error: messagesErrorValue,
    dataUpdatedAt: messagesUpdatedAt,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["traveller-conversation-messages", activeConversationId],
    queryFn: () => fetchConversationMessages(activeConversationId!),
    enabled: !!activeConversationId,
    refetchInterval: 12_000,
    retry: false,
  });

  const sendMutation = useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      sendConversationMessage(conversationId, body),
    onSuccess: () => {
      setMessageText("");
      setSendError(null);
      if (composerRef.current) composerRef.current.style.height = "auto";
      queryClient.invalidateQueries({ queryKey: ["traveller-conversation-messages", activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ["traveller-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["traveller-unread-count"] });
    },
    onError: (mutationError) => {
      setSendError(getApiErrorMessage(mutationError, "Unable to send your message right now."));
    },
  });

  const filteredConversations = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return conversations;
    return conversations.filter((conversation) =>
      [
        conversation.id,
        conversation.listingId,
        conversation.bookingId ?? "",
        conversation.status,
        conversation.lastMessage?.body ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }, [conversations, search]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages.length, activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || !messagesUpdatedAt) return;
    queryClient.invalidateQueries({ queryKey: ["traveller-unread-count"] });
  }, [activeConversationId, messagesUpdatedAt, queryClient]);

  useEffect(() => {
    if (!urlConversationId || hasAutoFocused.current) return;
    if (activeConversationId !== urlConversationId) return;
    if (loadingMessages) return;
    setTimeout(() => composerRef.current?.focus(), 80);
    hasAutoFocused.current = true;
  }, [urlConversationId, activeConversationId, loadingMessages]);

  const updateConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    const params = new URLSearchParams(window.location.search);
    params.set("conversationId", conversationId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSend = () => {
    const body = messageText.trim();
    if (!activeConversationId || !body || sendMutation.isPending) return;
    sendMutation.mutate({ conversationId: activeConversationId, body });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <TravellerHeader />
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#f3f7f2_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="mb-6 border-emerald-100 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur" padding="lg">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Traveller inbox</p>
            <h1 className="text-3xl font-bold text-slate-950">Messages</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Start and continue live conversations with providers.
            </p>
          </div>
        </Card>

        {conversationsError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {getApiErrorMessage(conversationsErrorValue, "Unable to load your conversations.")}
            </span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card
            padding="none"
            className={cn(
              "flex min-h-[640px] flex-col overflow-hidden border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]",
              activeConversationId && "hidden lg:flex",
            )}
          >
            <div className="border-b border-slate-100 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">Conversations</p>
                  <p className="text-xs text-slate-500">
                    {conversationResult?.total ?? 0} total · {unreadCount} unread
                  </p>
                </div>
                <Badge label={unreadCount ? `${unreadCount} unread` : "All read"} variant={unreadCount ? "warning" : "success"} />
              </div>
              <Input
                placeholder="Search conversation, listing, or booking"
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
                  title="No conversations yet"
                  message={search ? "No conversations match your search." : "Start a conversation from a listing to see it here."}
                  action={
                    <Button variant="outline" onClick={() => router.push("/traveller")}>
                      Browse listings
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredConversations.map((conversation) => {
                    const isActive = conversation.id === activeConversationId;
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => updateConversation(conversation.id)}
                        className={cn(
                          "w-full px-4 py-4 text-left transition",
                          isActive ? "bg-slate-950 text-white" : "hover:bg-slate-50",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-xs font-bold",
                              isActive
                                ? "border-white/10 bg-white/10 text-white"
                                : "border-emerald-100 bg-emerald-50 text-emerald-700",
                            )}
                          >
                            <MessageSquare className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className={cn("truncate text-sm font-semibold", isActive ? "text-white" : "text-slate-950")}>
                                  Conversation {shortId(conversation.id)}
                                </p>
                                <p className={cn("truncate text-xs", isActive ? "text-slate-300" : "text-slate-500")}>
                                  {conversationSummary(conversation)}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-2">
                                <Badge
                                  label={conversation.status}
                                  variant={conversation.status === "closed" ? "warning" : "success"}
                                />
                                <span className={cn("text-[11px]", isActive ? "text-slate-300" : "text-slate-400")}>
                                  {formatRelativeTime(conversation.updatedAt)}
                                </span>
                              </div>
                            </div>
                            <p className={cn("text-xs leading-5", isActive ? "text-slate-300" : "text-slate-500")}>
                              {conversation.lastMessage?.body ?? "No messages yet"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 p-4">
              <Button
                variant="outline"
                icon={<RefreshCw />}
                className="w-full"
                loading={fetchingConversations && !loadingConversations}
                onClick={() => refetchConversations()}
              >
                Refresh conversations
              </Button>
            </div>
          </Card>

          <Card
            padding="none"
            className={cn(
              "flex min-h-[640px] flex-col overflow-hidden border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]",
              !activeConversationId && "hidden lg:flex",
            )}
          >
            {!activeConversation ? (
              conversations.length === 0 && !loadingConversations ? (
                <div className="flex min-h-[580px] flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-300">
                    <MessageSquare className="h-12 w-12" />
                  </div>
                  <h2 className="mt-6 text-xl font-bold text-slate-950">No conversations yet</h2>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
                    Start a conversation from any listing by clicking{" "}
                    <span className="font-semibold text-slate-800">Message Provider</span>.
                  </p>
                  <Button variant="primary" className="mt-6" onClick={() => router.push("/traveller")}>
                    Explore Listings
                  </Button>
                </div>
              ) : (
                <EmptyState
                  title="Select a conversation"
                  message="Choose a thread from the left to view the message history and reply from here."
                  action={
                    <Button variant="outline" onClick={() => router.push("/traveller")}>
                      Back to listings
                    </Button>
                  }
                />
              )
            ) : (
              <>
                <div className="border-b border-slate-100 bg-white p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 lg:hidden"
                        onClick={() => setActiveConversationId(null)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">Conversation {shortId(activeConversation.id)}</p>
                        <p className="truncate text-xs text-slate-500">{conversationSummary(activeConversation)}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge
                        label={activeConversation.status}
                        variant={activeConversation.status === "closed" ? "warning" : "success"}
                      />
                      <Button
                        variant="outline"
                        icon={<RefreshCw />}
                        loading={fetchingMessages && !loadingMessages}
                        onClick={() => refetchMessages()}
                      >
                        Refresh
                      </Button>
                    </div>
                  </div>
                </div>

                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto bg-slate-50/80 p-4 sm:p-6">
                  {loadingMessages ? (
                    <MessageSkeleton />
                  ) : messagesError ? (
                    <EmptyState
                      title="Unable to load messages"
                      message={getApiErrorMessage(messagesErrorValue, "Please try again in a moment.")}
                      action={
                        <Button variant="outline" icon={<RefreshCw />} onClick={() => refetchMessages()}>
                          Retry
                        </Button>
                      }
                    />
                  ) : messages.length === 0 ? (
                    <EmptyState
                      title="No messages yet"
                      message="Be the first to send a message and start the conversation."
                    />
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 bg-white p-4 sm:p-5">
                  {activeConversation.status === "closed" ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      This conversation is closed. You can still review the history above, but new messages are disabled.
                    </div>
                  ) : (
                    <>
                      <form
                        className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                        onSubmit={(event) => {
                          event.preventDefault();
                          handleSend();
                        }}
                      >
                        <Textarea
                          ref={composerRef}
                          value={messageText}
                          onChange={(event) => {
                            setMessageText(event.target.value);
                            setSendError(null);
                            event.target.style.height = "auto";
                            event.target.style.height = `${Math.min(event.target.scrollHeight, 200)}px`;
                          }}
                          onKeyDown={handleKeyDown}
                          rows={3}
                          maxLength={TRAVELLER_MESSAGE_LIMIT}
                          placeholder="Ask the provider about availability, amenities, check-in, parking, or anything else."
                          className="min-h-[88px] max-h-[200px] overflow-hidden border-0 px-2 py-2 focus:ring-0"
                        />
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="text-[11px] text-slate-400">
                            {messageText.length}/{TRAVELLER_MESSAGE_LIMIT} characters
                          </p>
                          <Button
                            type="submit"
                            variant="primary"
                            icon={<Send />}
                            loading={sendMutation.isPending}
                            disabled={!messageText.trim() || sendMutation.isPending}
                          >
                            Send message
                          </Button>
                        </div>
                      </form>
                      {sendError && (
                        <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                          {sendError}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
    </>
  );
}
