export type Platform =
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'bluesky'
  | 'reddit'
  | 'telegram'
  | 'whatsapp';

export interface Attachment {
  id?: string;
  type: string;
  url?: string;
  name?: string;
  mimeType?: string;
  previewUrl?: string;
  requiresExternalView?: boolean;
  payload?: { title?: string; [k: string]: unknown };
}

export interface MessageReaction {
  emoji: string;
  fromMe: boolean;
  reactedAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  accountId: string;
  platform: Platform;
  message: string;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
  senderId?: string;
  senderName?: string;
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed' | 'deleted';
  deliveryError?: { code?: string | number; title?: string; message?: string };
  isEdited?: boolean;
  editedAt?: string;
  editCount?: number;
  editHistory?: { text?: string; editedAt?: string }[];
  isDeleted?: boolean;
  deletedAt?: string;
  reactions?: MessageReaction[];
}

export interface Conversation {
  id: string;
  accountId: string;
  accountUsername?: string;
  platform: Platform;
  participantId?: string;
  participantName?: string;
  participantUsername?: string | null;
  participantPicture?: string | null;
  participantVerifiedType?: 'blue' | 'government' | 'business' | 'none' | null;
  lastMessage: string;
  updatedTime: string;
  status: 'active' | 'archived';
  unreadCount?: number;
  url?: string | null;
  contactBlocked?: boolean;
  metadata?: Record<string, unknown>;
}

/** A conversation selected in the UI; conversations are only unique per account. */
export interface Selection {
  conversationId: string;
  accountId: string;
}

export interface Account {
  _id: string;
  platform: Platform;
  username?: string;
  displayName?: string;
  profilePicture?: string;
  profileId?: { _id: string; name: string } | string | null;
  isActive?: boolean;
  enabled?: boolean;
}

export interface Profile {
  _id: string;
  name: string;
  color?: string;
  isDefault?: boolean;
}

export interface ZernioTemplate {
  id?: string;
  name: string;
  status: string;
  category?: string;
  language: string;
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  url?: string;
  buttons?: { type?: string; text?: string; url?: string }[];
  [k: string]: unknown;
}

export interface ZernioFlow {
  id: string;
  name: string;
  status: string;
}

export type WhatsAppTemplateStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'PAUSED'
  | 'PENDING_DELETION'
  | 'IN_APPEAL'
  | 'DISABLED'
  | 'FLAGGED'
  | 'DELETED';

export type WhatsAppTemplateCategory = 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';

export interface ZernioTemplateComponentButton {
  type?: string;
  title?: string;
  text?: string;
  url?: string;
  phone_number?: string;
  example?: unknown;
  [k: string]: unknown;
}

export interface ZernioTemplateComponent {
  type: string;
  format?: string;
  text?: string;
  url?: string;
  example?: unknown;
  buttons?: ZernioTemplateComponentButton[];
  [k: string]: unknown;
}

export interface ZernioAccountEvent {
  id: string;
  accountId: string;
  type: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  detail?: string | null;
  createdAt: string;
}

export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled';

export interface ZernioBroadcast {
  id: string;
  name: string;
  description?: string | null;
  platform: string;
  accountId: string;
  accountName?: string | null;
  status: BroadcastStatus;
  messagePreview?: string | null;
  message?: { text?: string } | null;
  template?: { name?: string; language?: string } | null;
  segmentFilters?: { tags?: string[] } | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  recipientCount?: number;
  sentCount?: number;
  deliveredCount?: number;
  readCount?: number;
  failedCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type BroadcastRecipientStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ZernioBroadcastRecipient {
  id: string;
  contactId?: string;
  channelId?: string;
  platformIdentifier?: string;
  displayIdentifier?: string | null;
  contactName?: string | null;
  status: BroadcastRecipientStatus;
  messageId?: string;
  error?: string | null;
  errorCode?: number | null;
  errorExplanation?: string | null;
  errorTraceId?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
}

export interface ZernioContact {
  id: string;
  name?: string;
  email?: string;
  company?: string;
  avatarUrl?: string;
  tags?: string[];
  isSubscribed?: boolean;
  isBlocked?: boolean;
  lastMessageSentAt?: string;
  lastMessageReceivedAt?: string;
  platform?: string;
  platformIdentifier?: string;
  displayIdentifier?: string;
  createdAt?: string;
}

