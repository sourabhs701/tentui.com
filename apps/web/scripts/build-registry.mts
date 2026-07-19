import { promises as fs } from "node:fs";
import path from "node:path";
import {
	type Registry,
	type RegistryItem,
	registrySchema,
} from "shadcn/schema";
import { codeToHtml } from "shiki";

import { formatCode } from "../src/lib/format-code";
import {
	basename,
	dirname,
	normalizeProjectPath,
	relativePath,
} from "../src/lib/registry-paths";
import { processFileContent } from "../src/lib/registry-transform";
import { registry } from "../src/registry/index";

const appRoot = process.cwd();
const registryPath = path.join(appRoot, "src/registry");

function withLocalFilePaths(item: RegistryItem): RegistryItem {
	return {
		...item,
		files:
			item.files?.map((file) => ({
				...file,
				path:
					file.path.startsWith("src/") || file.path.startsWith("public/")
						? file.path
						: `src/registry/${file.path}`,
			})) ?? [],
	};
}

function getComponentImportPath(item: RegistryItem) {
	const componentFile = item.files?.find((file) =>
		["registry:block", "registry:component", "registry:example"].includes(
			file.type,
		),
	);

	if (!componentFile) {
		return null;
	}

	const filePath = componentFile.path.startsWith("src/")
		? componentFile.path.replace(/^src\//, "@/")
		: `@/registry/${componentFile.path}`;

	return filePath.replace(/\.(?:ts|tsx)$/, "");
}

function serialize(value: unknown) {
	return JSON.stringify(value);
}

function languageFromPath(filePath: string) {
	const ext = basename(filePath).split(".").pop()?.toLowerCase();
	switch (ext) {
		case "ts":
			return "ts";
		case "tsx":
			return "tsx";
		case "js":
			return "js";
		case "jsx":
			return "jsx";
		case "css":
			return "css";
		case "json":
			return "json";
		case "md":
		case "mdx":
			return "markdown";
		default:
			return "tsx";
	}
}

async function highlightCode(code: string, language: string) {
	return codeToHtml(code, {
		lang: language,
		themes: {
			dark: "vesper",
			light: "github-light",
		},
		defaultColor: false,
		transformers: [
			{
				pre(node) {
					node.properties.style = "";
				},
				code(node) {
					node.properties["data-line-numbers"] = "";
					node.properties.style = "display: grid";
				},
				line(node) {
					node.properties["data-line"] = "";
				},
			},
		],
	});
}

function getFileTarget(
	file: NonNullable<RegistryItem["files"]>[number],
): string {
	if (file.target) {
		return file.target.replace(
			/^@(components|ui|hooks|lib)\/(.+)$/,
			(_original, type: string, rest: string) => {
				if (type === "components") return `components/${rest}`;
				if (type === "ui") return `components/ui/${rest}`;
				if (type === "hooks") return `hooks/${rest}`;
				if (type === "lib") return `lib/${rest}`;
				return _original;
			},
		);
	}

	const fileName = basename(file.path);
	if (
		file.type === "registry:block" ||
		file.type === "registry:component" ||
		file.type === "registry:example"
	) {
		return `components/${fileName}`;
	}
	if (file.type === "registry:ui") return `components/ui/${fileName}`;
	if (file.type === "registry:hook") return `hooks/${fileName}`;
	if (file.type === "registry:lib") return `lib/${fileName}`;
	return "";
}

function fixDisplayFilePaths(
	files: Array<
		NonNullable<RegistryItem["files"]>[number] & {
			content: string;
			highlightedContent: string;
		}
	>,
) {
	if (files.length === 0) return [];

	const normalized = files.map((file) => ({
		...file,
		path: normalizeProjectPath(file.path),
	}));
	const firstDir = dirname(normalized[0].path);

	return normalized.map((file) => ({
		...file,
		path: relativePath(firstDir, file.path),
		target: getFileTarget(file),
	}));
}

async function readSourceFile(relativeOrAbsolute: string) {
	const absolutePath = path.isAbsolute(relativeOrAbsolute)
		? relativeOrAbsolute
		: path.join(appRoot, relativeOrAbsolute);
	return fs.readFile(absolutePath, "utf8");
}

/**
 * Build edge-safe display payload for one registry item.
 * Content + syntax highlighting are baked in so Workers never call fs/shiki/ts-morph.
 */
async function buildDisplayItem(item: RegistryItem) {
	const localItem = withLocalFilePaths(item);

	const preparedFiles = await Promise.all(
		(localItem.files ?? []).map(async (file) => {
			const raw = await readSourceFile(file.path);
			const processed = processFileContent(file.type, raw);
			// formatCode uses ts-morph (Node-only) — fine here at build time.
			const formatted = await formatCode(processed, "base-lyra");
			const highlightedContent = await highlightCode(
				formatted,
				languageFromPath(file.path),
			);

			return {
				...file,
				content: formatted,
				highlightedContent,
			};
		}),
	);

	const files = fixDisplayFilePaths(preparedFiles);

	return {
		name: localItem.name,
		title: localItem.title,
		description: localItem.description ?? "",
		type: localItem.type,
		files,
		categories: localItem.categories,
		meta: localItem.meta,
		dependencies: localItem.dependencies,
		registryDependencies: localItem.registryDependencies,
	};
}

/** Slim index: lazy components + metadata only (no source content). */
function buildIndexSource(items: RegistryItem[]) {
	const entries = items
		.filter((item) => item.files?.length)
		.map((item) => {
			const localItem = withLocalFilePaths(item);
			const componentImportPath = getComponentImportPath(item);
			const component = componentImportPath
				? `React.lazy(async () => {
			const module = (await import(${serialize(componentImportPath)})) as unknown as {
				default?: React.ComponentType;
			};
			if (!module.default) {
				throw new Error(${serialize(`No default export found for ${item.name}`)});
			}
			return { default: module.default };
		})`
				: "null";

			// Paths only (no content) — display uses __items__.json
			const filesMeta = (localItem.files ?? []).map(
				({ path: filePath, type, target }) => ({
					path: filePath,
					type,
					target,
				}),
			);

			return `${serialize(item.name)}: {
		name: ${serialize(localItem.name)},
		title: ${serialize(localItem.title)},
		description: ${serialize(localItem.description ?? "")},
		type: ${serialize(localItem.type)},
		files: ${serialize(filesMeta)},
		component: ${component},
		categories: ${serialize(localItem.categories)},
		meta: ${serialize(localItem.meta)},
	}`;
		});

	return `// This file is autogenerated by scripts/build-registry.mts.
// Do not edit this file directly.
// Component index for previews. File contents live in __items__.json (Workers-safe).

import * as React from "react";

export const Index = {
	${entries.join(",\n\t")}
} as const;

export type RegistryIndexName = keyof typeof Index;
`;
}

function createdAtTimestamp(item: RegistryItem) {
	const createdAt = item.meta?.createdAt;
	return typeof createdAt === "string" ? new Date(createdAt).getTime() : 0;
}

function buildBlocksPayload(items: RegistryItem[]) {
	return items
		.filter((item) => item.type === "registry:block")
		.toSorted((a, b) => createdAtTimestamp(b) - createdAtTimestamp(a))
		.map((item) => ({
			name: item.name,
			description: item.description,
			categories: item.categories,
		}));
}

async function readFileIfExists(filePath: string) {
	try {
		return await fs.readFile(filePath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw error;
	}
}

async function writeIfChanged(filePath: string, content: string) {
	if ((await readFileIfExists(filePath)) === content) {
		return false;
	}

	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, content, "utf8");
	return true;
}

export async function buildRegistry(sourceRegistry: Registry) {
	const parsed = registrySchema.safeParse(sourceRegistry);
	if (!parsed.success) {
		throw new Error(`Invalid registry:\n${parsed.error.message}`);
	}

	const publicRegistry = {
		$schema: "https://ui.shadcn.com/schema/registry.json",
		name: "tentui",
		homepage: "https://tentui.com/blocks",
		items: parsed.data.items
			.filter((item) => item.type !== "registry:example")
			.map(withLocalFilePaths),
	};

	const displayEntries = await Promise.all(
		parsed.data.items
			.filter((item) => item.files?.length)
			.map(async (item) => [item.name, await buildDisplayItem(item)] as const),
	);
	const displayItems = Object.fromEntries(displayEntries);

	const outputs = [
		{
			path: path.join(appRoot, "registry.json"),
			content: `${JSON.stringify(publicRegistry, null, 2)}\n`,
		},
		{
			path: path.join(registryPath, "__index__.tsx"),
			content: buildIndexSource(parsed.data.items),
		},
		{
			path: path.join(registryPath, "__items__.json"),
			content: `${JSON.stringify(displayItems, null, 2)}\n`,
		},
		{
			path: path.join(registryPath, "__blocks__.json"),
			content: `${JSON.stringify(buildBlocksPayload(parsed.data.items), null, 2)}\n`,
		},
	];

	const changed = await Promise.all(
		outputs.map(async (output) => ({
			path: path.relative(appRoot, output.path),
			changed: await writeIfChanged(output.path, output.content),
		})),
	);

	for (const output of changed) {
		console.log(`${output.changed ? "wrote" : "unchanged"} ${output.path}`);
	}
}

await buildRegistry(registry);
