CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" varchar(20) NOT NULL,
	"permissions" text NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invited_by_email" varchar(320),
	"invited_by_user_id" text,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_by_user_id" text,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"member_user_id" text NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(120),
	"role" varchar(20) NOT NULL,
	"permissions" text NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"invited_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "team_invitations_token_hash_unique" ON "team_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_team_invitations_owner_email" ON "team_invitations" USING btree ("owner_user_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_owner_member_unique" ON "team_members" USING btree ("owner_user_id","member_user_id");--> statement-breakpoint
CREATE INDEX "idx_team_members_member_user" ON "team_members" USING btree ("member_user_id");