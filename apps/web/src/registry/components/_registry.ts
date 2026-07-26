import type { Registry } from "shadcn/schema";

export const components: Registry["items"] = [
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
		},
		docs: "https://tentui.com/components/tailwindcss-buttons",
	},
	{
		name: "component-sidebar",
		type: "registry:component",
		title: "Component Sidebar",
		description:
			"Navigate dense component libraries with proximity-reactive guide lines.",
		dependencies: ["motion"],
		registryDependencies: ["badge", "button", "kbd", "tooltip"],
		files: [
			{
				path: "components/component-sidebar/component-sidebar.tsx",
				type: "registry:component",
				target: "@components/component-sidebar.tsx",
			},
		],
		categories: ["navigation"],
		meta: {
			createdAt: "2026-07-26",
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
		},
		docs: "https://tentui.com/components/peeping-button",
	},
	{
		name: "glow-card",
		type: "registry:component",
		title: "Glow Card",
		description:
			"Trace the pointer with a spring-smoothed radial glow along a card border.",
		dependencies: ["motion"],
		files: [
			{
				path: "components/glow-card/glow-card.tsx",
				type: "registry:component",
				target: "@components/glow-card.tsx",
			},
		],
		categories: ["cards"],
		meta: {
			createdAt: "2026-07-21",
			image: "https://cdn.srb.codes/images/components/glow-card",
			video: "https://cdn.srb.codes/videos/components/glow-card",
		},
		docs: "https://tentui.com/components/glow-card",
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
		name: "copy-button",
		type: "registry:component",
		title: "Copy Button",
		description: "Copy text to the clipboard with visual feedback.",
		dependencies: ["lucide-react", "motion"],
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
		name: "world-map",
		type: "registry:component",
		title: "Interactive World Map",
		description:
			"Explore countries with zoom, pan, selection, and hover details.",
		dependencies: ["react-simple-maps"],
		files: [
			{
				path: "components/world-map/world-map.tsx",
				type: "registry:component",
				target: "@components/world-map.tsx",
			},
		],
		categories: [],
		meta: {
			createdAt: "2026-05-05",
			video: "https://cdn.srb.codes/videos/components/world-map",
			image: "https://cdn.srb.codes/images/components/world-map",
		},
		docs: "https://tentui.com/components/world-map",
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
			video: "https://cdn.srb.codes/videos/components/animated-save-button",
			image: "https://cdn.srb.codes/images/components/animated-save-button",
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
			video: "https://cdn.srb.codes/videos/components/animated-arrow",
			image: "https://cdn.srb.codes/images/components/animated-arrow",
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
