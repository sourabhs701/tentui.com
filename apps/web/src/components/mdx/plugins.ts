import rehypePrettyCode, { type Options } from "rehype-pretty-code";
import { hastToHtml } from "shiki/core";
import { visit } from "unist-util-visit";
import { registry } from "@/registry";
import sourceFiles from "@/registry/__sources__.json";
import { getHighlighter } from "./highlighter";
import type { MdxAttribute, MdxNode, MdxTree } from "./mdx-types";

// Read file paths from the registry metadata, not @/registry/__index__. The
// index lazily imports every example, and importing it here would make every
// page that renders MDX ship all of those client components.
const registryFilePaths = new Map(
	registry.items.map((item) => [item.name, item.files?.[0]?.path]),
);
const componentSources = sourceFiles as Record<string, string>;

export function rehypeComponent() {
	return (tree: MdxTree) => {
		walkWithAncestors(tree as MdxNode, [], (node, ancestors) => {
			if (node.name !== "ComponentSource" && node.name !== "ComponentPreview")
				return;

			const sourcePath = getAttribute(node, "src");
			const name = getAttribute(node, "name");
			if (!sourcePath && !name) return;

			const filePath = resolveSourceFilePath({ name, src: sourcePath });
			if (!filePath)
				throw new Error(`Registry source was not found for ${name}`);

			const raw = componentSources[filePath];
			if (raw === undefined)
				throw new Error(`Component source was not generated for ${filePath}`);

			// Source in a tab that starts hidden (e.g. the "Manual" install tab)
			// isn't in the server HTML, yet highlighting it here would still put
			// every token in the page's RSC payload. Let the client fetch it from
			// /code/<path> when the tab opens.
			if (node.name === "ComponentSource" && isInHiddenTab(ancestors)) {
				node.attributes ??= [];
				node.attributes.push({
					type: "mdxJsxAttribute",
					name: "deferredSrc",
					value: filePath,
				} as MdxAttribute);
				return;
			}

			const title = getAttribute(node, "title");
			const showLineNumbers = getAttribute(node, "showLineNumbers");
			const meta = [
				title ? `title="${title}"` : "",
				showLineNumbers ? "showLineNumbers" : "",
			]
				.filter(Boolean)
				.join(" ");

			node.children ??= [];
			node.children.push({
				type: "element",
				tagName: "pre",
				properties: {},
				children: [
					{
						type: "element",
						tagName: "code",
						properties: {
							className: [`language-${getFileExtension(filePath)}`],
						},
						data: { meta },
						children: [{ type: "text", value: raw }],
					},
				],
			});
		});
	};
}

/**
 * The `__sources__.json` key for a `<ComponentSource>` or `<ComponentPreview>`:
 * its `src` path, or the first file of the registry item called `name`.
 */
export function resolveSourceFilePath({
	name,
	src,
}: {
	name?: string;
	src?: string;
}) {
	if (src) return getSourcePath(src);
	return name ? getRegistryFilePath(name) : undefined;
}

/** Highlights a source file the same way MDX code blocks are highlighted. */
export async function highlightSourceFile(filePath: string) {
	const raw = componentSources[filePath];
	if (raw === undefined) return null;

	const code: MdxNode = {
		type: "element",
		tagName: "code",
		properties: { className: [`language-${getFileExtension(filePath)}`] },
		children: [{ type: "text", value: raw }],
	};
	const tree = {
		type: "root",
		children: [
			{ type: "element", tagName: "pre", properties: {}, children: [code] },
		],
	};
	const transform = rehypeHighlightCode() as unknown as (
		tree: unknown,
	) => Promise<void>;
	await transform(tree);

	let highlighted: MdxNode | undefined;
	visit(tree as never, (rawNode: unknown) => {
		const node = rawNode as MdxNode;
		if (node.type === "element" && node.tagName === "code") highlighted = node;
	});
	if (!highlighted) return null;

	return {
		raw,
		language: getProperty(highlighted, "dataLanguage", "data-language"),
		theme: getProperty(highlighted, "dataTheme", "data-theme"),
		html: hastToHtml(highlighted.children as never),
	};
}

/** Every file `<ComponentSource>` points at in an MDX document. */
export function getComponentSourceFilePaths(content: string) {
	const paths = new Set<string>();
	for (const [, attributes = ""] of content.matchAll(
		/<ComponentSource\b([^>]*)>/g,
	)) {
		const filePath = resolveSourceFilePath({
			name: /\bname="([^"]+)"/.exec(attributes)?.[1],
			src: /\bsrc="([^"]+)"/.exec(attributes)?.[1],
		});
		if (filePath && filePath in componentSources) paths.add(filePath);
	}
	return paths;
}

