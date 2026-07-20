"use client";

import { LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/registry/components/copy-button/copy-button";

type HeadingType = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export function Heading<T extends HeadingType = "h2">({
	as,
	className,
	...props
}: React.ComponentProps<T> & { as?: T }) {
	const Component = as ?? "h2";

	if (!props.id) {
		return <Component className={className} {...props} />;
	}

	return (
		<Component
			className={cn(
				"group/heading flex scroll-mt-24 items-center gap-1",
				className,
			)}
			{...props}
		>
			<a href={`#${props.id}`} className="peer">
				{props.children}
			</a>
			<CopyButton
				className="size-7 opacity-0 group-hover/heading:opacity-100"
				variant="ghost"
				size="icon-sm"
				text={() => createHeadingUrl(props.id ?? "")}
				idleIcon={<LinkIcon />}
				aria-label="Copy link to section"
			/>
		</Component>
	);
}

export function createHeadingUrl(id: string) {
	if (typeof window === "undefined") return `#${id}`;

	const url = new URL(window.location.href);
	url.hash = id;
	return url.toString();
}
