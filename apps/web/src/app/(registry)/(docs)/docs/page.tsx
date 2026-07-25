import { notFound } from "next/navigation";
import { getDocBySlug } from "@/lib/documents";
import { DocsPage, getDocsPageMetadata } from "./_components/docs-page";

const doc = getDocBySlug("introduction");

export const metadata = doc ? getDocsPageMetadata(doc) : {};

export default function DocumentationPage() {
	if (!doc) notFound();

	return <DocsPage doc={doc} />;
}
