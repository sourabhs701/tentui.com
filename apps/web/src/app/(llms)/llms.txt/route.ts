import { SITE_INFO } from "@/config/site";
import { getAllBlocks } from "@/lib/blocks";
import { getComponentDocs, getDocs } from "@/lib/documents";
import { LLMS_SUMMARY } from "@/lib/llms";
import { getRegistryItemNamespace } from "@/utils/registry";

export const revalidate = false;
export const dynamic = "force-static";

export async function GET() {
	const components = getComponentDocs();
	const docs = getDocs();
	const blocks = await getAllBlocks();
	const content = `# ${SITE_INFO.name}

> ${LLMS_SUMMARY}

Add the registry to the \`registries\` field of \`components.json\` with \`"@tentui": "${SITE_INFO.url}/r/{name}.json"\`, then run \`npx shadcn@latest add @tentui/<name>\`. Without the registry entry, run \`npx shadcn@latest add ${SITE_INFO.url}/r/<name>.json\`. Every component page below is linked as Markdown; drop the \`.mdx\` suffix for the HTML page.

- [Complete documentation](${SITE_INFO.url}/llms-full.txt): All TentUI component documentation and block source in one document.
- [Getting started](${SITE_INFO.url}/docs): Installation, registry, and MCP setup guides.
- [Components](${SITE_INFO.url}/components): Reusable React components with installation and usage documentation.
- [Blocks](${SITE_INFO.url}/blocks): Production-ready interface sections and page blocks.
- [License](${SITE_INFO.url}/license): Terms for using and redistributing TentUI items.

## Getting started

${docs.map((item) => `- [${item.metadata.title}](${SITE_INFO.url}/docs/${item.slug}.mdx): ${item.metadata.description}`).join("\n")}

## Components

${components.map((item) => `- [${item.metadata.title}](${SITE_INFO.url}/components/${item.slug}.mdx): ${item.metadata.description} Install: \`npx shadcn@latest add ${getRegistryItemNamespace(item.slug)}\``).join("\n")}

## Blocks

${blocks.map((item) => `- [${item.title ?? item.name}](${SITE_INFO.url}/blocks/${item.name}.mdx): ${item.description ?? "A production-ready TentUI block."}`).join("\n")}
`;

	return new Response(content, {
		headers: {
			"Content-Type": "text/markdown;charset=utf-8",
		},
	});
}
