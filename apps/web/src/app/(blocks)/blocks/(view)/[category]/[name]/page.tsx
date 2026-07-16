import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BlockDisplay } from "@/app/(preview)/components/block-display";
import { BlockKeyboardNavigation } from "@/components/blocks/routes/block-keyboard-navigation";
import {
	absoluteUrl,
	breadcrumbJsonLd,
	JsonLdScript,
} from "@/components/blocks/routes/json-ld";
import { ShareButton } from "@/components/blocks/routes/share-button";
import { blockCategories } from "@/config/registry";
import { getAllBlockStaticParams } from "@/lib/blocks";
import { getRegistryItem } from "@/lib/registry";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

const getCachedStaticParams = cache(getAllBlockStaticParams);
const getCachedRegistryItem = cache(getRegistryItem);

export async function generateStaticParams() {
	return await getCachedStaticParams();
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string; name: string }>;
}): Promise<Metadata> {
	const { category, name } = await params;
	const item = await getCachedRegistryItem(name);

	if (!item?.categories?.includes(category)) return {};

	const title = item.title || item.name;
	const description = item.description || "A production-ready React block.";
	const url = `/blocks/${category}/${item.name}`;
	const ogImage = `/og/simple?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;

	return {
		title,
		description,
		alternates: { canonical: url },
		openGraph: {
			title,
			description,
			url: absoluteUrl(url),
			type: "article",
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
	};
}

export default async function BlockDetailPage({
	params,
}: {
	params: Promise<{ category: string; name: string }>;
}) {
	const { category, name } = await params;
	const [allBlocks, item] = await Promise.all([
		getCachedStaticParams(),
		getCachedRegistryItem(name),
	]);
	const categoryItem = blockCategories.find(
		(candidate) => candidate.name === category,
	);

	if (!item || !categoryItem || !item.categories?.includes(category))
		notFound();

	const slugs = allBlocks.map(
		(block: { category: string; name: string }) =>
			`${block.category}/${block.name}`,
	);
	const { previous, next } = findNeighbours(slugs, `${category}/${name}`);
	const previousHref = previous ? (`/blocks/${previous}` as Route) : null;
	const nextHref = next ? (`/blocks/${next}` as Route) : null;
	const pagePath = `/blocks/${category}/${name}`;
	const description = item.description || "A production-ready React block.";

	return (
		<>
			<JsonLdScript
				data={{
					"@context": "https://schema.org",
					"@type": "SoftwareSourceCode",
					"@id": absoluteUrl(pagePath),
					name: item.title || item.name,
					description,
					image: absoluteUrl(
						`/og/simple?title=${encodeURIComponent(item.title || item.name)}&description=${encodeURIComponent(description)}`,
					),
					url: absoluteUrl(pagePath),
					datePublished: item.meta?.createdAt
						? new Date(item.meta.createdAt).toISOString()
						: undefined,
					codeRepository: "https://github.com/sourabhs701/tentui.com",
					programmingLanguage: [
						{ "@type": "ComputerLanguage", name: "TypeScript" },
					],
					runtimePlatform: "React 19",
					codeSampleType: "full compile-ready solution",
					keywords: ["react", "shadcn", "block", "tentui"],
					isPartOf: { "@id": absoluteUrl("/blocks") },
				}}
			/>
			<JsonLdScript
				data={breadcrumbJsonLd([
					{ name: "Home", href: "/" },
					{ name: "Blocks", href: "/blocks" },
					{ name: categoryItem.title, href: `/blocks/${category}` },
					{ name: item.title || item.name, href: pagePath },
				])}
			/>
			<BlockKeyboardNavigation previous={previousHref} next={nextHref} />

			<div className="border-line border-y px-3 py-2 sm:px-4">
				<div className="flex items-center justify-between gap-3">
					<Link
						href={`/blocks/${category}`}
						className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ArrowLeftIcon aria-hidden="true" className="size-4" />
						{categoryItem.title}
					</Link>

					<div className="flex items-center gap-2">
						<ShareButton title={item.title || item.name} path={pagePath} />
						{previousHref && (
							<Link
								href={previousHref}
								aria-label="Previous block"
								title="Previous block (Left arrow)"
								className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<ArrowLeftIcon aria-hidden="true" className="size-4" />
							</Link>
						)}
						{nextHref && (
							<Link
								href={nextHref}
								aria-label="Next block"
								title="Next block (Right arrow)"
								className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<ArrowRightIcon aria-hidden="true" className="size-4" />
							</Link>
						)}
					</div>
				</div>
			</div>

			<BlockDisplay name={name} />
			<div className="screen-line-top">
				<div className="stripe-divider" />
			</div>
		</>
	);
}

function findNeighbours(blocks: string[], current: string) {
	const index = blocks.indexOf(current);

	return {
		previous: index > 0 ? blocks[index - 1] : null,
		next: index >= 0 && index < blocks.length - 1 ? blocks[index + 1] : null,
	};
}
