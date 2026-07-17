import fs from "node:fs";
import path from "node:path";
import rehypePrettyCode from "rehype-pretty-code";
import { visit } from "unist-util-visit";
import { fixImport } from "@/lib/registry-transform";
import { Index } from "@/registry/__index__";
import type { MdxAttribute, MdxNode, MdxTree } from "./mdx-types";

type RegistryItem = {
	files?: Array<{ path: string }>;
};

const registryIndex = Index as unknown as Record<string, RegistryItem>;

export function remarkCodeImport() {
	return (tree: MdxTree, file: { dirname?: string }) => {
		visit(tree as never, "code", (rawNode: unknown) => {
			const node = rawNode as MdxNode & { meta?: string };
			const fileMeta = node.meta
				?.split(/(?<!\\) /g)
				.find((meta) => meta.startsWith("file="));
			if (!fileMeta) return;

			const match = /^file=(.+?)(?:(?:#(?:L(\d+)(-)?)?)(?:L(\d+))?)?$/.exec(
				fileMeta,
			);
			if (!match?.[1]) throw new Error(`Unable to parse ${fileMeta}`);

			const rootDirectory = path.join(
				/* turbopackIgnore: true */ process.cwd(),
				"src",
			);
			const filePath = path.resolve(
				file.dirname ?? /* turbopackIgnore: true */ process.cwd(),
				match[1].replace(/^@/, rootDirectory).replace(/\\ /g, " "),
			);
			const relativePath = path.relative(rootDirectory, filePath);
			if (
				relativePath.startsWith(`..${path.sep}`) ||
				path.isAbsolute(relativePath)
			) {
				throw new Error(`Code import must stay under ${rootDirectory}`);
			}

			const lines = fs
				.readFileSync(/* turbopackIgnore: true */ filePath, "utf8")
				.split(/\r?\n/);
			const from = match[2] ? Number(match[2]) : 1;
			const to = match[4] ? Number(match[4]) : lines.length;
			node.value = lines.slice(from - 1, to).join("\n");
		});
	};
}

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

			const raw = fs.readFileSync(/* turbopackIgnore: true */ filePath, "utf8");
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
							className: [`language-${path.extname(filePath).slice(1)}`],
						},
						data: { meta },
						children: [{ type: "text", value: fixImport(raw) }],
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
	const applicationRoot = /* turbopackIgnore: true */ process.cwd();
	const absolutePath = path.resolve(applicationRoot, sourcePath);
	const relativePath = path.relative(applicationRoot, absolutePath);
	if (
		relativePath.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relativePath)
	) {
		throw new Error(
			`Component source must stay inside the application root: ${sourcePath}`,
		);
	}
	return absolutePath;
}
