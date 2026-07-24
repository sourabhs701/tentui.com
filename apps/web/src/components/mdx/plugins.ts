import rehypePrettyCode from "rehype-pretty-code";
import { visit } from "unist-util-visit";
import { Index } from "@/registry/__index__";
import sourceFiles from "@/registry/__sources__.json";
import type { MdxAttribute, MdxNode, MdxTree } from "./mdx-types";

type RegistryItem = {
	files?: Array<{ path: string }>;
};

const registryIndex = Index as unknown as Record<string, RegistryItem>;
const componentSources = sourceFiles as Record<string, string>;

export function rehypeComponent() {
	return (tree: MdxTree) => {
		visit(tree as never, (rawNode: unknown) => {
			const node = rawNode as MdxNode;
			if (node.name !== "ComponentSource" && node.name !== "ComponentPreview")
				return;

			const sourcePath = getAttribute(node, "src");
			const name = getAttribute(node, "name");
			if (!sourcePath && !name) return;

			const filePath = sourcePath
				? getSourcePath(sourcePath)
				: registryIndex[name ?? ""]?.files?.[0]?.path;
			if (!filePath)
				throw new Error(`Registry source was not found for ${name}`);

			const raw = componentSources[filePath];
			if (raw === undefined)
				throw new Error(`Component source was not generated for ${filePath}`);
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

function getAttribute(node: MdxNode, name: string) {
	const attribute = node.attributes?.find((item) => item.name === name) as
		| MdxAttribute
		| undefined;
	return typeof attribute?.value === "string" ? attribute.value : undefined;
}

function getSourcePath(sourcePath: string) {
	return sourcePath.replaceAll("\\", "/");
}

function getFileExtension(filePath: string) {
	return /\.([^.\\/]+)$/.exec(filePath)?.[1] ?? "tsx";
}
