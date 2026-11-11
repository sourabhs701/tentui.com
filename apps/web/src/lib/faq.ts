import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";

/**
 * FAQ sections in component MDX are the single source of truth for the
 * on-page FAQ and its FAQPage JSON-LD. The format is:
 *
 *   ## FAQ
 *
 *   ### Question ending in a question mark?
 *
 *   Answer paragraph(s), plain Markdown.
 *
 * The section ends at the next `##` heading or the end of the file.
 */
export const FAQ_HEADING = "FAQ";

export type FaqItem = {
	question: string;
	/** Plain text, with Markdown and MDX syntax stripped. */
	answer: string;
};

type FaqNode = {
	type: string;
	value?: string;
	depth?: number;
	alt?: string | null;
	children?: FaqNode[];
};

const parser = remark().use(remarkMdx).use(remarkGfm);

// MDX expressions and ESM carry code, not prose.
const ignoredTypes = new Set([
	"mdxFlowExpression",
	"mdxTextExpression",
	"mdxjsEsm",
]);

// Containers whose children are joined as separate blocks rather than inline.
const blockTypes = new Set([
	"blockquote",
	"code",
	"heading",
	"list",
	"listItem",
	"mdxJsxFlowElement",
	"paragraph",
	"table",
	"tableCell",
	"tableRow",
]);

export function getFaqItems(content: string): FaqItem[] {
	const tree = parser.parse(content) as FaqNode;
	const nodes = tree.children ?? [];
	const start = nodes.findIndex(
		(node) =>
			isHeading(node, 2) &&
			getText(node).trim().toLowerCase() === FAQ_HEADING.toLowerCase(),
	);
	if (start === -1) return [];

	const items: Array<{ question: string; blocks: string[] }> = [];

	for (const node of nodes.slice(start + 1)) {
		if (isHeading(node) && (node.depth ?? 0) <= 2) break;

		if (isHeading(node, 3)) {
			items.push({ question: normalize(getText(node)), blocks: [] });
			continue;
		}

		const text = normalize(getText(node));
		if (text) items.at(-1)?.blocks.push(text);
	}

	return items
		.map(({ question, blocks }) => ({ question, answer: blocks.join(" ") }))
		.filter((item) => item.question && item.answer);
}

export function faqPageJsonLd(items: FaqItem[], url: string) {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		"@id": `${url}#faq`,
		url,
		mainEntity: items.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.answer,
			},
		})),
	};
}

function isHeading(node: FaqNode, depth?: number) {
	return (
		node.type === "heading" && (depth === undefined || node.depth === depth)
	);
}

function getText(node: FaqNode): string {
	if (ignoredTypes.has(node.type)) return "";
	if (node.type === "image") return node.alt ?? "";
	if (node.type === "break") return " ";
	if (typeof node.value === "string") return node.value;

	const children = node.children ?? [];
	const separator = children.some((child) => blockTypes.has(child.type))
		? " "
		: "";
	return children.map(getText).join(separator);
}

function normalize(text: string) {
	return text.replace(/\s+/g, " ").trim();
}
