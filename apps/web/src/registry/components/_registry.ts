import type { Registry } from "shadcn/schema";

export const components: Registry["items"] = [
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
];
