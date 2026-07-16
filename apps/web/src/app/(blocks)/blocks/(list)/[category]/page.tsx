import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { BlockDisplay } from "@/app/(preview)/components/block-display";
import {
	absoluteUrl,
	breadcrumbJsonLd,
	JsonLdScript,
} from "@/components/blocks/routes/json-ld";
import { blockCategories } from "@/config/registry";
import { getAllBlockIds } from "@/lib/blocks";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export function generateStaticParams() {
	return blockCategories.map((category) => ({ category: category.name }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string }>;
}): Promise<Metadata> {
	const { category } = await params;
	const item = blockCategories.find((candidate) => candidate.name === category);

	if (!item) return {};

	const url = `/blocks/${item.name}`;
	const ogImage = `/og/simple?title=${encodeURIComponent(item.title)}&description=${encodeURIComponent(item.description)}`;

	return {
		title: item.title,
		description: item.description,
		alternates: { canonical: url },
		openGraph: {
			title: item.title,
			description: item.description,
			url: absoluteUrl(url),
			type: "website",
			images: [
				{
					url: absoluteUrl(ogImage),
					width: 1200,
					height: 630,
					alt: item.title,
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title: item.title,
			description: item.description,
			images: [absoluteUrl(ogImage)],
		},
	};
}

export default async function BlocksCategoryPage({
	params,
}: {
	params: Promise<{ category: string }>;
}) {
	const { category } = await params;
	const categoryItem = blockCategories.find((item) => item.name === category);

	if (!categoryItem) notFound();

	const blockIds = await getAllBlockIds(["registry:block"], [category]);
	const categoryUrl = `/blocks/${category}`;

	return (
		<>
			<JsonLdScript
				data={{
					"@context": "https://schema.org",
					"@type": "CollectionPage",
					"@id": absoluteUrl(categoryUrl),
					name: categoryItem.title,
					description: categoryItem.description,
					url: absoluteUrl(categoryUrl),
					mainEntity: {
						"@type": "ItemList",
						numberOfItems: blockIds.length,
						itemListElement: blockIds.map((blockId, index) => ({
							"@type": "ListItem",
							position: index + 1,
							url: absoluteUrl(`/blocks/${category}/${blockId}`),
						})),
					},
					isPartOf: { "@id": absoluteUrl("/blocks") },
				}}
			/>
			<JsonLdScript
				data={breadcrumbJsonLd([
					{ name: "Home", href: "/" },
					{ name: "Blocks", href: "/blocks" },
					{ name: categoryItem.title, href: categoryUrl },
				])}
			/>

			{blockIds.map((blockId) => (
				<Fragment key={blockId}>
					<BlockDisplay name={blockId} />
					<Separator />
				</Fragment>
			))}
		</>
	);
}

function Separator() {
	return (
		<div className="screen-line-top screen-line-bottom">
			<div className="stripe-divider" />
		</div>
	);
}
