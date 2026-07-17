import { cache } from "react";
import { BlockViewer } from "@/app/(preview)/components/block-viewer";
import {
	createFileTreeForRegistryItemFiles,
	getRegistryItem,
	type HighlightedRegistryFile,
} from "@/lib/registry";

export async function BlockDisplay({ name }: { name: string }) {
	const item = await getCachedRegistryItem(name);

	if (!item?.files?.length) {
		return null;
	}

	const tree = await getCachedFileTree(item.files);

	const highlightedFiles = item.files as HighlightedRegistryFile[];

	return (
		<BlockViewer item={item} tree={tree} highlightedFiles={highlightedFiles} />
	);
}

const getCachedRegistryItem = cache(async (name: string) =>
	getRegistryItem(name),
);

const getCachedFileTree = cache(
	async (files: Array<{ path: string; target?: string }>) => {
		return createFileTreeForRegistryItemFiles(files);
	},
);
