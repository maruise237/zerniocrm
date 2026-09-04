CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" varchar(160) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"from_number" varchar(50) NOT NULL,
	"to_number" varchar(50) NOT NULL,
	"body" text NOT NULL,
	"status" varchar(20) DEFAULT 'SENT' NOT NULL,
	"external_event_id" varchar(180),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zernio_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"zernio_api_key" text NOT NULL,
	"webhook_token" varchar(64) NOT NULL,
	"whatsapp_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_whatsapp_messages_user_id" ON "whatsapp_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_messages_conversation_id" ON "whatsapp_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_external_event_unique" ON "whatsapp_messages" USING btree ("external_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zernio_config_user_unique" ON "zernio_config" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zernio_config_token_unique" ON "zernio_config" USING btree ("webhook_token");