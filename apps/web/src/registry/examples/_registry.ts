import type { Registry } from "shadcn/schema";

import { getRegistryItemUrl } from "@/utils/registry";

export const examples: Registry["items"] = [
	{
		name: "contextful-save-button-demo",
		type: "registry:example",
		dependencies: ["motion"],
		registryDependencies: [getRegistryItemUrl("contextful-save-button")],
		files: [
			{
				path: "examples/contextful-save-button-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "animated-arrow-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("animated-arrow")],
		files: [
			{
				path: "examples/animated-arrow-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
];
