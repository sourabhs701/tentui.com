import { cache } from "react";
import { BlockViewer } from "@/app/(preview)/components/block-viewer";
import { createFileTreeForRegistryItemFiles } from "@/lib/registry";
import { getHighlightedRegistryItem } from "@/lib/registry-highlighted";

export async function BlockDisplay({ name }: { name: string }) {
	const item = await getCachedRegistryItem(name);

	if (!item?.files?.length) {
		return null;
	}

	const tree = await getCachedFileTree(item.files);

	return <BlockViewer item={item} tree={tree} highlightedFiles={item.files} />;
}

const getCachedRegistryItem = cache(async (name: string) =>
	getHighlightedRegistryItem(name),
);

const getCachedFileTree = cache(
	async (files: Array<{ path: string; target?: string }>) => {
		return createFileTreeForRegistryItemFiles(files);
	},
);
