import type { RegistryItem } from "shadcn/schema";
import { registryItemSchema } from "shadcn/schema";

import {
	basename,
	dirname,
	normalizeProjectPath,
	relativePath,
} from "@/lib/registry-paths";
import items from "@/registry/__items__.json";

export { fixImport, processFileContent } from "@/lib/registry-transform";

export type HighlightedRegistryFile = NonNullable<
	RegistryItem["files"]
>[number] & {
	highlightedContent: string;
};

export type RegistryDisplayItem = RegistryItem & {
	files: HighlightedRegistryFile[];
};

const displayItems = items as Record<string, RegistryDisplayItem>;

export async function getRegistryItem(
	name: string,
): Promise<RegistryDisplayItem | null> {
	const item = displayItems[name];
	if (!item) return null;

	const result = registryItemSchema.safeParse(item);
	if (!result.success) {
		console.error(`[registry] Invalid item "${name}":`, result.error.message);
		return null;
	}

	const files = (result.data.files ?? []).map((file, index) => ({
		...file,
		highlightedContent: item.files[index]?.highlightedContent ?? "",
	}));

	return {
		...result.data,
		files,
	} as RegistryDisplayItem;
}

export function getRegistryDisplayItem(
	name: string,
): RegistryDisplayItem | null {
	return displayItems[name] ?? null;
}

export function listRegistryDisplayItems(): RegistryDisplayItem[] {
	return Object.values(displayItems);
}

export function fixFilePaths(files: NonNullable<RegistryItem["files"]>) {
	if (files.length === 0) {
		return [];
	}

	const normalized = files.map((file) => ({
		...file,
		path: normalizeProjectPath(file.path),
	}));

	const firstFilePathDir = dirname(normalized[0].path);

	return normalized.map((file) => ({
		...file,
		path: relativePath(firstFilePathDir, file.path),
		target: getFileTarget(file),
	}));
}

function getFileTarget(file: NonNullable<RegistryItem["files"]>[number]) {
	if (file.target) {
		return normalizeAliasTarget(file.target);
	}

	const fileName = basename(file.path);

	if (
		file.type === "registry:block" ||
		file.type === "registry:component" ||
		file.type === "registry:example"
	) {
		return `components/${fileName}`;
	}
	if (file.type === "registry:ui") {
		return `components/ui/${fileName}`;
	}
	if (file.type === "registry:hook") {
		return `hooks/${fileName}`;
	}
	if (file.type === "registry:lib") {
		return `lib/${fileName}`;
	}

	return "";
}

function normalizeAliasTarget(target: string) {
	return target.replace(
		/^@(components|ui|hooks|lib)\/(.+)$/,
		(original, type: string, rest: string) => {
			if (type === "components") {
				return `components/${rest}`;
			}
			if (type === "ui") {
				return `components/ui/${rest}`;
			}
			if (type === "hooks") {
				return `hooks/${rest}`;
			}
			if (type === "lib") {
				return `lib/${rest}`;
			}

			return original;
		},
	);
}

export type FileTree = {
	name: string;
	path?: string;
	children?: FileTree[];
};

export function createFileTreeForRegistryItemFiles(
	files: Array<{ path: string; target?: string }>,
) {
	const root: FileTree[] = [];

	for (const file of files) {
		const filePath = file.target ?? file.path;
		const parts = filePath.split("/");
		let currentLevel = root;

		for (const [index, part] of parts.entries()) {
			const isFile = index === parts.length - 1;
			const existingNode = currentLevel.find((node) => node.name === part);

			if (existingNode) {
				if (isFile) {
					existingNode.path = filePath;
				} else {
					existingNode.children ??= [];
					currentLevel = existingNode.children;
				}
				continue;
			}

			const newNode: FileTree = isFile
				? { name: part, path: filePath }
				: { name: part, children: [] };

			currentLevel.push(newNode);
			if (!isFile && newNode.children) {
				currentLevel = newNode.children;
			}
		}
	}

	return root;
}
