"use client";

import { useReducedMotion } from "motion/react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import type { RegistryItem } from "shadcn/schema";

import { cn } from "@/lib/utils";

const themes = ["light", "dark"] as const;

/**
 * `<base>-<theme>.<ext>`, keeping any query on the base (e.g. `?v=2` to
 * bust caches after re-recording) at the end of the URL.
 */
function themedMediaUrl(
	base: string,
	theme: (typeof themes)[number],
	extension: string,
) {
	const queryIndex = base.indexOf("?");
	const path = queryIndex === -1 ? base : base.slice(0, queryIndex);
	const query = queryIndex === -1 ? "" : base.slice(queryIndex);
	return `${encodeURI(path)}-${theme}.${extension}${query}`;
}

export function ComponentPreviewImage({
	component,
	className,
	sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
}: {
	component: RegistryItem;
	className?: string;
	sizes?: string;
}) {
	const image = component.meta?.image;
	if (typeof image !== "string") return null;

	return themes.map((theme) => (
		<Image
			key={theme}
			src={themedMediaUrl(image, theme, "webp")}
			alt={`${component.title ?? component.name} ${theme} preview`}
			fill
			sizes={sizes}
			className={cn(
				"absolute inset-0 size-full object-cover",
				className,
				theme === "light" ? "block dark:hidden" : "hidden dark:block",
			)}
			unoptimized
		/>
	));
}

function getVideoSrc(component: RegistryItem, theme: "light" | "dark") {
	const video = component.meta?.video;
	return typeof video === "string" ? themedMediaUrl(video, theme, "mp4") : null;
}

// How much of the media must be on screen, and for how long, before its video
// is attached. Scrolling past a card only ever shows the still, so a long
// grid doesn't download every video on the way down.
const VIEW_THRESHOLD = 0.4;
const VIEW_DWELL_MS = 250;

/**
 * A component's captured still with its preview video layered on top.
 *
 * Leave `playing` unset to autoplay while the media is on screen, or control
 * it (e.g. on hover). The still renders on the server; the video for the
 * active theme mounts only once it is needed (`preload="none"`, so nothing
 * downloads before then), pauses off screen, and is dropped again if it
 * leaves before it could play, which cancels the download. Reduced motion
 * keeps the still.
 */
export function ComponentPreviewMedia({
	component,
	className,
	playing,
	sizes,
}: {
	component: RegistryItem;
	className?: string;
	playing?: boolean;
	sizes?: string;
}) {
	const rootRef = useRef<HTMLDivElement>(null);
	const [video, setVideo] = useState<HTMLVideoElement | null>(null);
	const { resolvedTheme } = useTheme();
	const reduceMotion = useReducedMotion();
	const [inView, setInView] = useState(false);
	const [activated, setActivated] = useState(false);
	const [videoReady, setVideoReady] = useState(false);
	const [hasPlayed, setHasPlayed] = useState(false);

	const controlled = playing !== undefined;
	const shouldPlay = reduceMotion !== true && (controlled ? playing : inView);
	const theme =
		resolvedTheme === "dark" || resolvedTheme === "light"
			? resolvedTheme
			: null;
	const videoSrc = theme ? getVideoSrc(component, theme) : null;

	useEffect(() => {
		if (controlled) return;
		const root = rootRef.current;
		if (!root) return;

		let dwell: ReturnType<typeof setTimeout> | undefined;
		const observer = new IntersectionObserver(
			([entry]) => {
				clearTimeout(dwell);
				if (entry?.isIntersecting) {
					dwell = setTimeout(() => setInView(true), VIEW_DWELL_MS);
				} else {
					setInView(false);
				}
			},
			{ threshold: VIEW_THRESHOLD },
		);
		observer.observe(root);
		return () => {
			clearTimeout(dwell);
			observer.disconnect();
		};
	}, [controlled]);

	useEffect(() => {
		if (shouldPlay) setActivated(true);
		// Left before the first frame played: unmount to cancel the download.
		else if (!hasPlayed) setActivated(false);
	}, [shouldPlay, hasPlayed]);

	useEffect(() => {
		if (!videoSrc) return;
		setVideoReady(false);
		setHasPlayed(false);
	}, [videoSrc]);

	useEffect(() => {
		if (!video) return;

		if (shouldPlay) {
			void video.play().catch(() => {});
			return;
		}

		video.pause();
		if (controlled) {
			video.currentTime = 0;
			setVideoReady(false);
		}
	}, [video, shouldPlay, controlled]);

	const showVideo = videoReady && (shouldPlay || !controlled);

	return (
		<div
			ref={rootRef}
			className={cn("pointer-events-none absolute inset-0", className)}
		>
			<ComponentPreviewImage component={component} sizes={sizes} />
			{activated && videoSrc && (
				<video
					key={videoSrc}
					ref={setVideo}
					src={videoSrc}
					aria-hidden
					tabIndex={-1}
					muted
					loop
					playsInline
					disablePictureInPicture
					disableRemotePlayback
					preload="none"
					onPlaying={() => {
						setVideoReady(true);
						setHasPlayed(true);
					}}
					className={cn(
						"absolute inset-0 size-full object-cover transition-opacity duration-300 ease-out",
						showVideo ? "opacity-100" : "opacity-0",
					)}
				/>
			)}
		</div>
	);
}
