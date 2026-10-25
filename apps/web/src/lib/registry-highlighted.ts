import { getRegistryItem, type HighlightedRegistryItem } from "@/lib/registry";
import highlighted from "@/registry/__highlighted__.json";

// Kept apart from @/lib/registry so only the block viewer bundles the
// highlighted HTML, not every route that reads registry metadata.
const highlightedItems = highlighted as Record<string, string[]>;

export async function getHighlightedRegistryItem(
	name: string,
): Promise<HighlightedRegistryItem | null> {
	const item = await getRegistryItem(name);
	if (!item) return null;

	return {
		...item,
		files: item.files.map((file, index) => ({
			...file,
			highlightedContent: highlightedItems[name]?.[index] ?? "",
		})),
	};
}
