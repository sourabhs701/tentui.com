import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlogPostBySlug, getBlogPosts } from "@/lib/documents";
import {
	BlogPostPage,
	getBlogPostMetadata,
} from "../_components/blog-post-page";

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
	return getBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const post = getBlogPostBySlug(slug);
	if (!post) notFound();

	return getBlogPostMetadata(post);
}

export default async function BlogDetailPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const post = getBlogPostBySlug(slug);
	if (!post) notFound();

	return <BlogPostPage post={post} />;
}
