import type { Metadata } from "next";
import Link from "next/link";
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

const title = "Shadcn Blocks for Websites";
const description =
	"Copy and customize production-ready shadcn blocks for heroes, testimonials, pricing, FAQs, CTAs, footers, legal pages, and 404 pages.";
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

			<header className="border-line border-b px-4 py-10 sm:px-6 sm:py-14">
				<h1 className="max-w-3xl text-balance font-medium text-3xl tracking-tight sm:text-4xl">
					Shadcn blocks for websites
				</h1>
				<p className="mt-4 max-w-2xl text-pretty text-muted-foreground leading-relaxed">
					Copy complete React sections into your project, then customize the
					source to match your product. Need an end-to-end starting point?{" "}
					<Link
						href="/blog/shadcn-landing-page"
						className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
					>
						Build a shadcn landing page with these blocks
					</Link>
					.
				</p>
			</header>

			{blockItems.map(({ name }) => (
				<Fragment key={name}>
					<BlockDisplay name={name} />
				</Fragment>
			))}
		</>
	);
}
