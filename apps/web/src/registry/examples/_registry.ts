import type { Registry } from "shadcn/schema";

import { getRegistryItemUrl } from "@/utils/registry";

export const examples: Registry["items"] = [
	{
		name: "logos-carousel-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("logos-carousel")],
		files: [
			{
				path: "examples/logos-carousel-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
];
