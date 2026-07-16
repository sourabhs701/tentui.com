import type { RegistryItem } from "shadcn/schema";

import { blockCategories } from "@/config/registry";

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
	const { Index } = await import("@/registry/__index__");
	const params: Array<{ category: string; name: string }> = [];

	for (const category of blockCategories) {
		for (const item of Object.values(Index)) {
			if (
				item.type === "registry:block" &&
				item.categories?.some(
					(itemCategory: string) => itemCategory === category.name,
				)
			) {
				params.push({ category: category.name, name: item.name });
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
	const { Index } = await import("@/registry/__index__");
	const { registryItemSchema } = await import("shadcn/schema");

	return Object.values(Index)
		.map((item) => {
			const result = registryItemSchema.safeParse(item);
			return result.success ? result.data : null;
		})
		.filter((item): item is RegistryItem => item !== null)
		.filter(
			(item) =>
				types.includes(item.type) &&
				(categories.length === 0 ||
					item.categories?.some((category) => categories.includes(category))),
		)
		.sort(compareBlocksByCreatedAtDesc);
}
