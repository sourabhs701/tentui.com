import { notFound } from "next/navigation";
import { getComponentDocBySlug, getComponentDocs } from "@/lib/documents";
import { getComponentLLMText } from "@/lib/llms";

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
	return getComponentDocs().map((doc) => ({ slug: doc.slug }));
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ slug: string }> },
) {
	const { slug } = await params;
	const doc = getComponentDocBySlug(slug);
	if (!doc) notFound();

	return new Response(await getComponentLLMText(doc), {
		headers: {
			"Content-Type": "text/markdown;charset=utf-8",
			"X-Robots-Tag": "noindex, follow",
		},
	});
}
