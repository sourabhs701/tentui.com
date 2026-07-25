import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDocBySlug, getDocs } from "@/lib/documents";
import { DocsPage, getDocsPageMetadata } from "../_components/docs-page";

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
	return getDocs()
		.filter((doc) => doc.slug !== "introduction")
		.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const doc = getDocBySlug(slug);
	if (!doc) notFound();

	return getDocsPageMetadata(doc);
}

export default async function DocumentationPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const doc = getDocBySlug(slug);
	if (!doc || slug === "introduction") notFound();

	return <DocsPage doc={doc} />;
}
