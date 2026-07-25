"use client";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@tentui.com/ui/components/avatar";
import { cn } from "@tentui.com/ui/lib/utils";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";
import type { BlogPost } from "@/lib/documents";

const ALL_POSTS = "All Posts";
const SERIF =
	"'Iowan Old Style', 'Palatino Linotype', Georgia, Cambria, 'Times New Roman', serif";
const CATEGORY_ROW =
	"relative flex h-11 w-full cursor-pointer touch-manipulation items-center px-6 text-left font-mono text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 active:bg-muted [@media(hover:hover)_and_(pointer:fine)]:h-8";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "short",
	day: "2-digit",
	timeZone: "UTC",
});

function formatDate(date: string) {
	return dateFormatter.format(new Date(date));
}

function truncate(text: string, max: number) {
	if (text.length <= max) return text;
	return `${text.slice(0, max).trimEnd()}…`;
}

function initials(name: string) {
	return name
		.replace(/[^a-zA-Z0-9 ]/g, " ")
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

export function BlogArchive({ posts }: { posts: BlogPost[] }) {
	const featured = posts.find((post) => post.metadata.featured) ?? posts[0];
	const categories = [
		ALL_POSTS,
		...new Set(posts.map((post) => post.metadata.category)),
	];
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const selectedCategory = searchParams.get("category");
	const category =
		selectedCategory && categories.includes(selectedCategory)
			? selectedCategory
			: ALL_POSTS;
	const isActiveCategory = (item: string) => item === category;
	const visiblePosts = posts.filter((post) =>
		category === ALL_POSTS
			? post.slug !== featured?.slug
			: post.metadata.category === category,
	);
	const setCategory = (item: string) => {
		const params = new URLSearchParams(searchParams.toString());
		if (item === ALL_POSTS) {
			params.delete("category");
		} else {
			params.set("category", item);
		}
		const query = params.toString();
		const href = (query ? `${pathname}?${query}` : pathname) as Route;
		startTransition(() => {
			router.push(href, { scroll: false });
		});
	};

	return (
		<div className="text-foreground">
			{featured && category === ALL_POSTS ? (
				<FeaturedPost post={featured} />
			) : null}

			<div className="grid grid-cols-1 md:grid-cols-[232px_1fr]">
				<nav
					aria-label="Blog categories"
					className="self-start py-8 md:sticky md:top-(--header-height) md:py-14"
				>
					<div className="bg-primary px-6 py-2">
						<span className="font-medium text-primary-foreground text-xs uppercase tracking-wide">
							Categories
						</span>
					</div>
					<ul className="flex flex-col">
						{categories.map((item) => (
							<li key={item}>
								<button
									type="button"
									onClick={() => setCategory(item)}
									aria-pressed={isActiveCategory(item)}
									className={cn(
										CATEGORY_ROW,
										isActiveCategory(item)
											? "bg-primary/10 text-foreground"
											: "text-muted-foreground hover:bg-muted hover:text-foreground",
									)}
								>
									{isActiveCategory(item) ? (
										<span className="absolute top-0 left-0 h-full w-0.5 bg-primary" />
									) : null}
									{item}
								</button>
							</li>
						))}
					</ul>
				</nav>

				<section aria-label="Articles" className="min-w-0 py-8 md:py-14">
					{visiblePosts.length > 0 ? (
						<ul className="flex flex-col">
							{visiblePosts.map((post) => (
								<li key={post.slug}>
									<ArticleRow post={post} />
								</li>
							))}
						</ul>
					) : (
						<p className="px-6 py-20 text-center font-mono text-[14px] text-muted-foreground md:px-8">
							No articles in this category yet.
						</p>
					)}
				</section>
			</div>
		</div>
	);
}

function AuthorAvatar({
	post,
	decorative = false,
}: {
	post: BlogPost;
	decorative?: boolean;
}) {
	return (
		<Avatar size="sm">
			{post.metadata.authorImage ? (
				<AvatarImage
					src={post.metadata.authorImage}
					alt={decorative ? "" : post.metadata.author}
					className="object-contain"
				/>
			) : null}
			<AvatarFallback>{initials(post.metadata.author)}</AvatarFallback>
		</Avatar>
	);
}

function ArticleRow({ post }: { post: BlogPost }) {
	return (
		<Link
			href={`/blog/${post.slug}` as Route}
			className="group mb-2 block rounded-sm px-6 py-2 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 active:bg-muted/70 md:px-8"
		>
			<div className="flex items-baseline justify-between gap-6">
				<h2 className="flex gap-2 font-medium text-[16px] text-foreground leading-snug tracking-[-0.01em] transition-colors group-hover:text-primary group-hover:underline">
					{post.metadata.title}
					<AuthorAvatar post={post} />
				</h2>
				<time
					dateTime={post.metadata.createdAt}
					className="shrink-0 whitespace-nowrap pt-1 text-right font-mono text-[12px] text-muted-foreground tabular-nums"
				>
					{formatDate(post.metadata.createdAt)}
				</time>
			</div>
			<p className="mt-2 line-clamp-1 max-w-2xl text-[14px] text-muted-foreground leading-relaxed">
				{truncate(post.metadata.description, 150)}
			</p>
		</Link>
	);
}

function FeaturedPost({ post }: { post: BlogPost }) {
	return (
		<Link
			href={`/blog/${post.slug}` as Route}
			className="group/cover relative block overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset"
		>
			<div className="relative aspect-[16/10] sm:aspect-[2/1] md:aspect-[2.5/1]">
				{post.metadata.image ? (
					<Image
						src={post.metadata.image}
						alt=""
						fill
						sizes="(min-width: 1152px) 1104px, 100vw"
						className="object-cover transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/cover:scale-[1.02]"
						priority
					/>
				) : (
					<div
						aria-hidden="true"
						className="size-full bg-neutral-900"
						style={{
							backgroundImage:
								"radial-gradient(circle at 18% 18%, rgba(96,135,210,0.30), transparent 55%), radial-gradient(circle at 85% 80%, rgba(60,80,140,0.28), transparent 50%)",
						}}
					/>
				)}

				<div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/5" />

				<div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
					<span className="font-mono text-[11px] text-white/70 uppercase tracking-[0.18em]">
						Featured
					</span>
					<h2
						className="mt-3 max-w-3xl font-medium text-2xl text-white leading-[1.1] tracking-[-0.01em] md:text-[2.1rem]"
						style={{ fontFamily: SERIF }}
					>
						{post.metadata.title}
					</h2>
					<p className="mt-3 line-clamp-2 max-w-xl text-[14px] text-white/80 leading-relaxed md:text-[15px]">
						{post.metadata.description}
					</p>
					<div className="mt-5 flex items-center gap-2.5 font-mono text-[12px] text-white/85">
						<AuthorAvatar post={post} decorative />
						<span>{post.metadata.author}</span>
						<span className="text-white/40">·</span>
						<time dateTime={post.metadata.createdAt}>
							{formatDate(post.metadata.createdAt)}
						</time>
					</div>
				</div>
			</div>
		</Link>
	);
}
