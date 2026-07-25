import { notFound } from "next/navigation";
import { getDocBySlug, getDocs } from "@/lib/documents";
import { getComponentLLMText } from "@/lib/llms";

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
	return getDocs().map((doc) => ({ slug: doc.slug }));
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ slug: string }> },
) {
	const { slug } = await params;
	const doc = getDocBySlug(slug);
	if (!doc) notFound();

	return new Response(await getComponentLLMText(doc), {
		headers: {
			"Content-Type": "text/markdown;charset=utf-8",
			"X-Robots-Tag": "noindex, follow",
		},
	});
}
