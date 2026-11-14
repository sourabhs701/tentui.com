import { notFound } from "next/navigation";
import {
	getComponentSourceFilePaths,
	highlightSourceFile,
} from "@/components/mdx/plugins";
import { getBlogPosts, getComponentDocs, getDocs } from "@/lib/documents";

// Highlighted source for <ComponentSource> blocks that start in a hidden tab.
// The page leaves them out of its HTML and RSC payload, and
// DeferredCodeBlock fetches them from here when the tab opens.
export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
	const paths = new Set<string>();
	for (const doc of [...getComponentDocs(), ...getDocs(), ...getBlogPosts()]) {
		for (const filePath of getComponentSourceFilePaths(doc.content)) {
			paths.add(filePath);
		}
	}
	return [...paths].map((filePath) => ({ path: filePath.split("/") }));
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path } = await params;
	const source = await highlightSourceFile(path.join("/"));
	if (!source) notFound();

	return Response.json(source, {
		headers: { "X-Robots-Tag": "noindex" },
	});
}
