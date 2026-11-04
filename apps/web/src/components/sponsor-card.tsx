"use client";

import { ArrowUpRightIcon, ImageIcon } from "lucide-react";
import { motion } from "motion/react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { type FeedSponsor, sponsorHref } from "@/config/sponsor";
import { useShownSponsors } from "@/hooks/use-sponsor-slots";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

// ─── Sponsor Card ──────────────────────────────────────────────────────────
// Sits in the components grid with the same shell as a component card: the
// sponsor booked in feed slot `slot`, or an open slot that links to /sponsor.
export function SponsorCard({ slot, index }: { slot: number; index: number }) {
	const [isHovered, setIsHovered] = useState(false);
	const shown = useShownSponsors();
	const sponsor = shown?.feed[slot];

	const hoverProps = {
		onMouseEnter: () => setIsHovered(true),
		onMouseLeave: () => setIsHovered(false),
		onFocus: () => setIsHovered(true),
		onBlur: () => setIsHovered(false),
		className:
			"group relative flex flex-col overflow-hidden rounded-xl border bg-muted shadow-card transition-all duration-300",
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, delay: 0.02 * index, ease: "easeOut" }}
		>
			{shown === undefined ? (
				<div aria-hidden className={hoverProps.className}>
					<div className="h-[260px] w-full rounded-xl bg-background shadow-surface-inset" />
				</div>
			) : sponsor ? (
				<a
					href={sponsorHref(sponsor.href)}
					target="_blank"
					rel="sponsored noopener noreferrer"
					aria-label={`Sponsored: ${sponsor.name}`}
					{...hoverProps}
				>
					<div className="relative h-[260px] w-full overflow-hidden rounded-xl bg-background shadow-surface-inset">
						<SponsorMedia sponsor={sponsor} playing={isHovered} />
						<div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
							<div className="flex min-w-0 items-center gap-1.5">
								<SponsorLogo sponsor={sponsor} />
								<span
									className={cn(
										"truncate rounded-lg border bg-background/90 px-2 py-1 font-medium text-[11px] text-foreground shadow-xs backdrop-blur",
										"transition-[opacity,translate,filter] duration-300 ease-out",
										isHovered
											? "translate-x-0 opacity-100 blur-0"
											: "-translate-x-1.5 opacity-0 blur-[2px]",
									)}
								>
									{sponsor.description}
								</span>
							</div>
							<span className="shrink-0 rounded-lg border bg-background/90 px-2 py-1 font-medium text-[11px] text-muted-foreground shadow-xs backdrop-blur">
								Sponsored
							</span>
						</div>
					</div>
				</a>
			) : (
				<Link href={"/sponsor" as Route} {...hoverProps}>
					<CardChrome
						isHovered={isHovered}
						title="Open sponsor slot"
						action="Sponsor TentUI"
						icon={<ArrowUpRightIcon className="size-3" />}
					>
						<OpenSlot />
					</CardChrome>
				</Link>
			)}
		</motion.div>
	);
}

function CardChrome({
	isHovered,
	title,
	action,
	icon,
	children,
}: {
	isHovered: boolean;
	title: string;
	action: string;
	icon: ReactNode;
	children: ReactNode;
}) {
	return (
		<>
			<motion.div
				initial={false}
				animate={{ height: isHovered ? 32 : 0, opacity: isHovered ? 1 : 0 }}
				transition={{ duration: 0.5, ease }}
				className="overflow-hidden"
			>
				<div className="flex items-center justify-between px-4 pt-3 pb-1">
					<span className="text-xs text-zinc-400">{title}</span>
					<span className="flex items-center gap-1 font-medium text-xs text-zinc-500 dark:text-zinc-400">
						{action}
						<span className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
							{icon}
						</span>
					</span>
				</div>
			</motion.div>
			<motion.div
				initial={false}
				animate={{ height: isHovered ? 228 : 260 }}
				transition={{ duration: 0.5, ease }}
				className="relative w-full overflow-hidden rounded-xl bg-background shadow-surface-inset transition-colors"
			>
				{children}
			</motion.div>
		</>
	);
}

function SponsorLogo({ sponsor }: { sponsor: FeedSponsor }) {
	return (
		<span className="flex size-7 shrink-0 items-center justify-center rounded-lg border bg-background p-1.5 shadow-xs">
			<Image
				src={sponsor.logoSrc}
				alt=""
				width={16}
				height={16}
				unoptimized
				className={cn(
					"size-full object-contain",
					sponsor.logoDarkSrc && "dark:hidden",
				)}
			/>
			{sponsor.logoDarkSrc ? (
				<Image
					src={sponsor.logoDarkSrc}
					alt=""
					width={16}
					height={16}
					unoptimized
					className="hidden size-full object-contain dark:block"
				/>
			) : null}
		</span>
	);
}

function SponsorMedia({
	sponsor,
	playing,
}: {
	sponsor: FeedSponsor;
	playing: boolean;
}) {
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		if (playing) {
			void video.play().catch(() => {});
		} else {
			video.pause();
			video.currentTime = 0;
		}
	}, [playing]);

	return (
		<div className="pointer-events-none absolute inset-0">
			<Image
				src={sponsor.imageSrc}
				alt=""
				fill
				sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
				unoptimized
				className={cn("object-cover", sponsor.imageDarkSrc && "dark:hidden")}
			/>
			{sponsor.imageDarkSrc ? (
				<Image
					src={sponsor.imageDarkSrc}
					alt=""
					fill
					sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
					unoptimized
					className="hidden object-cover dark:block"
				/>
			) : null}
			{sponsor.videoSrc ? (
				<video
					ref={videoRef}
					src={sponsor.videoSrc}
					muted
					loop
					playsInline
					preload="metadata"
					className={cn(
						"absolute inset-0 size-full object-cover transition-opacity duration-300 ease-out motion-reduce:hidden",
						playing ? "opacity-100" : "opacity-0",
					)}
				/>
			) : null}
		</div>
	);
}

function OpenSlot() {
	return (
		<div className="absolute inset-3 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center transition-colors group-hover:border-foreground/30">
			<span className="flex size-9 items-center justify-center rounded-lg border border-dashed text-muted-foreground transition-colors group-hover:border-foreground/30 group-hover:text-foreground">
				<ImageIcon className="size-[18px]" />
			</span>
			<div className="px-6">
				<p className="font-medium text-foreground text-sm tracking-tight">
					Your product here
				</p>
				<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
					Put your image or video in front of the developers browsing these
					components.
				</p>
			</div>
		</div>
	);
}
