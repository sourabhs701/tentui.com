import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@tentui.com/ui/components/avatar";
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
import { DocShareMenu } from "@/components/doc-share-menu";
import { MDX } from "@/components/mdx";
import { DocKeyboardShortcuts } from "@/components/mdx/doc-keyboard-shortcuts";
import { LLMCopyButtonWithViewOptions } from "@/components/mdx/doc-page-actions";
import { TOCInline } from "@/components/mdx/toc-inline";
import { ComponentPageRoot } from "@/components/sidebar/component-page-root";
import { SITE_INFO } from "@/config/site";
import type { BlogPost } from "@/lib/documents";
import { findNeighbour, getBlogPosts } from "@/lib/documents";
import {
	absoluteUrl,
	breadcrumbJsonLd,
	JSON_LD_ID,
	JsonLdScript,
} from "@/lib/json-ld";
import { cn } from "@/lib/utils";
import { BlogTableOfContents } from "./blog-table-of-contents";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "long",
	day: "numeric",
	timeZone: "UTC",
});

const SERIF =
	"'Iowan Old Style', 'Palatino Linotype', Georgia, Cambria, 'Times New Roman', serif";

function getBlogHref(slug: string): Route {
	return `/blog/${slug}` as Route;
}

function initials(name: string) {
	return name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0])
		.join("")
		.toUpperCase();
}

