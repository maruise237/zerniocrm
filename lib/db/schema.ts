import { pgTable, text, timestamp, uuid, varchar, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const zernioConfig = pgTable('zernio_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  zernioApiKey: text('zernio_api_key').notNull(),
  webhookToken: varchar('webhook_token', { length: 64 }).notNull(),
  whatsappId: varchar('whatsapp_id', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({ userUnique: uniqueIndex('zernio_config_user_unique').on(table.userId), tokenUnique: uniqueIndex('zernio_config_token_unique').on(table.webhookToken) }));

export const whatsappMessages = pgTable('whatsapp_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  conversationId: varchar('conversation_id', { length: 160 }).notNull(),
  direction: varchar('direction', { length: 10 }).notNull(),
  fromNumber: varchar('from_number', { length: 50 }).notNull(),
  toNumber: varchar('to_number', { length: 50 }).notNull(),
  body: text('body').notNull(),
  status: varchar('status', { length: 20 }).default('SENT').notNull(),
  externalEventId: varchar('external_event_id', { length: 180 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({ userIdx: index('idx_whatsapp_messages_user_id').on(table.userId), conversationIdx: index('idx_whatsapp_messages_conversation_id').on(table.conversationId), eventUnique: uniqueIndex('whatsapp_messages_external_event_unique').on(table.externalEventId) }));

// ── Équipe : invitations (liens magiques) et membres ──────────────────────
// Modèle « workspace » : le propriétaire (celui qui a configuré la clé API
// Zernio dans zernio_config) invite des collaborateurs sur son espace.
// Les collaborateurs n'ont pas de clé propre : ils accèdent aux données du
// workspace via leur rôle et leurs autorisations stockées en JSON.

export const teamInvitations = pgTable('team_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: text('owner_user_id').notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  permissions: text('permissions').notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  invitedByEmail: varchar('invited_by_email', { length: 320 }),
  invitedByUserId: text('invited_by_user_id'),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  acceptedByUserId: text('accepted_by_user_id'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenHashUnique: uniqueIndex('team_invitations_token_hash_unique').on(table.tokenHash),
  ownerEmailIdx: index('idx_team_invitations_owner_email').on(table.ownerUserId, table.email),
}));

export const teamMembers = pgTable('team_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: text('owner_user_id').notNull(),
  memberUserId: text('member_user_id').notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  name: varchar('name', { length: 120 }),
  role: varchar('role', { length: 20 }).notNull(),
  permissions: text('permissions').notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  invitedByUserId: text('invited_by_user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerMemberUnique: uniqueIndex('team_members_owner_member_unique').on(table.ownerUserId, table.memberUserId),
  memberUserIdx: index('idx_team_members_member_user').on(table.memberUserId),
}));

export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;

// ── Campagnes : envois directs personnalisés ──────────────────────────────
// L'envoi personnalisé (variables {{1}}, {{2}}…) part destinataire par
// destinataire via l'ouverture de conversation Zernio — hors moteur
// broadcast, qui ne suit donc pas ces messages. Cette table relie chaque
// envoi direct à sa campagne ; les statuts réels (SENT → DELIVERED → READ /
// FAILED) sont rafraîchis depuis l'inbox Zernio (deliveryStatus) par
// /api/broadcasts/[id]/sends. Une ligne par (campagne, destinataire).
export const campaignSends = pgTable('campaign_sends', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  broadcastId: varchar('broadcast_id', { length: 64 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  accountId: varchar('account_id', { length: 64 }),
  conversationId: varchar('conversation_id', { length: 160 }),
  messageId: varchar('message_id', { length: 200 }),
  preview: text('preview'),
  status: varchar('status', { length: 20 }).default('SENT').notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  statusAt: timestamp('status_at').defaultNow().notNull(),
}, (table) => ({
  broadcastPhoneUnique: uniqueIndex('campaign_sends_broadcast_phone_unique').on(table.broadcastId, table.phone),
  broadcastIdx: index('idx_campaign_sends_broadcast').on(table.userId, table.broadcastId),
}));

export type ZernioConfig = typeof zernioConfig.$inferSelect;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type CampaignSend = typeof campaignSends.$inferSelect;
