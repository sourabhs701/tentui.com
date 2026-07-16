"use client";

import { CheckIcon, Share2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ShareButton({ title, path }: { title: string; path: string }) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	async function share() {
		const url = new URL(path, window.location.origin).toString();

		if (navigator.share) {
			try {
				await navigator.share({ title, url });
				return;
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError")
					return;
			}
		}

		await navigator.clipboard.writeText(url);
		setCopied(true);
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => setCopied(false), 2000);
	}

	return (
		<button
			type="button"
			onClick={share}
			className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 font-medium text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			aria-label={copied ? "Link copied" : `Share ${title}`}
		>
			{copied ? (
				<CheckIcon aria-hidden="true" />
			) : (
				<Share2Icon aria-hidden="true" />
			)}
			<span>{copied ? "Copied" : "Share"}</span>
		</button>
	);
}
