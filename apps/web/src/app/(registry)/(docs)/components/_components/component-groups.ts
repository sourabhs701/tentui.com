import type { RegistryItem } from "shadcn/schema";

type ComponentGroupDefinition = {
	id: string;
	title: string;
	description: string;
	components: string[];
};

export type ComponentGroup = Omit<ComponentGroupDefinition, "components"> & {
	components: RegistryItem[];
};

// Groups for the /components index, by how each component is used. Every
// registry component should appear in exactly one group; anything missing
// falls into "More components" so it still gets a link.
export const COMPONENT_GROUP_DEFINITIONS: ComponentGroupDefinition[] = [
	{
		id: "buttons-and-toggles",
		title: "Buttons and toggles",
		description: "Click, press, or pull to run an action or switch a state.",
		components: [
			"animated-arrow",
			"copy-button",
			"glass-toggle",
			"hold-to-confirm",
			"peeping-button",
			"pull-cord",
			"stateful-button",
			"tailwindcss-buttons",
			"theme-toggle",
		],
	},
	{
		id: "inputs-and-pickers",
		title: "Inputs and pickers",
		description:
			"Enter a code or pick a number, rating, or time by dragging, scrolling, or typing.",
		components: [
			"elastic-slider",
			"number-stepper",
			"otp-field",
			"rotary-knob",
			"star-rating",
			"tick-ruler",
			"time-ring",
			"wheel-picker",
		],
	},
	{
		id: "navigation-menus-and-overlays",
		title: "Navigation, menus, and overlays",
		description:
			"Move between views, search, open menus, and show sheets or live activity.",
		components: [
			"animated-tabs",
			"brand-context-menu",
			"component-sidebar",
			"dynamic-island",
			"search-command",
			"snap-sheet",
			"swipe-actions",
		],
	},
	{
		id: "text-and-visual-effects",
		title: "Text and visual effects",
		description:
			"Annotate text, reveal content, and add pointer-reactive visuals.",
		components: [
			"email-dock",
			"interactive-sprite",
			"ripple-reveal",
			"scratch-card",
			"scribbled-text",
			"tile-field",
		],
	},
];

export function getComponentGroups(items: RegistryItem[]): ComponentGroup[] {
	const byName = new Map(items.map((item) => [item.name, item]));
	const grouped = new Set<string>();

	const groups = COMPONENT_GROUP_DEFINITIONS.map((group) => ({
		...group,
		components: group.components.flatMap((name) => {
			const item = byName.get(name);
			if (!item || grouped.has(name)) return [];
			grouped.add(name);
			return [item];
		}),
	}));

	const ungrouped = items.filter((item) => !grouped.has(item.name));
	if (ungrouped.length > 0) {
		groups.push({
			id: "more-components",
			title: "More components",
			description: "Other interactive components in the library.",
			components: ungrouped,
		});
	}

	return groups.filter((group) => group.components.length > 0);
}
