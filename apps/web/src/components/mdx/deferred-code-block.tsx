"use client";

import type { Route } from "next";
import { useEffect, useState } from "react";
import { mdxCodeBlockComponents, mdxCodeClassName } from "./code-block";

type HighlightedSource = {
	raw: string;
	html: string;
	language: string;
	theme: string;
};

const requests = new Map<string, Promise<HighlightedSource>>();

function getDeferredCodeUrl(src: string) {
	return `/code/${src.split("/").map(encodeURIComponent).join("/")}` as Route;
}

function loadSource(src: string) {
	let request = requests.get(src);
	if (!request) {
		request = fetch(getDeferredCodeUrl(src)).then((response) => {
			if (!response.ok) throw new Error(`Failed to load ${src}`);
			return response.json() as Promise<HighlightedSource>;
		});
		request.catch(() => requests.delete(src));
		requests.set(src, request);
	}
	return request;
}

const {
	figure: Figure,
	figcaption: Figcaption,
	pre: Pre,
} = mdxCodeBlockComponents;

/**
 * A highlighted source file fetched from /code/<src> on mount, rendered like
 * the code blocks MDX highlights at build time. Used for source that starts in
 * a hidden tab, so the page payload doesn't carry it.
 */
export function DeferredCodeBlock({
	src,
	title,
}: {
	src: string;
	title?: string;
}) {
	const [source, setSource] = useState<HighlightedSource | null>(null);
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let cancelled = false;
		void attempt;
		setFailed(false);
		loadSource(src).then(
			(result) => {
				if (!cancelled) setSource(result);
			},
			() => {
				if (!cancelled) setFailed(true);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [src, attempt]);

	const language = source?.language || (/\.([^.]+)$/.exec(src)?.[1] ?? "");
	const theme = source?.theme ?? "";

	return (
		<Figure data-rehype-pretty-code-figure="">
			{title ? (
				<Figcaption
					data-rehype-pretty-code-title=""
					data-language={language}
					data-theme={theme}
				>
					{title}
				</Figcaption>
			) : null}
			{source ? (
				<Pre
					tabIndex={0}
					data-language={language}
					data-theme={theme}
					__withMeta__={Boolean(title)}
					__rawString__={source.raw}
				>
					<code
						className={mdxCodeClassName}
						data-language={language}
						data-theme={theme}
						style={{ display: "grid" }}
						// Highlighted at build time by the /code route from a repo file.
						dangerouslySetInnerHTML={{ __html: source.html }}
					/>
				</Pre>
			) : (
				<div className="group/pre rounded-[9px] border bg-code">
					<div
						role="status"
						className="flex h-80 items-center justify-center text-muted-foreground text-sm"
					>
						{failed ? (
							<button
								type="button"
								className="underline underline-offset-4"
								onClick={() => setAttempt((value) => value + 1)}
							>
								Couldn&apos;t load the source. Try again
							</button>
						) : (
							"Loading source…"
						)}
					</div>
				</div>
			)}
		</Figure>
	);
}
