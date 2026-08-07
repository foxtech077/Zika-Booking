// Matches GET /conversations response
export interface ConversationSummary {
  id: string;
  listingId?: string | null;
  bookingId?: string | null;
  guestId: string;
  providerId: string;
  status: string;
  lastMessage?: {
    body: string;
    senderId: string;
    senderType: string;
    createdAt: string;
  } | null;
  updatedAt: string;
}

// Matches GET /conversations/:id/messages response
export interface Message {
  id: string;
  senderId: string;
  senderType: string;
  body: string;
  isFiltered?: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface MessagesResponse {
  messages: Message[];
}

export interface ConversationsResponse {
  conversations: ConversationSummary[];
  total: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

// Matches POST /conversations request body
export interface StartConversationPayload {
  listingId: string;
  bookingId?: string;
}

// Matches POST /conversations response
export interface StartConversationResponse {
  conversationId: string;
  isNew: boolean;
}
