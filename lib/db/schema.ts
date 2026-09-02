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

export type ZernioConfig = typeof zernioConfig.$inferSelect;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
