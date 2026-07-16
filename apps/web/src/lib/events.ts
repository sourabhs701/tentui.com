import { z } from "zod";

const eventSchema = z.object({
	name: z.enum([
		"block_viewer_tab_change",
		"block_viewer_resize",
		"block_viewer_open_preview",
		"block_viewer_refresh_preview",
		"block_viewer_theme_change",
		"copy_block_code",
		"copy_npm_command",
	]),
	// declare type AllowedPropertyValues = string | number | boolean | null
	properties: z
		.record(
			z.string(),
			z.union([z.string(), z.number(), z.boolean(), z.null()]),
		)
		.optional(),
});

export type Event = z.infer<typeof eventSchema>;

export function trackEvent(input: Event) {
	const event = eventSchema.parse(input);
	// Placeholder until OpenPanel (or another analytics provider) is wired.
	console.log("trackEvent:", event);
}
