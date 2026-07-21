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
import { notFound } from "next/navigation";
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
import {
	findNeighbour,
	getComponentDocBySlug,
	getComponentDocs,
} from "@/lib/documents";
import {
	absoluteUrl,
	breadcrumbJsonLd,
	JSON_LD_ID,
	JsonLdScript,
} from "@/lib/json-ld";

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
	return getComponentDocs().map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const doc = getComponentDocBySlug(slug);
	if (!doc) notFound();
	const { title, description, image, createdAt, updatedAt } = doc.metadata;
	const url = `/components/${doc.slug}`;
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

function softwareSourceCodeJsonLd(
	doc: ReturnType<typeof getComponentDocBySlug>,
) {
	if (!doc) return null;

	const url = `/components/${doc.slug}`;
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

export default async function ComponentPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const doc = getComponentDocBySlug(slug);
	if (!doc) notFound();

	const toc = getTableOfContents(doc.content);
	const { previous, next } = findNeighbour(getComponentDocs(), slug);

	return (
		<div className="mb-5 flex min-w-0 px-2">
			<ComponentContentCol>
				<JsonLdScript data={softwareSourceCodeJsonLd(doc)} />
				<JsonLdScript
					data={breadcrumbJsonLd([
						{ name: "Home", href: "/" },
						{ name: "Components", href: "/components" },
						{
							name: doc.metadata.title,
							href: `/components/${doc.slug}`,
						},
					])}
				/>
				<DocKeyboardShortcuts
					previous={previous ? (`/components/${previous.slug}` as Route) : null}
					next={next ? (`/components/${next.slug}` as Route) : null}
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

						<DocShareMenu
							title={doc.metadata.title}
							url={`/components/${doc.slug}`}
						/>

						{previous && (
							<Tooltip>
								<TooltipTrigger
									render={
										<Button
											className="size-7 border-none"
											variant="secondary"
											size="icon-sm"
											nativeButton={false}
											render={
												<Link
													href={`/components/${previous.slug}`}
													aria-label="Previous Component"
												>
													<ArrowLeftIcon />
												</Link>
											}
										/>
									}
								/>
								<TooltipContent className="pr-2 pl-3">
									<div className="flex items-center gap-3">
										Previous component
										<Kbd>
											<ArrowLeftIcon />
										</Kbd>
									</div>
								</TooltipContent>
							</Tooltip>
						)}

						{next && (
							<Tooltip>
								<TooltipTrigger
									render={
										<Button
											className="size-7 border-none"
											variant="secondary"
											size="icon-sm"
											nativeButton={false}
											render={
												<Link
													href={`/components/${next.slug}`}
													aria-label="Next component"
												>
													<ArrowRightIcon />
												</Link>
											}
										/>
									}
								/>
								<TooltipContent className="pr-2 pl-3">
									<div className="flex items-center gap-3">
										Next component
										<Kbd>
											<ArrowRightIcon />
										</Kbd>
									</div>
								</TooltipContent>
							</Tooltip>
						)}
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

			<ComponentRightCol>
				<div className="sticky top-[calc(var(--header-height)+(--spacing(2)))] translate-x-2">
					<TOCMinimap items={toc} />
				</div>
			</ComponentRightCol>
		</div>
	);
}
