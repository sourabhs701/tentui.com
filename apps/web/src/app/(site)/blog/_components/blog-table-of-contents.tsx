"use client";

import type { TOCItemType } from "fumadocs-core/toc";
import { AnchorProvider, useItems } from "@/components/mdx/toc";
import { cn } from "@/lib/utils";

export function BlogTableOfContents({
	items,
	className,
}: {
	items: TOCItemType[];
	className?: string;
}) {
	if (items.length === 0) return null;

	return (
		<AnchorProvider
			toc={items}
			single
			options={{ rootMargin: "0px 0px -75% 0px" }}
		>
			<BlogTableOfContentsList className={className} />
		</AnchorProvider>
	);
}

function BlogTableOfContentsList({ className }: { className?: string }) {
	const items = useItems();

	return (
		<nav aria-label="On this page" className={cn("text-sm", className)}>
			<p className="mb-4 text-muted-foreground text-xs">On this page</p>
			<ul className="flex flex-col gap-2.5">
				{items.map((item) => (
					<li key={item.id}>
						<a
							href={item.original.url}
							aria-current={item.active ? "location" : undefined}
							data-depth={item.original.depth}
							className="line-clamp-2 block text-muted-foreground leading-snug transition-colors hover:text-foreground aria-[current=location]:text-foreground data-[depth=3]:pl-4 data-[depth=4]:pl-8"
						>
							{item.original.title}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}
