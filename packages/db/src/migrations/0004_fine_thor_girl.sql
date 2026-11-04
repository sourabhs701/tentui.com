CREATE TABLE `sponsor_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`placement` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`name` text NOT NULL,
	`href` text NOT NULL,
	`description` text,
	`logo_key` text NOT NULL,
	`image_key` text,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`notes` text,
	`checkout_session_id` text,
	`subscription_id` text,
	`hold_expires_at` integer,
	`live_at` integer,
	`paid_through` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sponsor_orders_subscription_id_unique` ON `sponsor_orders` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `sponsor_orders_placement_status_idx` ON `sponsor_orders` (`placement`,`status`);