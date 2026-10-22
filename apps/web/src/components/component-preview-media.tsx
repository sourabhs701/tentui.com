"use client";

import { useReducedMotion } from "motion/react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import type { RegistryItem } from "shadcn/schema";

import { cn } from "@/lib/utils";

const themes = ["light", "dark"] as const;

export function ComponentPreviewImage({
	component,
	className,
	sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
}: {
	component: RegistryItem;
	className?: string;
	sizes?: string;
}) {
	const imageBase = `https://cdn.tentui.com/images/${encodeURIComponent(component.name)}-`;

	return themes.map((theme) => (
		<Image
			key={theme}
			src={`${imageBase}${theme}.png`}
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
	return typeof video === "string" ? `${encodeURI(video)}-${theme}.mp4` : null;
}

/**
 * A component's captured still with its preview video layered on top.
 *
 * Leave `playing` unset to autoplay while the media is on screen, or control
 * it (e.g. on hover). The video for the active theme mounts only once it is
 * first needed, and reduced motion keeps the still.
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

		const observer = new IntersectionObserver(
			([entry]) => setInView(entry?.isIntersecting ?? false),
			{ threshold: 0.4 },
		);
		observer.observe(root);
		return () => observer.disconnect();
	}, [controlled]);

	useEffect(() => {
		if (shouldPlay) setActivated(true);
	}, [shouldPlay]);

	useEffect(() => {
		if (videoSrc) setVideoReady(false);
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
					muted
					loop
					playsInline
					preload="auto"
					onPlaying={() => setVideoReady(true)}
					className={cn(
						"absolute inset-0 size-full object-cover transition-opacity duration-300 ease-out",
						showVideo ? "opacity-100" : "opacity-0",
					)}
				/>
			)}
		</div>
	);
}
