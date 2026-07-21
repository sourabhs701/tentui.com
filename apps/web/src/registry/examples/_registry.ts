import type { Registry } from "shadcn/schema";

import { getRegistryItemUrl } from "@/utils/registry";

export const examples: Registry["items"] = [
	{
		name: "animated-tabs-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("animated-tabs")],
		files: [
			{
				path: "examples/animated-tabs-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
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
		name: "email-dock-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("email-dock")],
		files: [
			{
				path: "examples/email-dock-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "copy-button-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("copy-button")],
		files: [
			{
				path: "examples/copy-button-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
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
		dependencies: ["dialkit"],
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-96 w-full p-0",
		},
	},
	{
		name: "scribbled-text-wavy-underline-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-wavy-underline-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "scribbled-text-circle-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-circle-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "scribbled-text-highlight-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-highlight-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "scribbled-text-underline-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-underline-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "scribbled-text-straight-underline-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-straight-underline-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "scribbled-text-dotted-underline-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-dotted-underline-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "scribbled-text-double-underline-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-double-underline-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "scribbled-text-strikethrough-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-strikethrough-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "scribbled-text-cross-out-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-cross-out-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "scribbled-text-arrow-underline-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-arrow-underline-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "scribbled-text-bracket-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-bracket-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
	{
		name: "scribbled-text-box-demo",
		type: "registry:example",
		registryDependencies: [getRegistryItemUrl("scribbled-text")],
		files: [
			{
				path: "examples/scribbled-text-box-demo.tsx",
				type: "registry:example",
			},
		],
		meta: {
			previewClassName: "min-h-72 place-items-center content-center",
		},
	},
];
