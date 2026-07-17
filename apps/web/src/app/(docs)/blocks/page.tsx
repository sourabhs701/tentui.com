import type { Metadata } from "next";
import { Fragment } from "react";

import { BlockDisplay } from "@/app/(preview)/components/block-display";
import {
	absoluteUrl,
	breadcrumbJsonLd,
	JSON_LD_ID,
	JsonLdScript,
} from "@/lib/json-ld";
import blocks from "@/registry/__blocks__.json";

type BlockSummary = {
	name: string;
	description?: string;
	categories: string[];
};

const blockItems = blocks as BlockSummary[];

export const dynamic = "force-static";
export const revalidate = false;

const title = "Blocks";
const description = "Beautifully designed, production-ready React blocks.";
const ogImage = `/og/simple?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;

export const metadata: Metadata = {
	title,
	description,
	alternates: { canonical: "/blocks" },
	openGraph: {
		title,
		description,
		url: absoluteUrl("/blocks"),
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
};

function collectionPageJsonLd() {
	return {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		"@id": absoluteUrl("/blocks"),
		name: title,
		description,
		url: absoluteUrl("/blocks"),
		mainEntity: {
			"@type": "ItemList",
			numberOfItems: blockItems.length,
			itemListElement: blockItems.map((block, index) => ({
				"@type": "ListItem",
				position: index + 1,
				name: block.name,
				description: block.description,
			})),
		},
		isPartOf: { "@id": JSON_LD_ID.website },
	};
}

export default function BlocksPage() {
	return (
		<>
			<JsonLdScript data={collectionPageJsonLd()} />
			<JsonLdScript
				data={breadcrumbJsonLd([
					{ name: "Home", href: "/" },
					{ name: "Blocks", href: "/blocks" },
				])}
			/>

			{blockItems.map(({ name }) => (
				<Fragment key={name}>
					<BlockDisplay name={name} />
				</Fragment>
			))}
		</>
	);
}
