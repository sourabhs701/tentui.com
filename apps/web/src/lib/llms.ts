import "server-only";

import fs from "node:fs";
import path from "node:path";
import { remarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import {
	autoTypeTableGenerator,
	componentPropsOnly,
	componentPropTag,
} from "@/components/mdx/auto-type-table-generator";
import type { Doc } from "@/lib/documents";
import type { RegistryDisplayItem } from "@/lib/registry";
import { fixImport } from "@/lib/registry-transform";
import { Index } from "@/registry/__index__";
import { getRegistryItemNamespace, getRegistryItemUrl } from "@/utils/registry";

type LLMNode = {
	type: string;
	name?: string | null;
	value?: string;
	lang?: string;
	meta?: string;
	depth?: number;
	align?: Array<"left" | "right" | "center" | null>;
	attributes?: Array<{
		type: string;
		name?: string;
		value?: string | { value?: string } | null;
	}>;
	children?: LLMNode[];
};

type LLMParent = LLMNode & { children: LLMNode[] };

type RegistryIndexItem = {
	files?: Array<string | { path: string }>;
};

const registryIndex = Index as unknown as Record<string, RegistryIndexItem>;
const transparentWrapperNames = new Set(["CodeTabs", "Steps"]);

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "long",
	day: "numeric",
	timeZone: "UTC",
});

const processor = remark()
	.use(remarkMdx)
	.use(remarkGfm)
	.use(remarkHeading)
	.use(remarkLLMContent);

export async function getComponentLLMText(doc: Doc) {
	const processed = await processor.process({ value: doc.content });

	return `# ${doc.metadata.title}

${doc.metadata.description}

${String(processed.value).trim()}

Last updated on ${formatDate(doc.metadata.updatedAt)}`;
}

