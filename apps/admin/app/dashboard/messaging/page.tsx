"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, ChevronRight } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { Avatar } from "@/components/ui/Avatar";
import { formatRelativeTime, truncate } from "@/lib/utils";
import type { Conversation, Message } from "@/types/admin";

const fetchConversations = (params: Record<string, string>) =>
  listingApi.get(`/admin/conversations?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

const fetchMessages = (id: string) =>
  listingApi.get(`/admin/conversations/${id}/messages`).then((r) => r.data.data ?? r.data);

export default function MessagingPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Conversation | null>(null);

  const params = { q, ...(status ? { status } : {}), page: String(page), limit: String(limit) };
  const { data, isLoading } = useQuery({
    queryKey: ["admin-conversations", params],
    queryFn: () => fetchConversations(params),
  });

  const conversations: Conversation[] = data?.conversations ?? [];
  const total: number = data?.total ?? 0;

  const { data: threadData, isLoading: loadingThread } = useQuery({
    queryKey: ["admin-conversation-messages", selected?.id],
    queryFn: () => fetchMessages(selected!.id),
    enabled: !!selected,
  });

  const messages: Message[] = threadData?.messages ?? [];

  const columns: Column<Conversation>[] = [
    {
      key: "ids",
      label: "Conversation",
      width: "200px",
      render: (c) => (
        <div>
          <p className="font-mono text-xs text-slate-500">{c.id.slice(0, 8)}…</p>
          {c.bookingId && (
            <p className="text-xs text-primary">Booking: {c.bookingId.slice(0, 8)}…</p>
          )}
        </div>
      ),
    },
    {
      key: "participants",
      label: "Participants",
      render: (c) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <p>Guest: {c.guestId.slice(0, 12)}…</p>
          <p>Provider: {c.providerId.slice(0, 12)}…</p>
        </div>
      ),
    },
    {
      key: "lastMessage",
      label: "Last Message",
      render: (c) => (
        c.lastMessage ? (
          <div>
            <p className="text-xs text-slate-600 italic">{truncate(c.lastMessage.body, 60)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(c.lastMessage.createdAt)}</p>
          </div>
        ) : (
          <span className="text-xs text-slate-300">No messages</span>
        )
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (c) => (
        <Badge label={c.status} status={c.status === "open" ? "active" : "deactivated"} />
      ),
    },
    {
      key: "updated",
      label: "Updated",
      render: (c) => <span className="text-xs text-slate-500">{formatRelativeTime(c.updatedAt)}</span>,
    },
    {
      key: "arrow",
      label: "",
      align: "right",
      render: () => <ChevronRight className="h-4 w-4 text-slate-300" />,
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Messaging"
        description={`${total.toLocaleString()} conversations`}
      />

      <Card padding="none">
        <FilterBar
          search={q}
          onSearchChange={(v) => { setQ(v); setPage(1); }}
          searchPlaceholder="Search booking ID or guest ID…"
          filters={[
            {
              key: "status",
              label: "All Status",
              value: status,
              onChange: (v) => { setStatus(v); setPage(1); },
              options: [
                { value: "open", label: "Open" },
                { value: "closed", label: "Closed" },
              ],
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />
        <DataTable
          columns={columns}
          data={conversations}
          loading={isLoading}
          onRowClick={(c) => setSelected(c)}
          emptyTitle="No conversations found"
          emptyIcon={<MessageSquare className="h-10 w-10" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>

      {/* Message thread drawer */}
      <SlideDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Message Thread"
        description={`Conversation ${selected?.id.slice(0, 12)}…`}
        width="md"
      >
        {loadingThread ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? "" : "justify-end"}`}>
                <div className="h-8 w-8 bg-slate-200 rounded-full animate-shimmer" />
                <div className="h-12 w-48 bg-slate-200 rounded-xl animate-shimmer" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isGuest = msg.senderType === "guest";
              return (
                <div key={msg.id} className={`flex gap-2 ${isGuest ? "" : "flex-row-reverse"}`}>
                  <Avatar
                    name={isGuest ? "Guest" : "Provider"}
                    size="xs"
                    className={isGuest ? "bg-blue-500" : "bg-emerald-500"}
                  />
                  <div className={`max-w-xs ${isGuest ? "" : "items-end flex flex-col"}`}>
                    <div
                      className={`px-3 py-2 rounded-xl text-sm ${
                        isGuest
                          ? "bg-slate-100 text-slate-800"
                          : "bg-primary text-white"
                      } ${msg.isFiltered ? "opacity-50 italic" : ""}`}
                    >
                      {msg.body}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 px-1">
                      <span className="text-[10px] text-slate-400">{isGuest ? "Guest" : "Provider"}</span>
                      <span className="text-[10px] text-slate-400">·</span>
                      <span className="text-[10px] text-slate-400">{formatRelativeTime(msg.createdAt)}</span>
                      {msg.isFiltered && (
                        <span className="text-[10px] text-warning font-medium">• Filtered</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <div className="text-center text-sm text-slate-400 py-8">No messages in this conversation</div>
            )}
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
