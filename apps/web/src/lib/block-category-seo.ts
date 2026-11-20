import type { RegistryItem } from "shadcn/schema";

import { type blockCategories, registryConfig } from "@/config/registry";
import type { FaqItem } from "@/lib/faq";
import { getRegistryItemNamespace } from "@/utils/registry";

type BlockCategory = (typeof blockCategories)[number];

type CategoryBlock = Pick<
	RegistryItem,
	"name" | "title" | "description" | "dependencies" | "registryDependencies"
>;

/**
 * Answer-first intro and FAQ for a `/blocks/<category>` page. Everything is
 * derived from the registry (block names, counts, dependencies), so the copy
 * stays true as blocks are added. The FAQ renders on the page and as FAQPage
 * JSON-LD, so answers stay plain text.
 */
export function getBlockCategoryCopy(
	category: BlockCategory,
	blocks: CategoryBlock[],
) {
	const [example] = blocks;
	const single = blocks.length === 1;
	const subject = single
		? `TentUI's shadcn ${category.noun} block is a free, source-available, copy-paste React section`
		: `TentUI's ${blocks.length} shadcn ${category.noun} blocks are free, source-available, copy-paste React sections`;

	return {
		intro: `${subject} built with shadcn/ui and Tailwind CSS.`,
		installCommand: example
			? `npx shadcn@latest add ${getRegistryItemNamespace(example.name)}`
			: undefined,
		faq: getFaqItems(category, blocks),
	};
}

function getFaqItems(
	category: BlockCategory,
	blocks: CategoryBlock[],
): FaqItem[] {
	const [example] = blocks;
	if (!example) return [];

	const single = blocks.length === 1;
	const noun = category.noun;
	const blockNoun = single ? `${noun} block` : `${noun} blocks`;
	const installs = describeDependencies(example);

	return [
		{
			question: single
				? `How do I install the shadcn ${blockNoun}?`
				: `How do I install shadcn ${blockNoun}?`,
			answer: `Add "${registryConfig.namespace}": "${registryConfig.namespaceUrl}" to the registries object in components.json, then run npx shadcn@latest add ${getRegistryItemNamespace(example.name)}${single ? "" : ", swapping in the block you want"}. The CLI copies the block's source into your project${installs ? ` and installs ${installs}` : ""}.`,
		},
		{
			question: `Which shadcn ${noun} blocks does TentUI include?`,
			answer: [
				`TentUI has ${single ? "one" : blocks.length} shadcn ${blockNoun}.`,
				...blocks.map(describeBlock),
			].join(" "),
		},
		{
			question: single
				? `Does the ${blockNoun} work with Next.js and Tailwind CSS?`
				: `Do the ${blockNoun} work with Next.js and Tailwind CSS?`,
			answer: `Yes. ${single ? "The block" : "Each block"} is a TypeScript React component styled with Tailwind CSS and built on shadcn/ui components, so it works in a Next.js project that has a components.json file.`,
		},
		{
			question: single
				? `Is the shadcn ${blockNoun} free?`
				: `Are the shadcn ${blockNoun} free?`,
			answer:
				"Yes. TentUI blocks are free and source-available. You can use them in unlimited personal and client projects under the TentUI License, but you can't resell or redistribute them as components or templates.",
		},
	];
}

function describeBlock(block: CategoryBlock) {
	const title = block.title ?? block.name;
	return block.description ? `${title}: ${block.description}` : `${title}.`;
}

/** "the lucide-react package and the shadcn/ui button component", etc. */
function describeDependencies(block: CategoryBlock) {
	const packages = block.dependencies ?? [];
	const registryDependencies = block.registryDependencies ?? [];
	const shadcn = registryDependencies.filter((item) => !isUrl(item));
	const tentui = registryDependencies
		.filter(isUrl)
		.map((url) => getRegistryNameFromUrl(url))
		.filter((name) => name !== undefined);

	const parts = [
		packages.length > 0 &&
			`the ${joinList(packages)} ${packages.length === 1 ? "package" : "packages"}`,
		shadcn.length > 0 &&
			`the shadcn/ui ${joinList(shadcn)} ${shadcn.length === 1 ? "component" : "components"}`,
		tentui.length > 0 &&
			`the TentUI ${joinList(tentui)} ${tentui.length === 1 ? "component" : "components"}`,
	].filter((part) => typeof part === "string");

	return parts.length > 0 ? joinList(parts) : undefined;
}

function isUrl(value: string) {
	return /^https?:\/\//.test(value);
}

function getRegistryNameFromUrl(url: string) {
	const [prefix, suffix] = registryConfig.namespaceUrl.split("{name}");
	if (!url.startsWith(prefix) || !url.endsWith(suffix)) return undefined;
	return url.slice(prefix.length, url.length - suffix.length);
}

function joinList(items: string[]) {
	if (items.length <= 1) return items.join("");
	if (items.length === 2) return `${items[0]} and ${items[1]}`;
	return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}
