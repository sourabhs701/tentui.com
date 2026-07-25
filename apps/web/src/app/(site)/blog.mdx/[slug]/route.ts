import { notFound } from "next/navigation";
import { getBlogPostBySlug, getBlogPosts } from "@/lib/documents";
import { getComponentLLMText } from "@/lib/llms";

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
	return getBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ slug: string }> },
) {
	const { slug } = await params;
	const post = getBlogPostBySlug(slug);
	if (!post) notFound();

	return new Response(await getComponentLLMText(post), {
		headers: {
			"Content-Type": "text/markdown;charset=utf-8",
			"X-Robots-Tag": "noindex, follow",
		},
	});
}
