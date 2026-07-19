import type { Registry } from "shadcn/schema";

import { getRegistryItemUrl } from "@/utils/registry";

export const examples: Registry["items"] = [
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
