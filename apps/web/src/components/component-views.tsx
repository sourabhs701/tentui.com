"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@tentui.com/ui/components/tooltip";
import { EyeIcon } from "lucide-react";
import { useEffect, useState } from "react";

const compactNumber = new Intl.NumberFormat("en-US", {
	notation: "compact",
	compactDisplay: "short",
});
const fullNumber = new Intl.NumberFormat("en-US");

type ComponentViewsProps = {
	slug: string;
};

// Count a page view once per browser session; later visits only read.
function claimView(slug: string) {
	const key = `component-viewed:${slug}`;
	try {
		if (sessionStorage.getItem(key)) return false;
		sessionStorage.setItem(key, "1");
		return true;
	} catch {
		return false;
	}
}

export function ComponentViews({ slug }: ComponentViewsProps) {
	const [count, setCount] = useState<number | null>(null);

	useEffect(() => {
		const controller = new AbortController();

		fetch(`/api/views/${slug}`, {
			method: claimView(slug) ? "POST" : "GET",
			signal: controller.signal,
		})
			.then((response) => {
				if (!response.ok) throw new Error("View count request failed");
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
						data-slot="component-views"
						className="inline-flex items-center gap-1.5 text-muted-foreground text-sm tabular-nums"
					>
						<EyeIcon className="size-3.5" aria-hidden />
						{count == null ? (
							<span className="h-3.5 w-12 animate-pulse rounded bg-muted" />
						) : (
							<span>
								{compactNumber.format(count).toLowerCase()}{" "}
								{count === 1 ? "view" : "views"}
							</span>
						)}
					</span>
				}
			/>
			<TooltipContent className="tabular-nums">
				{count == null
					? "Docs page views"
					: `${fullNumber.format(count)} docs page views`}
			</TooltipContent>
		</Tooltip>
	);
}
