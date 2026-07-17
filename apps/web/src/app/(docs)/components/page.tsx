import type { Metadata } from "next";
import { getComponentDocs } from "@/lib/documents";
import {
	absoluteUrl,
	breadcrumbJsonLd,
	JSON_LD_ID,
	JsonLdScript,
} from "@/lib/json-ld";

import { ComponentsGrid } from "./components-grid";

const title = "Components";
const description =
	"Beautiful, open-source React components for modern web applications.";
const ogImage = `/og/simple?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;

export const metadata: Metadata = {
	title,
	description,
	alternates: { canonical: "/components" },
	openGraph: {
		title,
		description,
		url: "/components",
		type: "website",
		images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
	},
	twitter: {
		card: "summary_large_image",
		title,
		description,
		images: [ogImage],
	},
};

function collectionPageJsonLd() {
	const docs = getComponentDocs();

	return {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		"@id": absoluteUrl("/components"),
		name: title,
		description,
		url: absoluteUrl("/components"),
		mainEntity: {
			"@type": "ItemList",
			numberOfItems: docs.length,
			itemListElement: docs.map((doc, index) => ({
				"@type": "ListItem",
				position: index + 1,
				name: doc.metadata.title,
				url: absoluteUrl(`/components/${doc.slug}`),
			})),
		},
		isPartOf: { "@id": JSON_LD_ID.website },
	};
}

export default function ComponentsPage() {
	return (
		<>
			<JsonLdScript data={collectionPageJsonLd()} />
			<JsonLdScript
				data={breadcrumbJsonLd([
					{ name: "Home", href: "/" },
					{ name: title, href: "/components" },
				])}
			/>
			<ComponentsGrid />
		</>
	);
}
