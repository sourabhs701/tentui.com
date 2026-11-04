"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@tentui.com/ui/components/tooltip";
import { DownloadIcon } from "lucide-react";
import { useEffect, useState } from "react";

const compactNumber = new Intl.NumberFormat("en-US", {
	notation: "compact",
	compactDisplay: "short",
});
const fullNumber = new Intl.NumberFormat("en-US");

type ComponentDownloadsProps = {
	slug: string;
};

export function ComponentDownloads({ slug }: ComponentDownloadsProps) {
	const [count, setCount] = useState<number | null>(null);

	useEffect(() => {
		const controller = new AbortController();

		fetch(`/api/downloads/${slug}`, { signal: controller.signal })
			.then((response) => {
				if (!response.ok) throw new Error("Download count request failed");
				return response.json() as Promise<{ count?: unknown }>;
			})
			.then(({ count }) => {
				if (typeof count === "number") setCount(count);
			})
			.catch(() => {});

		return () => controller.abort();
	}, [slug]);

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<span
						data-slot="component-downloads"
						className="inline-flex items-center gap-1.5 text-muted-foreground text-sm tabular-nums"
					>
						<DownloadIcon className="size-3.5" aria-hidden />
						{count == null ? (
							<span className="h-3.5 w-16 animate-pulse rounded bg-muted" />
						) : (
							<span>
								{compactNumber.format(count).toLowerCase()}{" "}
								{count === 1 ? "download" : "downloads"}
							</span>
						)}
					</span>
				}
			/>
			<TooltipContent className="tabular-nums">
				{count == null
					? "Installs via the shadcn CLI"
					: `${fullNumber.format(count)} installs via the shadcn CLI`}
			</TooltipContent>
		</Tooltip>
	);
}
