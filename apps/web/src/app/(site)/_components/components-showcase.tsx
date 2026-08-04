"use client";

import { ArrowUpRight } from "lucide-react";
import { useInView, useReducedMotion } from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { TentUiMark } from "@/components/tentui-mark";
import { components } from "@/lib/components";
import { cn } from "@/lib/utils";

const featuredComponents = components
	.filter((item) => typeof item.meta?.video === "string")
	.slice(1);

type ComponentItem = (typeof components)[number];

function PreviewVideo({ item }: { item: ComponentItem }) {
	const ref = useRef<HTMLVideoElement>(null);
	const inView = useInView(ref, { amount: 0.2 });
	const reducedMotion = useReducedMotion();
	const { resolvedTheme } = useTheme();
	const theme = resolvedTheme === "dark" ? "dark" : "light";
	const video = typeof item.meta?.video === "string" ? item.meta.video : null;
	const image = typeof item.meta?.image === "string" ? item.meta.image : null;
	const src = video ? `${video}-${theme}.mp4` : null;

	useEffect(() => {
		if (!src) return;

		if (inView && !reducedMotion) {
			void ref.current?.play().catch(() => {});
		} else {
			ref.current?.pause();
		}
	}, [inView, reducedMotion, src]);

	if (!src) {
		return (
			<div className="flex size-full items-center justify-center text-muted-foreground text-sm">
				{item.title ?? item.name}
			</div>
		);
	}

	return (
		<video
			key={theme}
			ref={ref}
			src={src}
			poster={image ? `${image}-${theme}.webp` : undefined}
			muted
			loop
			playsInline
			preload="metadata"
			className="size-full object-cover"
		/>
	);
}

function ShowcaseCard({
	item,
	large,
	className,
}: {
	item: ComponentItem;
	large?: boolean;
	className?: string;
}) {
	return (
		<Link
			href={`/components/${item.name}` as Route}
			className={cn(
				"group flex flex-col rounded-[21px] border bg-muted p-0.5 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
				large && "lg:h-full",
				className,
			)}
		>
			<div
				className={cn(
					"relative aspect-4/3 w-full overflow-hidden rounded-3xl border bg-background",
					large && "lg:aspect-auto lg:flex-1",
				)}
			>
				<PreviewVideo item={item} />
			</div>

			<div className="flex items-center justify-between gap-3 px-3 pt-2 pb-1">
				<h3 className="min-w-0 truncate font-semibold tracking-tight">
					{item.title ?? item.name}
				</h3>
				<ArrowUpRight
					aria-hidden="true"
					className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
				/>
			</div>
		</Link>
	);
}

function ViewAllCard({ count }: { count: number }) {
	return (
		<Link
			href="/components"
			className="group relative flex min-h-45 flex-col justify-between overflow-hidden rounded-[32px] bg-primary p-6 text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 sm:col-span-2 lg:col-span-1"
		>
			<TentUiMark className="pointer-events-none absolute -right-12 -bottom-16 size-64 opacity-15" />
			<ArrowUpRight
				aria-hidden="true"
				className="relative size-8 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
			/>
			<span className="relative font-bold text-2xl tracking-tight">
				View all
				<br />
				{count} components
			</span>
		</Link>
	);
}

export function ComponentsShowcase() {
	const [hero, ...rest] = featuredComponents;
	if (!hero) return null;

	return (
		<section className="mx-auto w-full max-w-6xl px-1 py-24 md:py-32">
			<header className="flex flex-col items-center gap-3 text-center">
				<h2 className="max-w-2xl text-balance font-bold text-2xl tracking-tight sm:text-3xl md:text-4xl">
					{components.length}+ unique components
				</h2>
				<p className="max-w-lg text-balance font-medium text-muted-foreground text-sm sm:text-base">
					Add any component with the shadcn CLI using your favorite package
					manager, then customize the source.
				</p>
			</header>

			<div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<ShowcaseCard
					item={hero}
					large
					className="sm:col-span-2 lg:row-span-2"
				/>
				{rest.map((item) => (
					<ShowcaseCard key={item.name} item={item} />
				))}
				<ViewAllCard count={components.length} />
			</div>
		</section>
	);
}
