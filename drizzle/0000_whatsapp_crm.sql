CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.zernio_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  zernio_api_key text NOT NULL,
  webhook_token varchar(64) UNIQUE NOT NULL,
  whatsapp_id varchar(100),
  created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS zernio_config_user_unique ON public.zernio_config(user_id);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  conversation_id varchar(160) NOT NULL,
  direction varchar(10) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  from_number varchar(50) NOT NULL,
  to_number varchar(50) NOT NULL,
  body text NOT NULL,
  status varchar(20) DEFAULT 'SENT' NOT NULL,
  external_event_id varchar(180) UNIQUE,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_id ON public.whatsapp_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id ON public.whatsapp_messages(conversation_id);
