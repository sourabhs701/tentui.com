import { sql } from "drizzle-orm";
import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const componentFeedback = sqliteTable(
	"component_feedback",
	{
		componentSlug: text("component_slug").notNull(),
		visitorId: text("visitor_id").notNull(),
		rating: text("rating", { enum: ["up", "down"] }).notNull(),
		feedback: text("feedback"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [primaryKey({ columns: [table.componentSlug, table.visitorId] })],
);
