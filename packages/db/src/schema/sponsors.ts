import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One row per sponsor checkout, written by the web Worker
// (apps/web/src/lib/sponsors). A `pending` row holds its placement while the
// buyer is on the Dodo Payments checkout; the Dodo webhook moves it to
// `active` and keeps it in step with the subscription after that.
//
// `rejected` and `conflict` are set by us and never changed by webhooks:
// set `rejected` by hand to pull an ad, then cancel and refund in Dodo.
export const sponsorOrders = sqliteTable(
	"sponsor_orders",
	{
		id: text("id").primaryKey(),
		placement: text("placement", { enum: ["header", "feed"] }).notNull(),
		status: text("status", {
			enum: [
				"pending",
				"active",
				"on_hold",
				"cancelled",
				"ended",
				"rejected",
				"conflict",
			],
		})
			.default("pending")
			.notNull(),
		name: text("name").notNull(),
		href: text("href").notNull(),
		description: text("description"),
		logoKey: text("logo_key").notNull(),
		imageKey: text("image_key"),
		contactName: text("contact_name").notNull(),
		contactEmail: text("contact_email").notNull(),
		notes: text("notes"),
		checkoutSessionId: text("checkout_session_id"),
		subscriptionId: text("subscription_id").unique(),
		/** A `pending` row blocks its placement until this time. */
		holdExpiresAt: integer("hold_expires_at", { mode: "timestamp_ms" }),
		/** First moment the ad shows on the site. */
		liveAt: integer("live_at", { mode: "timestamp_ms" }),
		/** End of the paid period; a cancelled ad shows until then. */
		paidThrough: integer("paid_through", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index("sponsor_orders_placement_status_idx").on(
			table.placement,
			table.status,
		),
	],
);
