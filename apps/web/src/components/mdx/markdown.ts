import { highlightHast } from "fumadocs-core/highlight";
import type { ElementContent, Nodes } from "hast";
import rehypeExternalLinks from "rehype-external-links";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import {
	rehypeCodeRawString,
	rehypeHighlightCode,
	rehypeHighlightCodeRawString,
} from "./plugins";

export function markdownRenderer() {
	const processor = remark()
		.use(remarkGfm)
		.use(remarkRehype)
		.use(rehypeExternalLinks, { target: "_blank", rel: "nofollow noopener" })
		.use(rehypeCodeRawString)
		.use(rehypeHighlightCode)
		.use(rehypeHighlightCodeRawString);

	return {
		async renderTypeToHast(type: string): Promise<Nodes> {
			const nodes = await highlightHast(type, {
				lang: "ts",
				structure: "inline",
				themes: { dark: "vesper", light: "github-light" },
				defaultColor: false,
			});
			return {
				type: "element",
				tagName: "code",
				properties: {},
				children: [
					{
						type: "element",
						tagName: "span",
						properties: { "data-line": "" },
						children: nodes.children as ElementContent[],
					},
				],
			};
		},
		renderMarkdownToHast(markdown: string) {
			return processor.run(
				processor.parse(markdown.replace(/{@link ([^}]*)}/g, "$1")),
			);
		},
	};
}
