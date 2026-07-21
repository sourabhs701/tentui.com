import { SITE_INFO } from "@/config/site";
import { getAllBlocks } from "@/lib/blocks";
import { getComponentDocs } from "@/lib/documents";

export const revalidate = false;
export const dynamic = "force-static";

export async function GET() {
	const components = getComponentDocs();
	const blocks = await getAllBlocks();
	const content = `# ${SITE_INFO.name}

> ${SITE_INFO.description}

- [Complete documentation](${SITE_INFO.url}/llms-full.txt): All TentUI component documentation and block source in one document.
- [Components](${SITE_INFO.url}/components): Reusable React components with installation and usage documentation.
- [Blocks](${SITE_INFO.url}/blocks): Production-ready interface sections and page blocks.
- [License](${SITE_INFO.url}/license): Terms for using and redistributing TentUI items.

## Components

${components.map((item) => `- [${item.metadata.title}](${SITE_INFO.url}/components/${item.slug}.mdx): ${item.metadata.description}`).join("\n")}

## Blocks

${blocks.map((item) => `- [${item.title ?? item.name}](${SITE_INFO.url}/blocks/${item.name}.mdx): ${item.description ?? "A production-ready TentUI block."}`).join("\n")}
`;

	return new Response(content, {
		headers: {
			"Content-Type": "text/markdown;charset=utf-8",
		},
	});
}
