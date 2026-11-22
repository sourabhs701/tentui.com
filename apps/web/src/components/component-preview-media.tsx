"use client";

import { useReducedMotion } from "motion/react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RegistryItem } from "shadcn/schema";

import { cn } from "@/lib/utils";

const themes = ["light", "dark"] as const;

// Stills are exported from the 480×360 capture frame (COMPONENT_CAPTURE_FRAME,
// not imported here to keep the registry out of client bundles). Explicit
// dimensions give the img its 4:3 ratio; the classes still size it to the card.
const STILL_WIDTH = 480;
const STILL_HEIGHT = 360;

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
			width={STILL_WIDTH}
			height={STILL_HEIGHT}
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

function getPosterSrc(component: RegistryItem, theme: "light" | "dark") {
	const image = component.meta?.image;
	return typeof image === "string"
		? themedMediaUrl(image, theme, "webp")
		: undefined;
}

type NetworkInformationLike = EventTarget & { saveData?: boolean };

const REDUCED_DATA_QUERY = "(prefers-reduced-data: reduce)";

/**
 * True when the visitor asked to save data (the Save-Data client hint, or the
 * `prefers-reduced-data` media query where supported). Previews then keep the
 * still instead of downloading video.
 */
function useSaveData() {
	const [saveData, setSaveData] = useState(false);

	useEffect(() => {
		const connection = (
			navigator as Navigator & { connection?: NetworkInformationLike }
		).connection;
		const query =
			typeof window.matchMedia === "function"
				? window.matchMedia(REDUCED_DATA_QUERY)
				: null;
		const update = () =>
			setSaveData(connection?.saveData === true || query?.matches === true);

		update();
		connection?.addEventListener?.("change", update);
		query?.addEventListener?.("change", update);
		return () => {
			connection?.removeEventListener?.("change", update);
			query?.removeEventListener?.("change", update);
		};
	}, []);

	return saveData;
}

// A tap or key press is a user gesture, which lets iOS start a video it
// refused to autoplay (Low Power Mode, for instance).
const GESTURE_EVENTS = ["touchend", "pointerup", "click", "keydown"] as const;

/**
 * Plays `video`, and if the browser refuses because autoplay is blocked,
 * retries on the visitor's next gesture. Returns a cleanup that cancels the
 * pending retry.
 */
function playWhenAllowed(video: HTMLVideoElement) {
	let cancelled = false;
	let removeGestureListeners: (() => void) | undefined;

	const retry = () => {
		removeGestureListeners?.();
		if (!cancelled) void video.play().catch(() => {});
	};

	video.play().catch((error: unknown) => {
		if (cancelled) return;
		if (!(error instanceof DOMException) || error.name !== "NotAllowedError")
			return;
		for (const type of GESTURE_EVENTS) {
			document.addEventListener(type, retry, { capture: true, passive: true });
		}
		removeGestureListeners = () => {
			for (const type of GESTURE_EVENTS) {
				document.removeEventListener(type, retry, { capture: true });
			}
		};
	});

	return () => {
		cancelled = true;
		removeGestureListeners?.();
	};
}

/**
 * React only sets `muted` as a property and never renders the attribute, and
 * older iOS reads `webkit-playsinline`. iOS checks these before it will play
 * a video inline without a gesture, so set them on the element directly
 * before it loads.
 */
function prepareInlineVideo(video: HTMLVideoElement) {
	video.defaultMuted = true;
	video.muted = true;
	video.setAttribute("muted", "");
	video.setAttribute("playsinline", "");
	video.setAttribute("webkit-playsinline", "");
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
 * it (e.g. on hover). This works the same on touch devices: the video is
 * muted and inline, so iOS Safari allows it to autoplay. The still renders on
 * the server and is the video's poster; the video for the active theme
 * mounts only once it is needed (`preload="none"`, so nothing downloads
 * before then), pauses off screen, and is dropped again if it leaves before
 * it could play, which cancels the download. Reduced motion, Save-Data and a
 * video that fails to load all keep the still.
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
	const saveData = useSaveData();
	const [inView, setInView] = useState(false);
	const [activated, setActivated] = useState(false);
	const [videoReady, setVideoReady] = useState(false);
	const [hasPlayed, setHasPlayed] = useState(false);
	const [failedSrc, setFailedSrc] = useState<string | null>(null);

	const controlled = playing !== undefined;
	const theme =
		resolvedTheme === "dark" || resolvedTheme === "light"
			? resolvedTheme
			: null;
	const videoSrc = theme ? getVideoSrc(component, theme) : null;
	const posterSrc = theme ? getPosterSrc(component, theme) : undefined;
	const videoFailed = videoSrc !== null && failedSrc === videoSrc;
	const shouldPlay =
		reduceMotion !== true &&
		!saveData &&
		!videoFailed &&
		(controlled ? playing : inView);

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
		else if (!hasPlayed || videoFailed) setActivated(false);
	}, [shouldPlay, hasPlayed, videoFailed]);

	useEffect(() => {
		if (!videoSrc) return;
		setVideoReady(false);
		setHasPlayed(false);
	}, [videoSrc]);

	useEffect(() => {
		if (!video) return;

		if (shouldPlay) return playWhenAllowed(video);

		video.pause();
		if (controlled) {
			video.currentTime = 0;
			setVideoReady(false);
		}
	}, [video, shouldPlay, controlled]);

	const attachVideo = useCallback((element: HTMLVideoElement | null) => {
		if (element) prepareInlineVideo(element);
		setVideo(element);
	}, []);

	const showVideo = videoReady && !videoFailed && (shouldPlay || !controlled);

	return (
		<div
			ref={rootRef}
			className={cn("pointer-events-none absolute inset-0", className)}
		>
			<ComponentPreviewImage component={component} sizes={sizes} />
			{activated && videoSrc && !videoFailed && (
				<video
					key={videoSrc}
					ref={attachVideo}
					src={videoSrc}
					poster={posterSrc}
					aria-hidden
					tabIndex={-1}
					muted
					loop
					playsInline
					webkit-playsinline=""
					autoPlay={!controlled}
					disablePictureInPicture
					disableRemotePlayback
					preload="none"
					onPlaying={() => {
						setVideoReady(true);
						setHasPlayed(true);
					}}
					onError={() => {
						setFailedSrc(videoSrc);
						setVideoReady(false);
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
