import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getComponentDocBySlug, getComponentDocs } from "@/lib/documents";
import {
	ComponentPage,
	getComponentPageMetadata,
} from "../_components/component-page";

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
	return getComponentDocs().map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const doc = getComponentDocBySlug(slug);
	if (!doc) notFound();

	return getComponentPageMetadata(doc);
}

export default async function ComponentDetailPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const doc = getComponentDocBySlug(slug);
	if (!doc) notFound();

	return <ComponentPage doc={doc} />;
}