export function getBlogPostMetadata(post: BlogPost): Metadata {
	const { title, description, image, createdAt, updatedAt, author } =
		post.metadata;
	const url = getBlogHref(post.slug);
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
			authors: [author],
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

function articleJsonLd(post: BlogPost) {
	const url = getBlogHref(post.slug);
	const image =
		post.metadata.image ||
		`/og/simple?title=${encodeURIComponent(post.metadata.title)}&description=${encodeURIComponent(post.metadata.description)}`;

	return {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		"@id": absoluteUrl(url),
		headline: post.metadata.title,
		description: post.metadata.description,
		image: absoluteUrl(image),
		url: absoluteUrl(url),
		datePublished: new Date(post.metadata.createdAt).toISOString(),
		dateModified: new Date(post.metadata.updatedAt).toISOString(),
		articleSection: post.metadata.category,
		author: {
			"@type": "Person",
			name: post.metadata.author,
			image: post.metadata.authorImage
				? absoluteUrl(post.metadata.authorImage)
				: undefined,
		},
		publisher: {
			"@type": "Organization",
			name: SITE_INFO.name,
			url: SITE_INFO.url,
		},
		isPartOf: { "@id": JSON_LD_ID.website },
	};
}

export function BlogPostPage({ post }: { post: BlogPost }) {
	const toc = getTableOfContents(post.content);
	const neighbours = findNeighbour(getBlogPosts(), post.slug);
	const previous = neighbours.next;
	const next = neighbours.previous;
	const url = getBlogHref(post.slug);

	return (
		<ComponentPageRoot className="px-2">
			<div className="mx-auto mb-5 flex w-full min-w-0 max-w-6xl items-start px-2">
				<article className="min-w-0 flex-1 py-8 sm:py-12 sm:pr-6 lg:pr-8 xl:pr-12">
					<div className="mx-auto max-w-4xl">
						<JsonLdScript data={articleJsonLd(post)} />
						<JsonLdScript
							data={breadcrumbJsonLd([
								{ name: "Home", href: "/" },
								{ name: "Blog", href: "/blog" },
								{ name: post.metadata.title, href: url },
							])}
						/>
						<DocKeyboardShortcuts
							previous={previous ? getBlogHref(previous.slug) : null}
							next={next ? getBlogHref(next.slug) : null}
						/>

						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
							<Button
								className="h-11 w-fit touch-manipulation gap-2 border-none pr-0 text-muted-foreground tracking-wide hover:text-foreground hover:no-underline [@media(hover:hover)_and_(pointer:fine)]:h-7"
								variant="link"
								size="sm"
								nativeButton={false}
								render={
									<Link href={"/blog" as Route}>
										<ArrowLeftIcon />
										All posts
									</Link>
								}
							/>

							<div className="flex items-center justify-between gap-2 sm:justify-start">
								<LLMCopyButtonWithViewOptions
									markdownUrl={`/blog/${post.slug}.mdx`}
								/>
								<DocShareMenu title={post.metadata.title} url={url} />
								{previous ? (
									<BlogNavigationButton
										direction="previous"
										href={getBlogHref(previous.slug)}
										title={previous.metadata.title}
									/>
								) : null}
								{next ? (
									<BlogNavigationButton
										direction="next"
										href={getBlogHref(next.slug)}
										title={next.metadata.title}
									/>
								) : null}
							</div>
						</div>

						<header className="pt-10 pb-8">
							<p className="mb-4 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
								{post.metadata.category}
							</p>
							<h1
								data-slot="doc-title"
								className="text-balance font-normal text-4xl leading-[1.08] tracking-[-0.02em] sm:text-5xl"
								style={{ fontFamily: SERIF }}
							>
								{post.metadata.title}
							</h1>
							<p className="mt-5 max-w-2xl text-balance text-lg text-muted-foreground leading-relaxed">
								{post.metadata.description}
							</p>
							<div className="mt-6 flex items-center gap-3">
								<Avatar>
									{post.metadata.authorImage ? (
										<AvatarImage src={post.metadata.authorImage} alt="" />
									) : null}
									<AvatarFallback>
										{initials(post.metadata.author)}
									</AvatarFallback>
								</Avatar>
								<div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
									<span className="text-foreground">
										{post.metadata.author}
									</span>
									<span aria-hidden="true">/</span>
									<time dateTime={post.metadata.createdAt}>
										{dateFormatter.format(new Date(post.metadata.createdAt))}
									</time>
									{post.metadata.updatedAt !== post.metadata.createdAt ? (
										<>
											<span aria-hidden="true">/</span>
											<span>
												Updated{" "}
												{dateFormatter.format(
													new Date(post.metadata.updatedAt),
												)}
											</span>
										</>
									) : null}
								</div>
							</div>
						</header>

						<Prose className="border-border border-t border-dashed pt-8 [--page-padding:--spacing(4)] [&_blockquote]:max-w-[68ch] [&_ol]:max-w-[68ch] [&_p]:max-w-[68ch] [&_ul]:max-w-[68ch]">
							<TOCInline className="lg:hidden" items={toc} />
							<MDX code={post.content} />
						</Prose>

						{previous || next ? (
							<nav
								aria-label="More articles"
								className="mt-12 grid gap-2 border-border border-t border-dashed pt-6 sm:grid-cols-2"
							>
								{previous ? (
									<BlogNavigationLink
										direction="previous"
										href={getBlogHref(previous.slug)}
										title={previous.metadata.title}
									/>
								) : null}
								{next ? (
									<BlogNavigationLink
										direction="next"
										href={getBlogHref(next.slug)}
										title={next.metadata.title}
									/>
								) : null}
							</nav>
						) : null}
					</div>
				</article>

				{toc.length > 0 ? (
					<aside className="sticky top-[calc(var(--header-height)+(--spacing(2)))] hidden max-h-[calc(100svh-var(--header-height)-(--spacing(4)))] w-56 shrink-0 overflow-y-auto px-5 py-12 lg:block xl:w-64 xl:px-6">
						<BlogTableOfContents items={toc} />
					</aside>
				) : null}
			</div>
		</ComponentPageRoot>
	);
}

function BlogNavigationButton({
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
	const label = isPrevious ? "Previous post" : "Next post";

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						className="size-11 touch-manipulation border-none [@media(hover:hover)_and_(pointer:fine)]:size-7"
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

function BlogNavigationLink({
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
	const label = isPrevious ? "Previous post" : "Next post";

	return (
		<Link
			href={href}
			className={cn(
				"group flex min-h-24 touch-manipulation flex-col justify-center rounded-lg px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50",
				!isPrevious && "sm:col-start-2 sm:items-end sm:text-right",
			)}
		>
			<span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.12em]">
				{isPrevious ? <Icon aria-hidden="true" className="size-3.5" /> : null}
				{label}
				{isPrevious ? null : <Icon aria-hidden="true" className="size-3.5" />}
			</span>
			<span className="mt-2 line-clamp-2 font-medium text-sm leading-snug transition-colors group-hover:text-primary">
				{title}
			</span>
		</Link>
	);
}
