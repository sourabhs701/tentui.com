import type { Registry } from "shadcn/schema";

export const blocks: Registry["items"] = [
	{
		name: "agency-hero-01",
		title: "Agency Hero 01",
		description: "Animated agency hero.",
		type: "registry:block",
		dependencies: ["motion", "react-fast-marquee"],
		files: [
			{
				path: "blocks/agency-hero-01/agency-hero-01.tsx",
				target: "@components/agency-hero-01.tsx",
				type: "registry:component",
			},
		],
		categories: ["hero"],
		meta: {
			createdAt: "2026-07-17",
			iframeHeight: 760,
			previewClassName: "min-h-screen",
		},
	},
];
