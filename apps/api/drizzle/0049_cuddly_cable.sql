CREATE TABLE "canvas_database_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"database_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"values" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_databases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"tab_id" uuid,
	"name" text NOT NULL,
	"properties" jsonb NOT NULL,
	"views" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvas_database_rows" ADD CONSTRAINT "canvas_database_rows_database_id_canvas_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."canvas_databases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_database_rows" ADD CONSTRAINT "canvas_database_rows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_databases" ADD CONSTRAINT "canvas_databases_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_databases" ADD CONSTRAINT "canvas_databases_tab_id_channel_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."channel_tabs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_databases" ADD CONSTRAINT "canvas_databases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_canvas_database_rows_database" ON "canvas_database_rows" USING btree ("database_id");--> statement-breakpoint
CREATE INDEX "idx_canvas_databases_channel" ON "canvas_databases" USING btree ("channel_id");