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
import {
	findNeighbour,
	getComponentDocBySlug,
	getComponentDocs,
} from "@/lib/documents";

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

	return {
		title: doc.metadata.title,
		description: doc.metadata.description,
		alternates: { canonical: `/components/${doc.slug}` },
		openGraph: {
			type: "article",
			url: `/components/${doc.slug}`,
			images: doc.metadata.image
				? [{ url: doc.metadata.image, alt: doc.metadata.title }]
				: undefined,
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
		<div className="flex min-w-0">
			<ComponentContentCol className="md:max-w-3xl">
				<DocKeyboardShortcuts
					previous={previous ? (`/components/${previous.slug}` as Route) : null}
					next={next ? (`/components/${next.slug}` as Route) : null}
				/>
				<div className="flex items-center justify-between">
					<Button
						className="h-7 gap-2 border-none px-0 text-muted-foreground tracking-wider hover:text-foreground hover:no-underline"
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
						className="text-balance px-4 font-medium text-4xl tracking-tight"
					>
						{doc.metadata.title}
					</h1>
				</div>

				<Prose className="px-(--page-padding) pt-8 [--page-padding:--spacing(4)]">
					<p className="text-muted-foreground">{doc.metadata.description}</p>

					<TOCInline className="xl:hidden" items={toc} />

					<div>
						<MDX code={doc.content} />
					</div>
				</Prose>
			</ComponentContentCol>

			<ComponentRightCol>
				<div className="sticky top-(--header-height) translate-x-2">
					<TOCMinimap items={toc} />
				</div>
			</ComponentRightCol>
		</div>
	);
}
