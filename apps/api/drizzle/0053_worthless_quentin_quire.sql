ALTER TABLE "channel_tabs" ADD COLUMN "page_id" uuid;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "channel_id" uuid;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pages_channel" ON "pages" USING btree ("channel_id");