import type { Registry } from "shadcn/schema";

export const components: Registry["items"] = [
	{
		name: "swipe-actions",
		type: "registry:component",
		title: "Swipe Actions",
		description:
			"iOS-style list rows you swipe to reveal actions, with threshold haptics, a full-swipe snap, and keyboard support.",
		dependencies: [
			"@rexa-developer/tiks",
			"lucide-react",
			"motion",
			"web-haptics",
		],
		files: [
			{
				path: "components/swipe-actions/swipe-actions.tsx",
				type: "registry:component",
				target: "@components/swipe-actions.tsx",
			},
		],
		categories: ["lists"],
		meta: {
			createdAt: "2026-10-24",
			image: "https://cdn.tentui.com/images/components/swipe-actions",
			video: "https://cdn.tentui.com/videos/components/swipe-actions",
		},
		docs: "https://tentui.com/components/swipe-actions",
	},
	{
		name: "snap-sheet",
		type: "registry:component",
		title: "Snap Sheet",
		description:
			"A bottom sheet you drag between snap points, with detent haptics, a rubber band, and flick to close.",
		dependencies: [
			"@base-ui/react",
			"@rexa-developer/tiks",
			"lucide-react",
			"motion",
			"web-haptics",
		],
		files: [
			{
				path: "components/snap-sheet/snap-sheet.tsx",
				type: "registry:component",
				target: "@components/snap-sheet.tsx",
			},
		],
		categories: ["overlays"],
		meta: {
			createdAt: "2026-10-24",
			image: "https://cdn.tentui.com/images/components/snap-sheet",
			video: "https://cdn.tentui.com/videos/components/snap-sheet",
		},
		docs: "https://tentui.com/components/snap-sheet",
	},
	{
		name: "tick-ruler",
		type: "registry:component",
		title: "Tick Ruler",
		description:
			"A ruler-style number picker you drag or flick, with a click and a haptic tick on every step.",
		dependencies: ["@rexa-developer/tiks", "motion", "web-haptics"],
		files: [
			{
				path: "components/tick-ruler/tick-ruler.tsx",
				type: "registry:component",
				target: "@components/tick-ruler.tsx",
			},
		],
		categories: ["inputs"],
		meta: {
			createdAt: "2026-10-23",
			image: "https://cdn.srb.codes/images/components/tick-ruler",
			video: "https://cdn.srb.codes/videos/components/tick-ruler",
		},
		docs: "https://tentui.com/components/tick-ruler",
	},
	{
		name: "hold-to-confirm",
		type: "registry:component",
		title: "Hold to Confirm",
		description:
			"Guard destructive actions behind a press-and-hold fill with rising sound, haptic ticks, and a checkmark.",
		dependencies: ["lucide-react", "motion", "web-haptics"],
		files: [
			{
				path: "components/hold-to-confirm/hold-to-confirm.tsx",
				type: "registry:component",
				target: "@components/hold-to-confirm.tsx",
			},
			{
				path: "src/hooks/use-hold-to-confirm.ts",
				type: "registry:hook",
				target: "@hooks/use-hold-to-confirm.ts",
			},
		],
		categories: ["buttons"],
		meta: {
			createdAt: "2026-10-22",
			image: "https://cdn.srb.codes/images/components/hold-to-confirm",
			video: "https://cdn.srb.codes/videos/components/hold-to-confirm",
		},
		docs: "https://tentui.com/components/hold-to-confirm",
	},
	{
		name: "interactive-sprite",
		type: "registry:component",
		title: "Interactive Sprite",
		description:
			"Turn a directional sprite sheet into a character that follows the pointer and returns to rest.",
		files: [
			{
				path: "components/interactive-sprite/interactive-sprite.tsx",
				type: "registry:component",
				target: "@components/interactive-sprite.tsx",
			},
		],
		categories: [],
		meta: {
			createdAt: "2026-08-06",
			image: "https://cdn.srb.codes/images/components/interactive-sprite",
			video: "https://cdn.srb.codes/videos/components/interactive-sprite",
		},
		docs: "https://tentui.com/components/interactive-sprite",
	},
	{
		name: "tile-field",
		type: "registry:component",
		title: "Tile Field",
		description:
			"Render a theme-aware wordmark with moving tiles, a color wave, and pointer glow.",
		files: [
			{
				path: "components/tile-field/tile-field.tsx",
				type: "registry:component",
				target: "@components/tile-field.tsx",
			},
		],
		categories: ["typography"],
		meta: {
			createdAt: "2026-07-30",
			image: "https://cdn.srb.codes/images/components/tile-field",
			video: "https://cdn.srb.codes/videos/components/tile-field",
		},
		docs: "https://tentui.com/components/tile-field",
	},
	{
		name: "search-command",
		type: "registry:component",
		title: "Search Command",
		description:
			"Search pages and run actions from a polished, keyboard-first command menu.",
		dependencies: ["lucide-react", "react-hotkeys-hook"],
		registryDependencies: ["button", "command", "kbd"],
		files: [
			{
				path: "components/search-command/search-command.tsx",
				type: "registry:component",
				target: "@components/search-command.tsx",
			},
		],
		categories: ["menus"],
		meta: {
			createdAt: "2026-07-30",
			image: "https://cdn.srb.codes/images/components/search-command",
			video: "https://cdn.srb.codes/videos/components/search-command",
		},
		docs: "https://tentui.com/components/search-command",
	},
	{
		name: "tailwindcss-buttons",
		type: "registry:component",
		title: "Tailwind CSS Buttons",
		description:
			"Browse and copy a responsive gallery of polished Tailwind CSS button styles.",
		dependencies: ["react-element-to-jsx-string", "react-is"],
		registryDependencies: ["https://tentui.com/r/copy-button.json"],
		files: [
			{
				path: "components/tailwindcss-buttons/tailwindcss-buttons.tsx",
				type: "registry:component",
				target: "@components/tailwindcss-buttons.tsx",
			},
		],
		categories: ["buttons"],
		meta: {
			createdAt: "2026-07-26",
			image: "https://cdn.srb.codes/images/components/tailwindcss-buttons",
			video: "https://cdn.srb.codes/videos/components/tailwindcss-buttons",
		},
		docs: "https://tentui.com/components/tailwindcss-buttons",
	},
	{
		name: "component-sidebar",
		type: "registry:component",
		title: "Component Sidebar",
		description:
			"Navigate dense component libraries with tactile, proximity-reactive guide lines.",
		dependencies: ["@rexa-developer/tiks", "motion", "web-haptics"],
		registryDependencies: ["badge", "button", "kbd", "tooltip"],
		files: [
			{
				path: "components/component-sidebar/component-sidebar.tsx",
				type: "registry:component",
				target: "@components/component-sidebar.tsx",
			},
			{
				path: "src/hooks/soundcn/use-metal-click-sound.ts",
				type: "registry:hook",
				target: "@hooks/soundcn/use-metal-click-sound.ts",
			},
			{
				path: "src/hooks/soundcn/use-sound.ts",
				type: "registry:hook",
				target: "@hooks/soundcn/use-sound.ts",
			},
			{
				path: "src/lib/soundcn/metal-click.ts",
				type: "registry:lib",
				target: "@lib/soundcn/metal-click.ts",
			},
			{
				path: "src/lib/soundcn/sound-engine.ts",
				type: "registry:lib",
				target: "@lib/soundcn/sound-engine.ts",
			},
			{
				path: "src/lib/soundcn/sound-types.ts",
				type: "registry:lib",
				target: "@lib/soundcn/sound-types.ts",
			},
		],
		categories: ["navigation"],
		meta: {
			createdAt: "2026-07-26",
			updatedAt: "2026-08-19",
			image: "https://cdn.srb.codes/images/components/component-sidebar",
			video: "https://cdn.srb.codes/videos/components/component-sidebar",
		},
		docs: "https://tentui.com/components/component-sidebar",
	},
	{
		name: "peeping-button",
		type: "registry:component",
		title: "Peeping Button",
		description:
			"Add a shy, cursor-tracking surprise behind a familiar button face.",
		dependencies: ["motion"],
		files: [
			{
				path: "components/peeping-button/peeping-button.tsx",
				type: "registry:component",
				target: "@components/peeping-button.tsx",
			},
		],
		categories: ["buttons"],
		meta: {
			createdAt: "2026-07-22",
			image: "https://cdn.srb.codes/images/components/peeping-button",
			video: "https://cdn.srb.codes/videos/components/peeping-button",
		},
		docs: "https://tentui.com/components/peeping-button",
	},
	{
		name: "brand-context-menu",
		type: "registry:component",
		title: "Brand Context Menu",
		description:
			"Share copy-ready and downloadable brand assets from a contextual menu.",
		dependencies: ["lucide-react", "sonner"],
		registryDependencies: ["context-menu", "sonner"],
		files: [
			{
				path: "components/brand-context-menu/brand-context-menu.tsx",
				type: "registry:component",
				target: "@components/brand-context-menu.tsx",
			},
		],
		categories: ["menus"],
		meta: {
			createdAt: "2026-07-21",
			image: "https://cdn.srb.codes/images/components/brand-context-menu",
			video: "https://cdn.srb.codes/videos/components/brand-context-menu",
		},
		docs: "https://tentui.com/components/brand-context-menu",
	},
	{
		name: "animated-tabs",
		type: "registry:component",
		title: "Animated Tabs",
		description:
			"Switch segmented options with a fluid shared-layout indicator.",
		dependencies: ["motion"],
		files: [
			{
				path: "components/animated-tabs/animated-tabs.tsx",
				type: "registry:component",
				target: "@components/animated-tabs.tsx",
			},
		],
		categories: ["navigation"],
		meta: {
			createdAt: "2026-07-21",
			image: "https://cdn.srb.codes/images/components/animated-tabs",
			video: "https://cdn.srb.codes/videos/components/animated-tabs",
		},
		docs: "https://tentui.com/components/animated-tabs",
	},
	{
		name: "theme-toggle",
		type: "registry:component",
		title: "Theme Toggle",
		description:
			"Switch between light and dark themes with animated, sound, and haptic feedback.",
		dependencies: ["lucide-react", "motion", "next-themes", "web-haptics"],
		registryDependencies: ["button"],
		files: [
			{
				path: "components/theme-toggle/theme-toggle.tsx",
				type: "registry:component",
				target: "@components/theme-toggle.tsx",
			},
			{
				path: "components/icon-swap/icon-swap.tsx",
				type: "registry:component",
				target: "@components/icon-swap/icon-swap.tsx",
			},
			{
				path: "src/hooks/use-theme-toggle.ts",
				type: "registry:hook",
				target: "@hooks/use-theme-toggle.ts",
			},
			{
				path: "src/hooks/soundcn/use-metal-click-sound.ts",
				type: "registry:hook",
				target: "@hooks/soundcn/use-metal-click-sound.ts",
			},
			{
				path: "src/hooks/soundcn/use-sound.ts",
				type: "registry:hook",
				target: "@hooks/soundcn/use-sound.ts",
			},
			{
				path: "src/lib/soundcn/metal-click.ts",
				type: "registry:lib",
				target: "@lib/soundcn/metal-click.ts",
			},
			{
				path: "src/lib/soundcn/sound-engine.ts",
				type: "registry:lib",
				target: "@lib/soundcn/sound-engine.ts",
			},
			{
				path: "src/lib/soundcn/sound-types.ts",
				type: "registry:lib",
				target: "@lib/soundcn/sound-types.ts",
			},
		],
		categories: ["buttons"],
		meta: {
			createdAt: "2026-08-19",
			image: "https://cdn.srb.codes/images/components/theme-toggle",
			video: "https://cdn.srb.codes/videos/components/theme-toggle",
		},
		docs: "https://tentui.com/components/theme-toggle",
	},
	{
		name: "copy-button",
		type: "registry:component",
		title: "Copy Button",
		description:
			"Copy text to the clipboard with visual, sound, and haptic feedback.",
		dependencies: [
			"@rexa-developer/tiks",
			"lucide-react",
			"motion",
			"web-haptics",
		],
		registryDependencies: ["button"],
		files: [
			{
				path: "components/copy-button/copy-button.tsx",
				type: "registry:component",
				target: "@components/copy-button.tsx",
			},
			{
				path: "components/icon-swap/icon-swap.tsx",
				type: "registry:component",
				target: "@components/icon-swap/icon-swap.tsx",
			},
			{
				path: "src/hooks/use-copy-to-clipboard.ts",
				type: "registry:hook",
				target: "@hooks/use-copy-to-clipboard.ts",
			},
		],
		categories: ["buttons"],
		meta: {
			createdAt: "2026-07-20",
			updatedAt: "2026-08-19",
			image: "https://cdn.srb.codes/images/components/copy-button",
			video: "https://cdn.srb.codes/videos/components/copy-button",
		},
		docs: "https://tentui.com/components/copy-button",
	},
	{
		name: "email-dock",
		type: "registry:component",
		title: "Email Dock",
		description:
			"Highlight and link parts of an email address with dock actions.",
		dependencies: ["lucide-react"],
		files: [
			{
				path: "components/email-dock/email-dock.tsx",
				type: "registry:component",
				target: "@components/email-dock.tsx",
			},
		],
		categories: [],
		meta: {
			createdAt: "2026-07-20",
			image: "https://cdn.srb.codes/images/components/email-dock",
			video: "https://cdn.srb.codes/videos/components/email-dock",
		},
		docs: "https://tentui.com/components/email-dock",
	},
	{
		name: "stateful-button",
		type: "registry:component",
		title: "Stateful Button",
		description:
			"Communicate async loading, success, and error states without leaving the button.",
		dependencies: ["lucide-react", "motion"],
		files: [
			{
				path: "components/stateful-button/stateful-button.tsx",
				type: "registry:component",
				target: "@components/stateful-button.tsx",
			},
		],
		categories: ["buttons"],
		meta: {
			createdAt: "2026-07-19",
			image: "https://cdn.srb.codes/images/components/stateful-button",
			video: "https://cdn.srb.codes/videos/components/stateful-button",
		},
		docs: "https://tentui.com/components/stateful-button",
	},
	{
		name: "animated-arrow",
		type: "registry:component",
		title: "Animated Arrow",
		description:
			"Slide an arrow across its container when its parent is hovered.",
		dependencies: ["lucide-react"],
		files: [
			{
				path: "components/animated-arrow/animated-arrow.tsx",
				type: "registry:component",
				target: "@components/animated-arrow.tsx",
			},
		],
		categories: [],
		meta: {
			createdAt: "2026-07-19",
			image: "https://cdn.srb.codes/images/components/animated-arrow",
			video: "https://cdn.srb.codes/videos/components/animated-arrow",
		},
		docs: "https://tentui.com/components/animated-arrow",
	},
	{
		name: "scribbled-text",
		type: "registry:component",
		title: "Scribbled Text",
		description: "Mark inline text with colorful hand-drawn annotations.",
		dependencies: ["motion"],
		files: [
			{
				path: "components/scribbled-text/scribbled-text.tsx",
				type: "registry:component",
				target: "@components/scribbled-text.tsx",
			},
		],
		categories: ["typography"],
		meta: {
			createdAt: "2026-07-20",
			image: "https://cdn.srb.codes/images/components/scribbled-text",
			video: "https://cdn.srb.codes/videos/components/scribbled-text",
		},
		docs: "https://tentui.com/components/scribbled-text",
	},
];
