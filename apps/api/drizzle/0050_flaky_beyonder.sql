CREATE TABLE "saved_folder_items" (
	"user_id" text NOT NULL,
	"tab_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_folder_items_user_id_tab_id_item_id_pk" PRIMARY KEY("user_id","tab_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "saved_folder_items" ADD CONSTRAINT "saved_folder_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_folder_items" ADD CONSTRAINT "saved_folder_items_tab_id_channel_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."channel_tabs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_saved_folder_items_user" ON "saved_folder_items" USING btree ("user_id");