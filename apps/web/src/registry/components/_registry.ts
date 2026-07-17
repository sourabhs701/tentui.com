import type { Registry } from "shadcn/schema";

export const components: Registry["items"] = [
	{
		name: "logos-carousel",
		type: "registry:component",
		title: "Logos Carousel",
		description: "Cycle through logos column by column in a staggered wave.",
		dependencies: ["motion"],
		files: [
			{
				path: "components/logos-carousel/logos-carousel.tsx",
				type: "registry:component",
				target: "@components/logos-carousel.tsx",
			},
		],
		categories: ["marketing"],
		meta: {
			createdAt: "2026-06-25",
		},
		docs: "https://tentui.com/components/logos-carousel",
	},
];