function walkWithAncestors(
	node: MdxNode,
	ancestors: MdxNode[],
	visitor: (node: MdxNode, ancestors: MdxNode[]) => void,
) {
	visitor(node, ancestors);
	const path = [...ancestors, node];
	for (const child of node.children ?? []) {
		walkWithAncestors(child, path, visitor);
	}
}

// Default tab of each tabs component that can wrap MDX content.
const defaultTabValues: Record<string, (node: MdxNode) => string | undefined> =
	{
		CodeTabs: (node) => getAttribute(node, "defaultValue") ?? "cli",
		Tabs: (node) => getAttribute(node, "defaultValue"),
	};

function isInHiddenTab(ancestors: MdxNode[]) {
	for (let index = ancestors.length - 1; index >= 0; index--) {
		const panel = ancestors[index];
		if (panel?.name !== "TabsContent") continue;

		const value = getAttribute(panel, "value");
		const tabs = ancestors
			.slice(0, index)
			.findLast((node) => node.name && node.name in defaultTabValues);
		const defaultValue = tabs?.name
			? defaultTabValues[tabs.name]?.(tabs)
			: undefined;
		if (value !== undefined && value !== defaultValue) return true;
	}
	return false;
}

export function rehypeCodeRawString() {
	return (tree: MdxTree) => {
		visit(tree as never, (rawNode: unknown) => {
			const node = rawNode as MdxNode;
			if (node.type !== "element" || node.tagName !== "pre") return;
			const code = node.children?.[0];
			if (code?.tagName !== "code") return;
			node.__rawString__ = code.children?.[0]?.value;
		});
	};
}

export function rehypeHighlightCode() {
	return rehypePrettyCode({
		theme: { dark: "vesper", light: "github-light-default" },
		keepBackground: false,
		// Typed as the full bundled highlighter, but only core methods are used.
		getHighlighter: getHighlighter as unknown as Options["getHighlighter"],
		onVisitLine(node) {
			if (node.children.length === 0)
				node.children = [{ type: "text", value: " " }];
		},
	});
}

export function rehypeHighlightCodeRawString() {
	return (tree: MdxTree) => {
		visit(tree as never, (rawNode: unknown) => {
			const node = rawNode as MdxNode;
			if (node.type !== "element" || node.tagName !== "figure") return;
			if (!("data-rehype-pretty-code-figure" in (node.properties ?? {})))
				return;
			const pre = node.children?.at(-1);
			if (pre?.tagName !== "pre") return;
			pre.properties = {
				...pre.properties,
				__withMeta__: node.children?.[0]?.tagName === "figcaption",
				__rawString__: node.__rawString__,
			};
		});
	};
}

export function rehypeNpmCommand() {
	return (tree: MdxTree) => {
		visit(tree as never, (rawNode: unknown) => {
			const node = rawNode as MdxNode;
			if (node.type !== "element" || node.tagName !== "pre") return;
			const command = node.properties?.__rawString__;
			if (typeof command !== "string") return;

			if (command.startsWith("npm install")) {
				node.properties = {
					...node.properties,
					__pnpm__: command.replaceAll("npm install", "pnpm add"),
					__yarn__: command.replaceAll("npm install", "yarn add"),
					__npm__: command,
					__bun__: command.replaceAll("npm install", "bun add"),
				};
			}
			if (command.startsWith("npx shadcn")) {
				node.properties = {
					...node.properties,
					__pnpm__: command.replace("npx", "pnpm dlx"),
					__yarn__: command.replace("npx", "yarn dlx"),
					__npm__: command,
					__bun__: command.replace("npx", "bunx --bun"),
				};
			}
		});
	};
}

function getProperty(node: MdxNode, ...names: string[]) {
	for (const name of names) {
		const value = node.properties?.[name];
		if (value !== undefined) return String(value);
	}
	return "";
}

function getAttribute(node: MdxNode, name: string) {
	const attribute = node.attributes?.find((item) => item.name === name) as
		| MdxAttribute
		| undefined;
	return typeof attribute?.value === "string" ? attribute.value : undefined;
}

function getRegistryFilePath(name: string) {
	const filePath = registryFilePaths.get(name);
	if (!filePath) return undefined;
	return filePath.startsWith("src/") || filePath.startsWith("public/")
		? filePath
		: `src/registry/${filePath}`;
}

function getSourcePath(sourcePath: string) {
	return sourcePath.replaceAll("\\", "/");
}

function getFileExtension(filePath: string) {
	return /\.([^.\\/]+)$/.exec(filePath)?.[1] ?? "tsx";
}
