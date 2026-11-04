import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One row per registry item; incremented when a browser opens its docs page
// via POST /api/views/<slug> (apps/web/src/app/api/views/[slug]/route.ts).
export const componentViews = sqliteTable("component_views", {
	slug: text("slug").primaryKey(),
	count: integer("count").default(0).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});
