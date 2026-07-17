import type { RegistryItem } from "shadcn/schema";

import { blockCategories } from "@/config/registry";
import { listRegistryDisplayItems } from "@/lib/registry";

type DatedBlock = {
	meta?: ({ createdAt?: string } & Record<string, unknown>) | undefined;
};

export function compareBlocksByCreatedAtDesc(a: DatedBlock, b: DatedBlock) {
	const dateA = a.meta?.createdAt ? new Date(a.meta.createdAt).getTime() : 0;
	const dateB = b.meta?.createdAt ? new Date(b.meta.createdAt).getTime() : 0;
	return dateB - dateA;
}

export async function getAllBlockStaticParams(): Promise<
	Array<{ category: string; name: string }>
> {
	const blocks = await getAllBlocks(["registry:block"]);
	const params: Array<{ category: string; name: string }> = [];

	for (const block of blocks) {
		for (const category of blockCategories) {
			if (block.categories?.includes(category.name)) {
				params.push({ category: category.name, name: block.name });
			}
		}
	}

	return params;
}

export async function getAllBlockIds(
	types: RegistryItem["type"][] = ["registry:block"],
	categories: string[] = [],
): Promise<string[]> {
	const blocks = await getAllBlocks(types, categories);
	return blocks.map((block) => block.name);
}

export async function getAllBlocks(
	types: RegistryItem["type"][] = ["registry:block"],
	categories: string[] = [],
) {
	return listRegistryDisplayItems()
		.filter(
			(item) =>
				types.includes(item.type) &&
				(categories.length === 0 ||
					item.categories?.some((category) => categories.includes(category))),
		)
		.sort(compareBlocksByCreatedAtDesc);
}
