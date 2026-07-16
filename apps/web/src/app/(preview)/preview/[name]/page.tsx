import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type ComponentType, cache } from "react";

import { PreviewProvider } from "@/app/(preview)/components/preview-provider";
import { getCachedThemes } from "@/app/(preview)/lib/get-themes";
import { absoluteUrl } from "@/components/blocks/routes/json-ld";
import { getRegistryItem } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { Index } from "@/registry/__index__";

type PreviewIndexItem = {
	name: string;
	type: string;
	component?: ComponentType;
};

const previewIndex = Index as Record<string, PreviewIndexItem>;

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

const getCachedRegistryItem = cache(getRegistryItem);

export function generateStaticParams() {
	return Object.values(previewIndex)
		.filter((item) =>
			["registry:block", "registry:example"].includes(item.type),
		)
		.map((item) => ({ name: item.name }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ name: string }>;
}): Promise<Metadata> {
	const { name } = await params;
	const item = await getCachedRegistryItem(name);

	if (!item) return {};

	const title = item.title || item.name;
	const description = item.description || "A production-ready React block.";
	const url = `/preview/${item.name}`;
	const ogImage = `/og/simple?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;

	return {
		title,
		description,
		alternates: { canonical: url },
		openGraph: {
			title,
			description,
			url: absoluteUrl(url),
			type: "website",
			images: [
				{ url: absoluteUrl(ogImage), width: 1200, height: 630, alt: title },
			],
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: [absoluteUrl(ogImage)],
		},
		robots: { index: false, follow: false },
	};
}

export default async function PreviewPage({
	params,
}: {
	params: Promise<{ name: string }>;
}) {
	const { name } = await params;
	const [item, themes] = await Promise.all([
		getCachedRegistryItem(name),
		getCachedThemes(),
	]);
	const Component = previewIndex[name]?.component;

	if (!item || !Component) notFound();

	return (
		<div className={cn("style-preview min-h-svh", item.meta?.previewClassName)}>
			<PreviewProvider themes={themes}>
				<Component />
			</PreviewProvider>
		</div>
	);
}
