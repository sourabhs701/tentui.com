import type { Registry } from "shadcn/schema";

import { getRegistryItemUrl } from "@/utils/registry";

export const examples: Registry["items"] = [
	{
		name: "3d-button-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("3d-button")],
		files: [
			{
				path: "examples/3d-button-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-[40rem] w-full p-0",
		},
	},
	{
		name: "world-map-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("world-map")],
		files: [
			{
				path: "examples/world-map-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 w-full",
		},
	},
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
	{
		name: "scribbled-text-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-[56rem] w-full p-0",
		},
	},
];
