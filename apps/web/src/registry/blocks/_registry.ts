import type { Registry } from "shadcn/schema";

export const blocks: Registry["items"] = [
	{
		name: "agency-hero-01",
		title: "Agency Hero 01",
		description:
			"Animated agency hero with availability badge, CTAs, background art, and tech carousel.",
		type: "registry:block",
		dependencies: ["motion", "react-fast-marquee"],
		files: [
			{
				path: "blocks/agency-hero-01/agency-hero-01.tsx",
				target: "@components/agency-hero-01.tsx",
				type: "registry:component",
			},
		],
		categories: ["marketing"],
		meta: {
			createdAt: "2026-07-17",
			iframeHeight: 760,
			previewClassName: "min-h-screen",
		},
	},
	{
		name: "gradient-hero-01",
		title: "Gradient Hero 01",
		description:
			"A simple centered hero with a warm cinematic gradient, compact badge, short copy, and two actions.",
		type: "registry:block",
		files: [
			{
				path: "blocks/gradient-hero-01/gradient-hero-01.tsx",
				target: "@components/gradient-hero-01.tsx",
				type: "registry:component",
			},
		],
		categories: ["marketing"],
		meta: {
			createdAt: "2026-06-30",
			iframeHeight: 760,
			previewClassName: "min-h-screen",
		},
	},
];
