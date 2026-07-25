import { Button } from "@tentui.com/ui/components/button";
import { Kbd } from "@tentui.com/ui/components/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@tentui.com/ui/components/tooltip";
import { Prose } from "@tentui.com/ui/components/typography";
import { getTableOfContents } from "fumadocs-core/content/toc";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { ComponentViewTracker } from "@/components/component-view-tracker";
import { DocShareMenu } from "@/components/doc-share-menu";
import { MDX } from "@/components/mdx";
import { DocKeyboardShortcuts } from "@/components/mdx/doc-keyboard-shortcuts";
import { LLMCopyButtonWithViewOptions } from "@/components/mdx/doc-page-actions";
import { TOCInline } from "@/components/mdx/toc-inline";
import { TOCMinimap } from "@/components/mdx/toc-minimap";
import {
	ComponentContentCol,
	ComponentRightCol,
} from "@/components/sidebar/component-page-layout";
import { SITE_INFO, SOURCE_CODE_GITHUB_URL } from "@/config/site";
import type { Doc } from "@/lib/documents";
import { findNeighbour, getComponentDocs } from "@/lib/documents";
import {
	absoluteUrl,
	breadcrumbJsonLd,
	JSON_LD_ID,
	JsonLdScript,
} from "@/lib/json-ld";

function getComponentHref(slug: string): Route {
	return `/components/${slug}` as Route;
}

export function getComponentPageMetadata(doc: Doc): Metadata {
	const { title, description, image, createdAt, updatedAt } = doc.metadata;
	const url = getComponentHref(doc.slug);
	const ogImage =
		image ||
		`/og/simple?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;

	return {
		title,
		description,
		alternates: { canonical: url },
		openGraph: {
			title,
			description,
			type: "article",
			url,
			publishedTime: new Date(createdAt).toISOString(),
			modifiedTime: new Date(updatedAt).toISOString(),
			images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: [ogImage],
		},
	};
}

function softwareSourceCodeJsonLd(doc: Doc) {
	const url = getComponentHref(doc.slug);
	const ogImage =
		doc.metadata.image ||
		`/og/simple?title=${encodeURIComponent(doc.metadata.title)}&description=${encodeURIComponent(doc.metadata.description)}`;

	return {
		"@context": "https://schema.org",
		"@type": "SoftwareSourceCode",
		"@id": absoluteUrl(url),
		name: doc.metadata.title,
		description: doc.metadata.description,
		image: absoluteUrl(ogImage),
		url: absoluteUrl(url),
		datePublished: new Date(doc.metadata.createdAt).toISOString(),
		dateModified: new Date(doc.metadata.updatedAt).toISOString(),
		codeRepository: SOURCE_CODE_GITHUB_URL,
		programmingLanguage: "TypeScript",
		runtimePlatform: "React",
		keywords: ["react", "shadcn", "component"],
		author: {
			"@type": "Organization",
			name: SITE_INFO.name,
			url: SITE_INFO.url,
		},
		isPartOf: {
			"@type": "CollectionPage",
			"@id": absoluteUrl("/components"),
			name: "Components",
			url: absoluteUrl("/components"),
			isPartOf: { "@id": JSON_LD_ID.website },
		},
	};
}

export function ComponentPage({ doc }: { doc: Doc }) {
	const toc = getTableOfContents(doc.content);
	const { previous, next } = findNeighbour(getComponentDocs(), doc.slug);
	const url = getComponentHref(doc.slug);

	return (
		<div className="mb-5 flex min-w-0 px-2">
			<div className="mx-auto max-w-4xl">
				<ComponentContentCol>
					<ComponentViewTracker slug={doc.slug} title={doc.metadata.title} />
					<JsonLdScript data={softwareSourceCodeJsonLd(doc)} />
					<JsonLdScript
						data={breadcrumbJsonLd([
							{ name: "Home", href: "/" },
							{ name: "Components", href: "/components" },
							{ name: doc.metadata.title, href: url },
						])}
					/>
					<DocKeyboardShortcuts
						previous={previous ? getComponentHref(previous.slug) : null}
						next={next ? getComponentHref(next.slug) : null}
					/>

					<div className="flex items-center justify-between">
						<Button
							className="h-7 gap-2 border-none pr-0 pl-6 text-muted-foreground tracking-wider hover:text-foreground hover:no-underline sm:pl-0"
							variant="link"
							size="sm"
							nativeButton={false}
							render={
								<Link href="/components">
									<ArrowLeftIcon />
									Components
								</Link>
							}
						/>

						<div className="flex items-center gap-2">
							<LLMCopyButtonWithViewOptions
								markdownUrl={`/components/${doc.slug}.mdx`}
								isComponent
							/>
							<DocShareMenu title={doc.metadata.title} url={url} />

							{previous ? (
								<ComponentNavigationButton
									direction="previous"
									href={getComponentHref(previous.slug)}
									title={previous.metadata.title}
								/>
							) : null}
							{next ? (
								<ComponentNavigationButton
									direction="next"
									href={getComponentHref(next.slug)}
									title={next.metadata.title}
								/>
							) : null}
						</div>
					</div>

					<div className="py-4">
						<h1
							data-slot="doc-title"
							className="text-balance font-medium text-4xl tracking-tight"
						>
							{doc.metadata.title}
						</h1>
					</div>

					<Prose className="pt-8 [--page-padding:--spacing(4)]">
						<p className="text-muted-foreground">{doc.metadata.description}</p>
						<TOCInline className="xl:hidden" items={toc} />
						<div>
							<MDX code={doc.content} />
						</div>
					</Prose>
				</ComponentContentCol>
			</div>

			<ComponentRightCol>
				<div className="sticky top-[calc(var(--header-height)+(--spacing(2)))] translate-x-2">
					<TOCMinimap items={toc} />
				</div>
			</ComponentRightCol>
		</div>
	);
}

function ComponentNavigationButton({
	direction,
	href,
	title,
}: {
	direction: "previous" | "next";
	href: Route;
	title: string;
}) {
	const isPrevious = direction === "previous";
	const Icon = isPrevious ? ArrowLeftIcon : ArrowRightIcon;
	const label = isPrevious ? "Previous component" : "Next component";

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						className="size-7 border-none"
						variant="secondary"
						size="icon-sm"
						nativeButton={false}
						render={
							<Link href={href} aria-label={`${label}: ${title}`}>
								<Icon />
							</Link>
						}
					/>
				}
			/>
			<TooltipContent className="pr-2 pl-3">
				<div className="flex items-center gap-3">
					{label}
					<Kbd>
						<Icon />
					</Kbd>
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
