import { buttonVariants } from "@tentui.com/ui/components/button";
import type { ComponentProps } from "react";
import { V0Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function OpenInV0Button({
	url,
	className,
	...props
}: ComponentProps<"a"> & { url: string }) {
	return (
		<a
			className={cn(
				buttonVariants({ variant: "ghost", size: "sm" }),
				"not-prose border-none px-2",
				className,
			)}
			href={`https://v0.app/chat/api/open?url=${url}`}
			target="_blank"
			rel="noopener"
			aria-label="Open in v0"
			{...props}
		>
			<V0Icon data-icon="inline-start" className="size-5" />
		</a>
	);
}
