import type { Metadata } from "next";
import Link from "next/link";
import { ComponentsGrid } from "@/components/components-grid";
import { getComponentDocs } from "@/lib/documents";
import {
	absoluteUrl,
	breadcrumbJsonLd,
	JSON_LD_ID,
	JsonLdScript,
} from "@/lib/json-ld";
import { components } from "@/registry/components/_registry";
import { getComponentGroups } from "./_components/component-groups";
import { ComponentsDirectory } from "./_components/components-directory";

const title = "Interactive React Components for shadcn/ui";
const description =
	"Browse open-source interactive React components for shadcn/ui: buttons, sliders, pickers, menus, and sheets, each with a live demo and usage docs.";
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
					{ name: "Components", href: "/components" },
				])}
			/>

			<header className="px-2 pt-6 pb-8 sm:pt-10 sm:pb-10">
				<h1 className="max-w-3xl text-balance font-medium text-3xl tracking-tight sm:text-4xl">
					{title}
				</h1>
				<p className="mt-4 max-w-2xl text-pretty text-muted-foreground leading-relaxed">
					TentUI is an open-source collection of interactive React components
					for shadcn/ui projects. Each component has a documentation page with a
					live demo, and most include a shadcn CLI install command, usage
					examples, and an API reference. New to TentUI? Start with the{" "}
					<Link
						href="/docs/installation"
						className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
					>
						installation guide
					</Link>
					.
				</p>
			</header>

			<ComponentsGrid />
			<ComponentsDirectory groups={getComponentGroups(components)} />
		</>
	);
}
