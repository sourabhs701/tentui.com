import { SITE_INFO } from "@/config/site";
import { getAllBlocks } from "@/lib/blocks";
import { getComponentDocs } from "@/lib/documents";
import {
	getBlockLLMText,
	getComponentLLMText,
	getCreatedAt,
	getISODate,
} from "@/lib/llms";

export const revalidate = false;
export const dynamic = "force-static";

function frontmatter(values: Record<string, string | undefined>) {
	return `---\n${Object.entries(values)
		.filter((entry): entry is [string, string] => Boolean(entry[1]))
		.map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
		.join("\n")}\n---`;
}

export async function GET() {
	const components = getComponentDocs();
	const blocks = await getAllBlocks();
	const componentContent = await Promise.all(
		components.map(async (item) => {
			return `${frontmatter({
				title: item.metadata.title,
				description: item.metadata.description,
				last_updated: getISODate(item.metadata.updatedAt),
				source: `${SITE_INFO.url}/components/${item.slug}`,
			})}\n\n${await getComponentLLMText(item)}`;
		}),
	);
	const blockContent = blocks.map((item) => {
		return `${frontmatter({
			title: item.title ?? item.name,
			description: item.description,
			added: getCreatedAt(item),
			source: `${SITE_INFO.url}/blocks/${item.name}.mdx`,
			registry: `${SITE_INFO.url}/r/${item.name}.json`,
		})}\n\n${getBlockLLMText(item)}`;
	});
	const content = `# ${SITE_INFO.name} complete documentation

> ${SITE_INFO.description}

This document contains the complete TentUI component documentation and block source intended for technical reference and LLM consumption.

## Components

${componentContent.join("\n\n")}

## Blocks

${blockContent.join("\n\n")}
`;

	return new Response(content, {
		headers: {
			"Content-Type": "text/markdown;charset=utf-8",
			"X-Robots-Tag": "noindex, follow",
		},
	});
}
