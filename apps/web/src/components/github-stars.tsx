"use client";

import { Button } from "@tentui.com/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@tentui.com/ui/components/tooltip";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { UTM_PARAMS } from "@/config/site";
import { addQueryParams } from "@/utils/url";

import { GitHubIcon } from "./icons";

const compactNumber = new Intl.NumberFormat("en-US", {
	notation: "compact",
	compactDisplay: "short",
});
const fullNumber = new Intl.NumberFormat("en-US");
const morphSpring = { type: "spring", stiffness: 250, damping: 24 } as const;
const popSpring = { type: "spring", stiffness: 320, damping: 15 } as const;

function StarIcon(props: React.ComponentProps<"svg">) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden {...props}>
			<path
				fill="currentColor"
				d="m12 1.7 3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 17.75 5.82 21 7 14.13 2 9.25l6.91-1z"
			/>
		</svg>
	);
}

function SparkleIcon(props: React.ComponentProps<"svg">) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden {...props}>
			<path
				fill="currentColor"
				d="m12 0 2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z"
			/>
		</svg>
	);
}

type GitHubStarsProps = {
	repo: string;
	stargazersCount?: number | null;
};

export function GitHubStars({ repo, stargazersCount }: GitHubStarsProps) {
	const [hovered, setHovered] = useState(false);
	const [displayCount, setDisplayCount] = useState(stargazersCount);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		const controller = new AbortController();

		fetch("/api/github-stars", { signal: controller.signal })
			.then((response) => {
				if (!response.ok) throw new Error("GitHub star request failed");
				return response.json() as Promise<{ stargazersCount?: unknown }>;
			})
			.then(({ stargazersCount }) => {
				if (typeof stargazersCount === "number") {
					setDisplayCount(stargazersCount);
				}
			})
			.catch(() => {});

		return () => controller.abort();
	}, []);
	const transition = reduceMotion ? { duration: 0 } : morphSpring;

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						className="gap-1.5 border-none px-1.5"
						variant="ghost"
						size="sm"
						nativeButton={false}
						render={
							<a
								href={addQueryParams(`https://github.com/${repo}`, UTM_PARAMS)}
								target="_blank"
								rel="noopener"
								aria-label={
									displayCount == null
										? "Star TentUI on GitHub"
										: `Star TentUI on GitHub (${displayCount} stars)`
								}
								onMouseEnter={() => setHovered(true)}
								onMouseLeave={() => setHovered(false)}
								onFocus={() => setHovered(true)}
								onBlur={() => setHovered(false)}
							>
								<span className="relative flex size-5 items-center justify-center">
									<motion.span
										initial={false}
										animate={{
											scale: reduceMotion ? 1 : hovered ? 0.25 : 1,
											opacity: hovered ? 0 : 1,
											rotate: reduceMotion ? 0 : hovered ? -60 : 0,
											filter:
												reduceMotion || !hovered ? "blur(0px)" : "blur(4px)",
										}}
										transition={transition}
										className="flex items-center justify-center"
									>
										<GitHubIcon className="size-4" />
									</motion.span>
									<motion.span
										initial={false}
										animate={{
											scale: reduceMotion ? 1 : hovered ? 1 : 0.25,
											opacity: hovered ? 1 : 0,
											rotate: reduceMotion ? 0 : hovered ? 0 : -150,
											filter:
												reduceMotion || hovered ? "blur(0px)" : "blur(4px)",
										}}
										transition={
											reduceMotion || !hovered ? transition : popSpring
										}
										className="absolute inset-0 flex items-center justify-center text-amber-400"
									>
										<StarIcon className="size-4.5" />
									</motion.span>
									<motion.span
										initial={false}
										animate={{
											scale: hovered && !reduceMotion ? 1 : 0,
											opacity: hovered && !reduceMotion ? 1 : 0,
											rotate: hovered ? 0 : -90,
										}}
										transition={
											hovered
												? { ...popSpring, delay: 0.1 }
												: { duration: 0.15 }
										}
										className="absolute top-0 -right-0.5 text-amber-200"
									>
										<SparkleIcon className="size-1.5" />
									</motion.span>
									<motion.span
										initial={false}
										animate={{
											scale: hovered && !reduceMotion ? 1 : 0,
											opacity: hovered && !reduceMotion ? 1 : 0,
											rotate: hovered ? 0 : 90,
										}}
										transition={
											hovered
												? { ...popSpring, delay: 0.18 }
												: { duration: 0.15 }
										}
										className="absolute bottom-0 left-0 text-amber-200"
									>
										<SparkleIcon className="size-1" />
									</motion.span>
								</span>
								{displayCount != null ? (
									<span className="text-[0.8125rem]/none text-muted-foreground tabular-nums">
										{compactNumber.format(displayCount).toLowerCase()}
									</span>
								) : null}
							</a>
						}
					/>
				}
			/>
			<TooltipContent className="tabular-nums">
				{displayCount == null
					? "Star TentUI on GitHub"
					: `${fullNumber.format(displayCount)} stars`}
			</TooltipContent>
		</Tooltip>
	);
}
