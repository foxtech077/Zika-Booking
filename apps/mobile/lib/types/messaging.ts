export interface ConversationParticipant {
  id: string;
  firstName: string;
  lastName: string;
  userType: "guest" | "provider";
  avatarUrl?: string | null;
}

export interface LastMessage {
  body: string;
  createdAt: string;
  senderId: string;
}

export interface ConversationSummary {
  id: string;
  listingId?: string | null;
  listingTitle?: string | null;
  bookingId?: string | null;
  participants: ConversationParticipant[];
  lastMessage?: LastMessage | null;
  unreadCount: number;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderFirstName?: string;
  senderLastName?: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
}

export interface MessagesResponse {
  messages: Message[];
  total: number;
  nextCursor?: string | null;
}

export interface ConversationsResponse {
  conversations: ConversationSummary[];
  total: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface StartConversationPayload {
  recipientId: string;
  body: string;
  listingId?: string;
  bookingId?: string;
}