export function getBlockLLMText(block: RegistryDisplayItem) {
	const title = block.title ?? block.name;
	const categories = block.categories?.join(", ") || "Uncategorized";
	const dependencies = block.dependencies ?? [];
	const registryDependencies = block.registryDependencies ?? [];
	const sourceFiles = block.files.filter(
		(file) => file.type !== "registry:file" && file.content,
	);
	const assetFiles = block.files.filter(
		(file) => file.type === "registry:file",
	);
	const addedAt = getCreatedAt(block);

	const sections = [
		`# ${title}`,
		block.description ?? "A production-ready TentUI block.",
		`- Registry item: [${block.name}](${getRegistryItemUrl(block.name)})\n- Categories: ${categories}`,
		`## Installation\n\n\`\`\`bash\nnpx shadcn@latest add ${getRegistryItemNamespace(block.name)}\n\`\`\``,
	];

	if (dependencies.length > 0) {
		sections.push(
			`## Package dependencies\n\n${dependencies.map((item) => `- \`${item}\``).join("\n")}`,
		);
	}

	if (registryDependencies.length > 0) {
		sections.push(
			`## Registry dependencies\n\n${registryDependencies.map((item) => `- \`${item}\``).join("\n")}`,
		);
	}

	if (assetFiles.length > 0) {
		sections.push(
			`## Assets\n\n${assetFiles
				.map(
					(file) =>
						`- \`${file.target ?? file.path}\` (source: \`${file.path}\`)`,
				)
				.join("\n")}`,
		);
	}

	if (sourceFiles.length > 0) {
		sections.push(
			`## Source files\n\n${sourceFiles
				.map((file) => {
					const fileName = file.target ?? file.path;
					return `### ${fileName}\n\n\`\`\`${getLanguage(fileName)}\n${file.content?.trim()}\n\`\`\``;
				})
				.join("\n\n")}`,
		);
	}

	if (addedAt) {
		sections.push(`Added on ${formatDate(addedAt)}`);
	}

	return sections.join("\n\n");
}

export function getCreatedAt(item: RegistryDisplayItem) {
	const meta = item.meta as { createdAt?: unknown } | undefined;
	return typeof meta?.createdAt === "string" ? meta.createdAt : undefined;
}

export function getISODate(value: unknown) {
	return getDate(value).toISOString().slice(0, 10);
}

function remarkLLMContent() {
	return async (tree: LLMParent) => {
		await transformChildren(tree);
	};
}

async function transformChildren(parent: LLMParent) {
	let index = 0;

	while (index < parent.children.length) {
		const node = parent.children[index];

		if (node.name === "ComponentPreview" || node.name === "ComponentSource") {
			parent.children.splice(index, 1, getComponentCodeNode(node));
			index += 1;
			continue;
		}

		if (node.name === "AutoTypeTable") {
			const typeTableNodes = await getTypeTableNodes(node);
			parent.children.splice(index, 1, ...typeTableNodes);
			index += typeTableNodes.length;
			continue;
		}

		if (node.children) {
			await transformChildren(node as LLMParent);
		}

		if (node.name === "TabsListInstallType") {
			parent.children.splice(index, 1);
			continue;
		}

		if (node.name === "Step") {
			parent.children.splice(index, 1, {
				type: "heading",
				depth: 3,
				children: [{ type: "text", value: getText(node) }],
			});
			index += 1;
			continue;
		}

		if (node.name === "TabsContent") {
			const value = getStringAttribute(node, "value");
			const children = node.children ?? [];
			const heading = value
				? [
						{
							type: "heading",
							depth: 3,
							children: [
								{
									type: "text",
									value:
										value === "cli"
											? "CLI"
											: value === "manual"
												? "Manual"
												: value,
								},
							],
						},
					]
				: [];

			parent.children.splice(index, 1, ...heading, ...children);
			index += heading.length + children.length;
			continue;
		}

		if (node.name && transparentWrapperNames.has(node.name)) {
			const children = node.children ?? [];
			parent.children.splice(index, 1, ...children);
			index += children.length;
			continue;
		}

		index += 1;
	}
}

function getComponentCodeNode(node: LLMNode): LLMNode {
	const sourcePath = getStringAttribute(node, "src");
	const name = getStringAttribute(node, "name");
	const fileName = getStringAttribute(node, "fileName");
	const indexedFiles = name ? (registryIndex[name]?.files ?? []) : [];
	const indexedFile = fileName
		? indexedFiles.find((file) => getIndexedPath(file).endsWith(fileName))
		: indexedFiles[0];
	const requestedPath =
		sourcePath ?? (indexedFile && getIndexedPath(indexedFile));

	if (!requestedPath) {
		throw new Error(`LLM source was not found for ${name ?? "component"}`);
	}

	const filePath = resolveApplicationPath(requestedPath);
	const title = getStringAttribute(node, "title");
	const showLineNumbers = getStringAttribute(node, "showLineNumbers");
	const meta = [
		title ? `title="${title}"` : "",
		showLineNumbers ? "showLineNumbers" : "",
	]
		.filter(Boolean)
		.join(" ");

	return {
		type: "code",
		lang: getLanguage(filePath),
		meta,
		value: fixImport(fs.readFileSync(filePath, "utf8")),
	};
}

async function getTypeTableNodes(node: LLMNode): Promise<LLMNode[]> {
	const path = getStringAttribute(node, "path");
	const name = getStringAttribute(node, "name");
	const type = getStringAttribute(node, "type");
	const docs = await autoTypeTableGenerator.generateTypeTable(
		{ path, name, type },
		componentPropsOnly,
	);

	return docs.flatMap((doc) => {
		const componentEntries = doc.entries.filter(
			(entry) =>
				entry.name !== "children" &&
				entry.tags.some((tag) => tag.name === componentPropTag),
		);
		const entries =
			componentEntries.length > 0
				? componentEntries
				: doc.entries.filter((entry) => entry.name !== "children");

		return [
			{
				type: "heading",
				depth: 3,
				children: [{ type: "text", value: doc.name }],
			},
			{
				type: "table",
				align: [null, null, null, null],
				children: [
					getTableRow(["Property", "Type", "Required", "Description"]),
					...entries.map((entry) =>
						getTableRow([
							entry.name,
							entry.type,
							entry.required ? "Yes" : "No",
							entry.description || "—",
						]),
					),
				],
			},
		];
	});
}

function getTableRow(values: string[]): LLMNode {
	return {
		type: "tableRow",
		children: values.map((value) => ({
			type: "tableCell",
			children: [{ type: "text", value }],
		})),
	};
}

function getStringAttribute(node: LLMNode, name: string) {
	const attribute = node.attributes?.find((item) => item.name === name);
	return typeof attribute?.value === "string" ? attribute.value : undefined;
}

function getIndexedPath(file: string | { path: string }) {
	return typeof file === "string" ? file : file.path;
}

function resolveApplicationPath(requestedPath: string) {
	const sourceRoot = path.join(process.cwd(), "src");
	const sourcePath = requestedPath.replace(/^src[\\/]/, "");
	const absolutePath = path.resolve(sourceRoot, sourcePath);
	const relativePath = path.relative(sourceRoot, absolutePath);

	if (
		relativePath.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relativePath)
	) {
		throw new Error("LLM source must stay inside the web source directory");
	}

	return absolutePath;
}

function getText(node: LLMNode): string {
	if (node.value) return node.value;
	return node.children?.map(getText).join("") ?? "Step";
}

function getLanguage(filePath: string) {
	const extension = path.extname(filePath).slice(1);
	return extension || "text";
}

function formatDate(value: unknown) {
	return dateFormatter.format(getDate(value));
}

function getDate(value: unknown) {
	const date =
		value instanceof Date
			? value
			: new Date(
					typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
						? `${value}T00:00:00Z`
						: String(value),
				);

	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid LLM document date: ${String(value)}`);
	}

	return date;
}
