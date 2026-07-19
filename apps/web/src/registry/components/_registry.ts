import type { Registry } from "shadcn/schema";

export const components: Registry["items"] = [
	{
		name: "3d-button",
		type: "registry:component",
		title: "3D Button",
		description:
			"Add physical depth and responsive press feedback to primary actions.",
		dependencies: ["class-variance-authority"],
		files: [
			{
				path: "components/3d-button/3d-button.tsx",
				type: "registry:component",
				target: "@components/3d-button.tsx",
			},
		],
		categories: ["buttons"],
		meta: {
			createdAt: "2026-07-20",
			image: "https://cdn.srb.codes/images/components/3d-button-light",
			video: "https://cdn.srb.codes/videos/components/3d-button-light",
		},
		docs: "https://tentui.com/components/3d-button",
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
			{
				path: "public/data/world-map.geo.json",
				type: "registry:file",
				target: "~/public/data/world-map.geo.json",
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
		name: "contextful-save-button",
		type: "registry:component",
		title: "Contextful Save Button",
		description:
			"Show async save progress and outcomes without leaving the button.",
		dependencies: ["lucide-react", "motion"],
		files: [
			{
				path: "components/contextful-save-button/contextful-save-button.tsx",
				type: "registry:component",
				target: "@components/contextful-save-button.tsx",
			},
		],
		categories: [],
		meta: {
			createdAt: "2026-07-19",
			video: "https://cdn.srb.codes/videos/components/animated-save-button",
			image: "https://cdn.srb.codes/images/components/animated-save-button",
		},
		docs: "https://tentui.com/components/contextful-save-button",
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
