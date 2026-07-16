import { promises as fs } from "node:fs";
import path from "node:path";
import { LRUCache } from "lru-cache";
import { type RegistryItem, registryItemSchema } from "shadcn/schema";

import { Index } from "@/registry/__index__";

const registryCache = new LRUCache<string, RegistryItem | false>({
	max: 500,
	ttl: 1000 * 60 * 5,
});

export async function getRegistryItem(name: string) {
	const cached = registryCache.get(name);
	if (cached !== undefined) {
		return cached || null;
	}

	const item = Index[name as keyof typeof Index];
	if (!item) {
		registryCache.set(name, false);
		return null;
	}

	const result = registryItemSchema.safeParse(item);
	if (!result.success) {
		registryCache.set(name, false);
		return null;
	}

	const files = fixFilePaths(
		await Promise.all(
			result.data.files?.map(async (file) => ({
				...file,
				path: path.relative(process.cwd(), file.path),
				content: await getFileContent(file),
			})) ?? [],
		),
	);

	const parsed = registryItemSchema.safeParse({
		...result.data,
		files,
	});

	if (!parsed.success) {
		console.error(parsed.error.message);
		registryCache.set(name, false);
		return null;
	}

	registryCache.set(name, parsed.data);
	return parsed.data;
}

async function getFileContent(
	file: NonNullable<RegistryItem["files"]>[number],
) {
	let code = await fs.readFile(file.path, "utf8");

	if (file.type !== "registry:page") {
		code = code.replaceAll("export default", "export");
	}

	return fixImport(code);
}

export function fixImport(content: string) {
	let fixed = content
		.replaceAll("@tentui.com/ui/components/", "@/components/ui/")
		.replaceAll("@tentui.com/ui/hooks/", "@/hooks/")
		.replaceAll("@tentui.com/ui/lib/", "@/lib/");

	const registryAlias =
		/@\/(.+?)\/((?:.*?\/)?(?:components|ui|hooks|lib))\/([\w/-]+)/g;

	fixed = fixed.replace(
		registryAlias,
		(match, _registryPath: string, type: string, itemPath: string) => {
			if (type.endsWith("components")) {
				return `@/components/${itemPath}`;
			}
			if (type.endsWith("ui")) {
				return `@/components/ui/${itemPath}`;
			}
			if (type.endsWith("hooks")) {
				return `@/hooks/${itemPath}`;
			}
			if (type.endsWith("lib")) {
				return `@/lib/${itemPath}`;
			}

			return match;
		},
	);

	return fixed;
}

function fixFilePaths(files: NonNullable<RegistryItem["files"]>) {
	if (files.length === 0) {
		return [];
	}

	const firstFilePathDir = path.dirname(files[0].path);

	return files.map((file) => ({
		...file,
		path: path.relative(firstFilePathDir, file.path),
		target: getFileTarget(file),
	}));
}

function getFileTarget(file: NonNullable<RegistryItem["files"]>[number]) {
	if (file.target) {
		return normalizeAliasTarget(file.target);
	}

	const fileName = path.basename(file.path);

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
