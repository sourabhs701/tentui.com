import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { BlockDisplay } from "@/app/(preview)/components/block-display";
import { blockCategories } from "@/config/registry";
import { getBlockCategoryCopy } from "@/lib/block-category-seo";
import { getAllBlocks } from "@/lib/blocks";
import { faqPageJsonLd } from "@/lib/faq";
import { absoluteUrl, breadcrumbJsonLd, JsonLdScript } from "@/lib/json-ld";

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
		title: item.seoTitle,
		description: item.description,
		alternates: { canonical: url },
		openGraph: {
			title: item.seoTitle,
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
			title: item.seoTitle,
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

	const blocks = await getAllBlocks(["registry:block"], [category]);
	const categoryUrl = `/blocks/${category}`;
	const copy = getBlockCategoryCopy(categoryItem, blocks);

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
						numberOfItems: blocks.length,
						itemListElement: blocks.map((block, index) => ({
							"@type": "ListItem",
							position: index + 1,
							name: block.title ?? block.name,
							description: block.description,
							url: absoluteUrl(`${categoryUrl}#${block.name}`),
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
			{copy.faq.length > 0 && (
				<JsonLdScript
					data={faqPageJsonLd(copy.faq, absoluteUrl(categoryUrl))}
				/>
			)}

			<header className="border-line border-b px-4 py-10 sm:px-6 sm:py-14">
				<h1 className="max-w-3xl text-balance font-medium text-3xl tracking-tight sm:text-4xl">
					{categoryItem.heading}
				</h1>
				<p className="mt-4 max-w-2xl text-pretty text-muted-foreground leading-relaxed">
					{copy.intro}
					{copy.installCommand && (
						<>
							{" "}
							Install {blocks.length === 1 ? "it" : "one"} with{" "}
							<code className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
								{copy.installCommand}
							</code>{" "}
							after{" "}
							<Link
								href="/docs/installation"
								className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
							>
								adding the TentUI registry
							</Link>
							, then edit the source in your project.
						</>
					)}
				</p>
				{blocks.length > 1 && (
					<nav
						aria-label={`${categoryItem.title} blocks`}
						className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm"
					>
						{blocks.map((block) => (
							<a
								key={block.name}
								href={`#${block.name}`}
								className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								{block.title ?? block.name}
							</a>
						))}
					</nav>
				)}
			</header>

			{blocks.map((block) => (
				<Fragment key={block.name}>
					<BlockDisplay name={block.name} />
				</Fragment>
			))}

			{copy.faq.length > 0 && (
				<section
					aria-labelledby="faq"
					className="border-line border-t px-4 py-10 sm:px-6 sm:py-14"
				>
					<h2
						id="faq"
						className="scroll-mt-14 text-balance font-medium text-2xl tracking-tight"
					>
						FAQ
					</h2>
					<div className="mt-6 flex max-w-3xl flex-col gap-6">
						{copy.faq.map((item) => (
							<div key={item.question}>
								<h3 className="font-medium text-base">{item.question}</h3>
								<p className="mt-2 text-pretty text-muted-foreground leading-relaxed">
									{item.answer}
								</p>
							</div>
						))}
					</div>
				</section>
			)}
		</>
	);
}
