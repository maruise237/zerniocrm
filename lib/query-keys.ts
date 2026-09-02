export const queryKeys = {
  accounts: ['accounts'] as const,
  conversations: (platform: string, accountId: string, sortOrder: string) =>
    ['conversations', platform, accountId, sortOrder] as const,
  messages: (conversationId: string, accountId: string) =>
    ['messages', conversationId, accountId] as const,
  templates: (accountId: string) => ['whatsapp-templates', accountId] as const,
  templateEvents: (accountId: string) => ['whatsapp-template-events', accountId] as const,
  flows: (accountId: string) => ['whatsapp-flows', accountId] as const,
  broadcasts: ['broadcasts'] as const,
  broadcast: (id: string) => ['broadcast', id] as const,
  broadcastRecipients: (id: string) => ['broadcast-recipients', id] as const,
  contacts: (accountId: string) => ['contacts', accountId] as const,
  settings: ['settings'] as const,
};
