"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, ChevronLeft } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useAuthStore } from "@/stores/auth";
import { formatRelativeTime, formatDateTime, cn } from "@/lib/utils";
import type { Conversation, Message } from "@/types/provider";

const fetchConversations = (params: Record<string, string>) =>
  listingApi
    .get(`/conversations?${new URLSearchParams(params)}`)
    .then((r) => r.data.data ?? r.data);

const fetchMessages = (id: string) =>
  listingApi
    .get(`/conversations/${id}/messages?limit=50`)
    .then((r) => r.data.data ?? r.data);

export default function MessagingPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [offset, setOffset] = useState(0);

  const { data: convoData, isLoading: loadingConvos } = useQuery({
    queryKey: ["provider-conversations", offset],
    queryFn:  () => fetchConversations({ offset: String(offset), limit: "20" }),
    refetchInterval: 30_000,
  });

  const conversations: Conversation[] = convoData?.conversations ?? [];

  const { data: msgData, isLoading: loadingMsgs } = useQuery({
    queryKey: ["conversation-messages", selectedConvo?.id],
    queryFn:  () => selectedConvo ? fetchMessages(selectedConvo.id) : null,
    enabled:  !!selectedConvo,
    refetchInterval: 10_000,
  });

  const messages: Message[] = msgData?.messages ?? [];

  const sendMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      listingApi.post(`/conversations/${id}/messages`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-messages", selectedConvo?.id] });
      qc.invalidateQueries({ queryKey: ["provider-conversations"] });
      setMessageText("");
    },
  });

  const handleSend = () => {
    if (!selectedConvo || !messageText.trim()) return;
    sendMutation.mutate({ id: selectedConvo.id, body: messageText.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-5 animate-fade-in h-full">
      <SectionHeader title="Messages" subtitle="Guest conversations" />

      <div className="flex gap-5 h-[calc(100vh-200px)]">
        <Card
          padding="none"
          className={cn("w-80 flex flex-col shrink-0 overflow-hidden", selectedConvo && "hidden lg:flex")}
        >
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-slate-700">All Conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loadingConvos ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 animate-shimmer" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-100 rounded animate-shimmer w-3/4" />
                      <div className="h-2.5 bg-slate-100 rounded animate-shimmer w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center p-8">
                <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No conversations yet</p>
              </div>
            ) : (
              <ul>
                {conversations.map((c) => {
                  const isActive = selectedConvo?.id === c.id;
                  const counterpartId = user?.id === c.providerId ? c.guestId : c.providerId;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelectedConvo(c)}
                        className={cn(
                          "w-full text-left px-4 py-3.5 border-b border-border last:border-0 transition-all",
                          isActive ? "bg-primary-50" : "hover:bg-surface-muted"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={counterpartId.slice(0, 8)} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              Booking #{c.bookingId?.slice(0, 8) ?? c.listingId.slice(0, 8)}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {c.lastMessage
                                ? c.lastMessage.body === "[Message hidden]"
                                  ? "Message hidden"
                                  : c.lastMessage.body
                                : "No messages yet"}
                            </p>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">
                            {formatRelativeTime(c.updatedAt)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {selectedConvo ? (
          <Card padding="none" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
              <button
                className="lg:hidden w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-muted"
                onClick={() => setSelectedConvo(null)}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Booking #{selectedConvo.bookingId?.slice(0, 8) ?? selectedConvo.id.slice(0, 8)}
                </p>
                <p className="text-xs text-slate-400">Listing ID: {selectedConvo.listingId.slice(0, 8)}…</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderType === "provider";
                  return (
                    <div key={m.id} className={cn("flex gap-2", isMe && "flex-row-reverse")}>
                      <Avatar
                        name={isMe ? (user?.firstName ?? "You") : "Guest"}
                        size="xs"
                        className="mt-1 shrink-0"
                      />
                      <div className={cn("max-w-[70%]", isMe && "items-end flex flex-col")}>
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2.5 text-sm",
                            isMe
                              ? "bg-primary text-white rounded-tr-sm"
                              : "bg-surface-muted text-slate-900 rounded-tl-sm",
                            m.isFiltered && "opacity-60 italic"
                          )}
                        >
                          {m.body}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 px-1">
                          {formatDateTime(m.createdAt)}
                          {m.readAt && isMe && (
                            <span className="ml-1 text-primary">✓</span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedConvo.status !== "closed" && (
              <div className="border-t border-border p-3 shrink-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    maxLength={2000}
                    placeholder="Type a message… (Enter to send)"
                    className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
                  />
                  <Button
                    variant="primary"
                    size="md"
                    icon={<Send />}
                    onClick={handleSend}
                    disabled={!messageText.trim()}
                    loading={sendMutation.isPending}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1 text-right">{messageText.length}/2000</p>
              </div>
            )}
          </Card>
        ) : (
          <Card className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Select a conversation</p>
              <p className="text-slate-400 text-sm mt-1">Choose from the list on the left</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
