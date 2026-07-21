import { notFound } from "next/navigation";
import { getAllBlocks } from "@/lib/blocks";
import { getBlockLLMText } from "@/lib/llms";
import { getRegistryDisplayItem } from "@/lib/registry";

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
	const blocks = await getAllBlocks();
	return blocks.map((block) => ({ name: block.name }));
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ name: string }> },
) {
	const { name } = await params;
	const block = getRegistryDisplayItem(name);

	if (block?.type !== "registry:block") notFound();

	return new Response(getBlockLLMText(block), {
		headers: {
			"Content-Type": "text/markdown;charset=utf-8",
			"X-Robots-Tag": "noindex, follow",
		},
	});
}
