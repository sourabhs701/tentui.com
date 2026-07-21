import "server-only";

import type { GeneratedDoc, Generator } from "fumadocs-typescript";
import type { Nodes } from "hast";
import { type Jsx, toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ComponentProps, ReactNode } from "react";
import * as runtime from "react/jsx-runtime";
import {
	componentPropsOnly,
	componentPropTag,
} from "./auto-type-table-generator";
import { mdxCodeBlockComponents } from "./code-block";
import { markdownRenderer } from "./markdown";
import { parseTags } from "./parse-tags";
import type { ParameterNode, TypeNode } from "./type-table";
import { TypeTable } from "./type-table";

export type AutoTypeTableProps = ComponentProps<"div"> & {
	include?: string[];
	path?: string;
	name?: string;
	type?: string;
	generator: Generator;
};

export async function AutoTypeTable({
	generator,
	include,
	name,
	path,
	type,
	...props
}: AutoTypeTableProps) {
	const renderer = markdownRenderer();
	const output = (await generator.generateTypeTable(
		{
			name,
			path,
			type,
		},
		componentPropsOnly,
	)) as GeneratedDoc[];

	return Promise.all(
		output.map(async (item) => {
			const componentProps = include
				? include.flatMap((name) => {
						const entry = item.entries.find((item) => item.name === name);
						return entry ? [entry] : [];
					})
				: item.entries.filter(
						(entry) =>
							entry.name !== "children" &&
							entry.tags.some((tag) => tag.name === componentPropTag),
					);
			const entries = await Promise.all(
				componentProps.map(async (entry): Promise<[string, TypeNode]> => {
					const tags = parseTags(entry.tags);
					const parameters: ParameterNode[] = await Promise.all(
						(tags.params ?? []).map(async (parameter) => ({
							name: parameter.name,
							description: parameter.description
								? toJsx(
										await renderer.renderMarkdownToHast(parameter.description),
									)
								: undefined,
						})),
					);

					return [
						entry.name,
						{
							type: toJsx(
								await renderer.renderTypeToHast(entry.simplifiedType),
							),
							typeDescription: toJsx(
								await renderer.renderTypeToHast(entry.type),
							),
							typeDescriptionLink: entry.typeHref,
							description: toJsx(
								await renderer.renderMarkdownToHast(entry.description),
							),
							default: tags.default
								? toJsx(await renderer.renderTypeToHast(tags.default))
								: undefined,
							parameters,
							required: entry.required,
							deprecated: entry.deprecated,
							example: tags.example
								? toJsx(await renderer.renderMarkdownToHast(tags.example))
								: undefined,
							returns: tags.returns
								? toJsx(await renderer.renderMarkdownToHast(tags.returns))
								: undefined,
						},
					];
				}),
			);

			return (
				<TypeTable
					key={item.name}
					id={`type-table-${item.id}`}
					type={Object.fromEntries(entries)}
					{...props}
				/>
			);
		}),
	);
}

function toJsx(hast: Nodes): ReactNode {
	return toJsxRuntime(hast, {
		Fragment: runtime.Fragment,
		jsx: runtime.jsx as Jsx,
		jsxs: runtime.jsxs as Jsx,
		components: mdxCodeBlockComponents,
	});
}
