import { op } from "./openpanel";

// Plain types rather than a zod schema: the names and values are checked at
// compile time, and this module ships to the browser on every page.
type EventName =
	| "copy_npm_command"
	| "copy_code_block"
	| "copy_block_code"
	| "copy_email"
	| "copy_phone_number"
	| "play_name_pronunciation"
	| "open_command_menu"
	| "command_menu_search"
	| "command_menu_action"
	| "blog_search"
	| "component_view"
	| "block_view"
	| "toc_inline_toggle"
	| "toc_inline_item_click"
	| "toc_minimap_hover"
	| "toc_minimap_item_click"
	| "keyboard_shortcut_navigate"
	| "block_viewer_tab_change"
	| "block_viewer_resize"
	| "block_viewer_open_preview"
	| "block_viewer_refresh_preview"
	| "block_viewer_theme_change"
	| "doc_sponsors_close"
	| "sponsor_checkout_start";

// declare type AllowedPropertyValues = string | number | boolean | null
export type Event = {
	name: EventName;
	properties?: Record<string, string | number | boolean | null>;
};

export function trackEvent(input: Event) {
	console.log("trackEvent:", input);
	op.track(input.name, input.properties);
}
