import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One row per registry item; incremented on every `shadcn add` fetch of
// /r/<slug>.json by the web Worker (apps/web/src/middleware.ts).
export const componentDownloads = sqliteTable("component_downloads", {
	slug: text("slug").primaryKey(),
	count: integer("count").default(0).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});
