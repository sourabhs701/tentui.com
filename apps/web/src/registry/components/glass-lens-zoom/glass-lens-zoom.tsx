"use client";

import {
	type AnimationPlaybackControls,
	animate,
	motion,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import {
	type ComponentProps,
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	type Ref,
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { cn } from "@/lib/utils";

/** Critically damped spring for click-to-glide, imperative moves, and controlled updates. */
const glideSpring = {
	type: "spring",
	visualDuration: 0.32,
	bounce: 0,
} as const;

/** Weighted settle for gentle momentum carry after a flick release. */
const momentumSpring = {
	type: "spring",
	stiffness: 260,
	damping: 32,
	mass: 0.95,
} as const;

/** Quick return after rubber-banding past an image edge. */
const edgeReturnSpring = {
	type: "spring",
	stiffness: 380,
	damping: 28,
} as const;

/** Taut spring for pointer tracking in hover mode. */
const hoverTrackSpring = {
	type: "spring",
	stiffness: 420,
	damping: 36,
	mass: 0.6,
} as const;

/** Crisp lift feedback when grabbing the lens. */
const pressSpring = {
	type: "spring",
	stiffness: 520,
	damping: 34,
} as const;

/** Smooth zoom interpolation when changing magnification. */
const zoomSpring = {
	type: "spring",
	visualDuration: 0.24,
	bounce: 0,
} as const;

/** Cuts a crisp 1.5px specular bevel ring around any border-radius. */
const BEVEL_RING_MASK = {
	padding: "1.5px",
	WebkitMaskImage: "linear-gradient(#000 0 0), linear-gradient(#000 0 0)",
	WebkitMaskClip: "content-box, border-box",
	WebkitMaskComposite: "xor",
	maskImage: "linear-gradient(#000 0 0), linear-gradient(#000 0 0)",
	maskClip: "content-box, border-box",
	maskComposite: "exclude",
} satisfies CSSProperties;

/** Resolution of the cached SVG bezel displacement map, in px. */
const DISPLACEMENT_MAP_SIZE = 160;
/** Inner edge inset, in px, so the lens rests cleanly inside the rounded frame. */
const EDGE_INSET_PX = 6;
/** Maximum rubber-band pull past the edge clamp during an overdrag, in px. */
const RUBBER_BAND_LIMIT_PX = 10;
/** Pointer travel in px before a tap on the image stops counting as a click-to-glide. */
const TAP_SLOP_PX = 6;
/** Window of recent pointer samples used for release velocity, in ms. */
const VELOCITY_WINDOW_MS = 75;
/** Ignore stale velocity if pointer paused before release, in ms. */
const STALE_VELOCITY_MS = 50;
/** Minimum release speed in px/s to trigger gentle momentum carry. */
const FLICK_THRESHOLD_PX_S = 220;
/** Cap on post-release momentum travel per axis, in px. */
const MAX_FLICK_TRAVEL_PX = 68;
/** Seconds of release velocity projected forward. */
const PROJECTION_SECONDS = 0.11;
/** Duration the transient zoom readout badge stays visible after zoom changes, in ms. */
const BADGE_FLASH_MS = 950;
/** Default keyboard step as a fraction of frame width/height. */
const KEYBOARD_STEP = 0.05;
const KEYBOARD_LARGE_STEP = 0.12;

export type GlassLensZoomMode = "drag" | "hover";
export type GlassLensZoomShape = "circle" | "rounded";
export type GlassLensZoomRefraction = "auto" | "off";

export interface GlassLensZoomPoint {
	/** Normalized horizontal position across the image, from `0` (left) to `1` (right). */
	x: number;
	/** Normalized vertical position across the image, from `0` (top) to `1` (bottom). */
	y: number;
}

export interface GlassLensZoomClassNames {
	/** Clipped frame wrapping the base image and interactive lens. */
	frame?: string;
	/** Base image element. */
	image?: string;
	/** Interactive floating glass lens surface. */
	lens?: string;
	/** Magnification indicator badge inside the lens. */
	badge?: string;
}

export interface GlassLensZoomHandle {
	/** Smoothly glides the lens to a normalized `(x, y)` coordinate (`0`–`1`). */
	moveTo: (point: GlassLensZoomPoint) => void;
	/** Returns the lens to `defaultPosition` and `defaultZoom`. */
	reset: () => void;
}

export interface GlassLensZoomProps
	extends Omit<ComponentProps<"div">, "children" | "ref"> {
	/** Source URL for the base image. */
	src: string;
	/** Optional higher-resolution image URL rendered inside the magnified lens. Falls back to `src`. */
	zoomSrc?: string;
	/** Accessible description of the image. */
	alt: string;
	/** Interaction mode: draggable floating loupe (`"drag"`) or pointer-following loupe (`"hover"`). Defaults to `"drag"`. */
	mode?: GlassLensZoomMode;
	/** Lens outline geometry. Defaults to `"circle"`. */
	shape?: GlassLensZoomShape;
	/** Lens diameter (or width/height for `"rounded"`) in pixels. Scales down automatically on narrow frames. Defaults to `156`. */
	lensSize?: number;
	/** Controlled magnification factor (e.g. `2.2`). */
	zoom?: number;
	/** Initial magnification factor when uncontrolled. Defaults to `2.2`. */
	defaultZoom?: number;
	/** Minimum magnification factor when adjusting zoom. Defaults to `1.4`. */
	minZoom?: number;
	/** Maximum magnification factor when adjusting zoom. Defaults to `4`. */
	maxZoom?: number;
	/** Step applied by keyboard `+`/`-` zoom controls. Defaults to `0.3`. */
	zoomStep?: number;
	/** Called whenever magnification changes. */
	onZoomChange?: (zoom: number) => void;
	/** Controlled normalized lens position (`0`–`1` on each axis). */
	position?: GlassLensZoomPoint;
	/** Initial normalized lens position when uncontrolled. Defaults to `{ x: 0.5, y: 0.5 }`. */
	defaultPosition?: GlassLensZoomPoint;
	/** Called continuously as the lens moves. */
	onPositionChange?: (position: GlassLensZoomPoint) => void;
	/** Called once a drag, click-to-glide, or keyboard step settles. */
	onPositionCommit?: (position: GlassLensZoomPoint) => void;
	/** Optical bezel refraction mode. `"auto"` enables SVG bezel displacement and chromatic dispersion in supported browsers; `"off"` uses pure crisp magnification. Defaults to `"auto"`. */
	refraction?: GlassLensZoomRefraction;
	/** Intensity of optical bezel bending from `0` to `1`. Defaults to `0.65`. */
	refractionStrength?: number;
	/** Intensity of chromatic dispersion (RGB spectral fringe) along the glass bezel from `0` to `1`. Defaults to `0.45`. */
	chromaticAberration?: number;
	/** Whether to always show the magnification readout pill inside the lens. When `false`, it appears briefly while magnification changes. Defaults to `false`. */
	showZoomBadge?: boolean;
	/** Disables dragging, click-to-glide, hover tracking, and keyboard interaction. Defaults to `false`. */
	disabled?: boolean;
	/** Optional custom class names for internal slots. */
	classNames?: GlassLensZoomClassNames;
	/** Imperative handle exposing `moveTo()` and `reset()`. */
	ref?: Ref<GlassLensZoomHandle>;
}

interface FrameSize {
	width: number;
	height: number;
}

interface PointerSample {
	time: number;
	x: number;
	y: number;
}

const displacementMapCache = new Map<GlassLensZoomShape, string>();

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, decimals = 3) {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

function rubberBand(value: number, min: number, max: number, limit: number) {
	if (value < min) {
		const over = min - value;
		return min - (over * limit) / (over + limit);
	}
	if (value > max) {
		const over = value - max;
		return max + (over * limit) / (over + limit);
	}
	return value;
}

/**
 * SVG `<feDisplacementMap>` on HTML layers runs cleanly on the GPU in Chromium.
 * Safari can clip or rasterise HTML SVG filters unevenly, so non-Chromium
 * engines and `prefers-reduced-transparency` fall back to crisp optical glass.
 */
function useRefractionSupport(refraction: GlassLensZoomRefraction) {
	const [supported, setSupported] = useState(false);

	useEffect(() => {
		if (refraction === "off") {
			setSupported(false);
			return;
		}
		const transparency = window.matchMedia(
			"(prefers-reduced-transparency: reduce)",
		);
		const update = () => {
			if (transparency.matches) {
				setSupported(false);
				return;
			}
			const brands = (
				navigator as Navigator & {
					userAgentData?: { brands?: Array<{ brand: string }> };
				}
			).userAgentData?.brands;
			const isChromium = brands
				? brands.some((entry) => entry.brand === "Chromium")
				: /\b(?:Chrome|Chromium|Edg)\//.test(navigator.userAgent);
			setSupported(isChromium);
		};
		update();
		transparency.addEventListener("change", update);
		return () => transparency.removeEventListener("change", update);
	}, [refraction]);

	return supported;
}

/**
 * Generates a normalized radial bezel displacement map for a convex glass lens.
 * The central optical zone stays neutral (128, 128) so fine detail remains
 * razor-sharp, while the curved outer bezel pulls samples smoothly inward
 * toward the lens center without ever sampling outside the clipped aperture.
 */
function getDisplacementMap(shape: GlassLensZoomShape): string {
	if (typeof document === "undefined") return "";
	const cached = displacementMapCache.get(shape);
	if (cached) return cached;

	const size = DISPLACEMENT_MAP_SIZE;
	const half = size / 2;
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext("2d");
	if (!context) return "";

	const image = context.createImageData(size, size);
	const cornerRadius = size * 0.26;
	const bezelDepth = size * 0.24;

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const px = x + 0.5 - half;
			const py = y + 0.5 - half;
			let dx = 0;
			let dy = 0;

			if (shape === "circle") {
				const dist = Math.hypot(px, py);
				const r = clamp(dist / half, 0, 1);
				// Clear central aperture (0..0.52), smoothstep convex rim (0.52..1.0).
				const bezelT = clamp((r - 0.52) / 0.48, 0, 1);
				const smooth = bezelT * bezelT * (3 - 2 * bezelT);
				const pull = smooth ** 1.35;
				if (dist > 0.001 && pull > 0) {
					dx = -(px / dist) * pull;
					dy = -(py / dist) * pull;
				}
			} else {
				const qx = Math.abs(px) - (half - cornerRadius);
				const qy = Math.abs(py) - (half - cornerRadius);
				const ox = Math.max(qx, 0);
				const oy = Math.max(qy, 0);
				const corner = Math.hypot(ox, oy);
				const depth = cornerRadius - corner - Math.min(Math.max(qx, qy), 0);
				let nx = 0;
				let ny = 0;
				if (corner > 0.001) {
					nx = (ox / corner) * Math.sign(px);
					ny = (oy / corner) * Math.sign(py);
				} else if (qx > qy) {
					nx = Math.sign(px);
				} else {
					ny = Math.sign(py);
				}
				const bezelT = clamp(1 - depth / bezelDepth, 0, 1);
				const smooth = bezelT * bezelT * (3 - 2 * bezelT);
				const pull = smooth ** 1.35;
				dx = -nx * pull;
				dy = -ny * pull;
			}

			const index = (y * size + x) * 4;
			image.data[index] = Math.round(128 + dx * 127);
			image.data[index + 1] = Math.round(128 + dy * 127);
			image.data[index + 2] = 128;
			image.data[index + 3] = 255;
		}
	}

	context.putImageData(image, 0, 0);
	const href = canvas.toDataURL("image/png");
	displacementMapCache.set(shape, href);
	return href;
}

function getBounds(frameSize: FrameSize, diameter: number) {
	const half = diameter / 2;
	const insetX = Math.min(
		EDGE_INSET_PX,
		Math.max(0, frameSize.width / 2 - half),
	);
	const insetY = Math.min(
		EDGE_INSET_PX,
		Math.max(0, frameSize.height / 2 - half),
	);
	const minX = Math.min(half + insetX, frameSize.width / 2);
	const maxX = Math.max(frameSize.width - half - insetX, frameSize.width / 2);
	const minY = Math.min(half + insetY, frameSize.height / 2);
	const maxY = Math.max(frameSize.height - half - insetY, frameSize.height / 2);
	return { minX, maxX, minY, maxY };
}

export function GlassLensZoom({
	src,
	zoomSrc,
	alt,
	mode = "drag",
	shape = "circle",
	lensSize = 156,
	zoom: zoomProp,
	defaultZoom = 2.2,
	minZoom = 1.4,
	maxZoom = 4,
	zoomStep = 0.3,
	onZoomChange,
	position: positionProp,
	defaultPosition = { x: 0.5, y: 0.5 },
	onPositionChange,
	onPositionCommit,
	refraction = "auto",
	refractionStrength = 0.65,
	chromaticAberration = 0.45,
	showZoomBadge = false,
	disabled = false,
	className,
	classNames,
	ref,
	...props
}: GlassLensZoomProps) {
	const prefersReducedMotion = useReducedMotion() ?? false;
	const supportsRefraction = useRefractionSupport(refraction);
	const rawFilterId = useId();
	const filterId = `glz-refract-${rawFilterId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

	const defaultX = clamp(defaultPosition.x, 0, 1);
	const defaultY = clamp(defaultPosition.y, 0, 1);

	const frameRef = useRef<HTMLDivElement | null>(null);
	const lensRef = useRef<HTMLDivElement | null>(null);

	const [frameSize, setFrameSize] = useState<FrameSize>({
		width: 0,
		height: 0,
	});
	const [isDragging, setIsDragging] = useState(false);
	const [isHoverActive, setIsHoverActive] = useState(false);
	const [isFocusVisible, setIsFocusVisible] = useState(false);
	const [badgeFlash, setBadgeFlash] = useState(false);
	const [mapHref, setMapHref] = useState("");

	const badgeTimerRef = useRef<number | null>(null);
	const xAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const yAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const zoomAnimRef = useRef<AnimationPlaybackControls | null>(null);
	const hasMeasuredRef = useRef(false);

	// Controlled vs uncontrolled magnification.
	const isZoomControlled = zoomProp !== undefined;
	const safeMinZoom = Math.max(1.1, minZoom);
	const safeMaxZoom = Math.max(safeMinZoom, maxZoom);
	const [uncontrolledZoom, setUncontrolledZoom] = useState(() =>
		clamp(defaultZoom, safeMinZoom, safeMaxZoom),
	);
	const activeZoom = clamp(
		isZoomControlled ? zoomProp : uncontrolledZoom,
		safeMinZoom,
		safeMaxZoom,
	);

	// Track latest normalized position so resizes keep the lens anchored to the same detail.
	const normalizedPosRef = useRef<GlassLensZoomPoint>({
		x: clamp(positionProp?.x ?? defaultX, 0, 1),
		y: clamp(positionProp?.y ?? defaultY, 0, 1),
	});

	// Responsive diameter so the lens stays proportionate on compact/mobile frames.
	const effectiveLensSize = useMemo(() => {
		if (frameSize.width <= 0 || frameSize.height <= 0) return lensSize;
		const minSide = Math.min(frameSize.width, frameSize.height);
		return Math.max(76, Math.min(lensSize, Math.round(minSide * 0.62)));
	}, [frameSize.height, frameSize.width, lensSize]);

	// Pre-rasterize the inner zoomed image at full maxZoom resolution for razor-sharp GPU scaling.
	const renderScale = useMemo(
		() => Math.min(Math.max(safeMaxZoom, activeZoom, 2.5), 4.5),
		[activeZoom, safeMaxZoom],
	);

	// Keep live geometry accessible to Motion transforms without stale closures.
	const geometryRef = useRef({
		effectiveLensSize,
		renderScale,
		frameWidth: frameSize.width,
	});
	geometryRef.current = {
		effectiveLensSize,
		renderScale,
		frameWidth: frameSize.width,
	};

	const lensX = useMotionValue(0);
	const lensY = useMotionValue(0);
	const zoomMV = useMotionValue(activeZoom);
	const liftScale = useMotionValue(1);
	const hoverScale = useMotionValue(mode === "hover" ? 0.92 : 1);
	const lensOpacity = useMotionValue(mode === "hover" ? 0 : 1);
	const geometryVersion = useMotionValue(0);

	// Derived GPU transforms (zero React re-renders during drag or glide).
	const lensTransform = useTransform(
		[lensX, lensY, liftScale, hoverScale, geometryVersion],
		([x, y, lift, hover]: number[]) => {
			const diameter = geometryRef.current.effectiveLensSize;
			const tx = x - diameter / 2;
			const ty = y - diameter / 2;
			const s = lift * hover;
			return `translate3d(${roundTo(tx, 2)}px, ${roundTo(ty, 2)}px, 0) scale(${roundTo(s, 4)})`;
		},
	);

	const zoomedImageTransform = useTransform(
		[lensX, lensY, zoomMV, geometryVersion],
		([x, y, z]: number[]) => {
			const { effectiveLensSize: diameter, renderScale: scaleBase } =
				geometryRef.current;
			const tx = diameter / 2 - x * z;
			const ty = diameter / 2 - y * z;
			const s = z / scaleBase;
			return `translate3d(${roundTo(tx, 2)}px, ${roundTo(ty, 2)}px, 0) scale(${roundTo(s, 5)})`;
		},
	);

	// Subtle overhead specular highlight angle tracks horizontal position across the photo.
	const specularRotation = useTransform(
		[lensX, geometryVersion],
		([x]: number[]) => {
			const width = geometryRef.current.frameWidth;
			if (width <= 0) return "rotate(0deg)";
			const ratio = clamp(x / width, 0, 1) - 0.5;
			return `rotate(${roundTo(ratio * 24, 2)}deg)`;
		},
	);

	// Generate displacement map once per shape on the client.
	useEffect(() => {
		if (!supportsRefraction) {
			setMapHref("");
			return;
		}
		setMapHref(getDisplacementMap(shape));
	}, [shape, supportsRefraction]);

	// Measure frame via ResizeObserver + synchronous initial measurement.
	useLayoutEffect(() => {
		const node = frameRef.current;
		if (!node) return;

		const measure = () => {
			const rect = node.getBoundingClientRect();
			const width = Math.round(rect.width);
			const height = Math.round(rect.height);
			if (width <= 0 || height <= 0) return;

			setFrameSize((prev) =>
				prev.width === width && prev.height === height
					? prev
					: { width, height },
			);
		};

		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	// Sync pixel MotionValues whenever frame dimensions initialize or resize.
	useLayoutEffect(() => {
		if (frameSize.width <= 0 || frameSize.height <= 0) return;
		const bounds = getBounds(frameSize, effectiveLensSize);
		const targetX = clamp(
			normalizedPosRef.current.x * frameSize.width,
			bounds.minX,
			bounds.maxX,
		);
		const targetY = clamp(
			normalizedPosRef.current.y * frameSize.height,
			bounds.minY,
			bounds.maxY,
		);
		xAnimRef.current?.stop();
		yAnimRef.current?.stop();
		lensX.set(targetX);
		lensY.set(targetY);
		geometryVersion.set(geometryVersion.get() + 1);
		hasMeasuredRef.current = true;
	}, [
		effectiveLensSize,
		frameSize,
		geometryVersion,
		lensX,
		lensY,
		renderScale,
	]);

	const stopPositionAnimations = useCallback(() => {
		xAnimRef.current?.stop();
		yAnimRef.current?.stop();
		xAnimRef.current = null;
		yAnimRef.current = null;
	}, []);

	const toNormalized = useCallback(
		(px: number, py: number): GlassLensZoomPoint => {
			if (frameSize.width <= 0 || frameSize.height <= 0) {
				return normalizedPosRef.current;
			}
			const bounds = getBounds(frameSize, effectiveLensSize);
			const clampedX = clamp(px, bounds.minX, bounds.maxX);
			const clampedY = clamp(py, bounds.minY, bounds.maxY);
			return {
				x: roundTo(clamp(clampedX / frameSize.width, 0, 1), 4),
				y: roundTo(clamp(clampedY / frameSize.height, 0, 1), 4),
			};
		},
		[effectiveLensSize, frameSize],
	);

	const emitPositionChange = useCallback(
		(px: number, py: number) => {
			const next = toNormalized(px, py);
			normalizedPosRef.current = next;
			onPositionChange?.(next);
			return next;
		},
		[onPositionChange, toNormalized],
	);

	const animateToPoint = useCallback(
		(
			target: GlassLensZoomPoint,
			options: {
				immediate?: boolean;
				commit?: boolean;
				emit?: boolean;
				velocityX?: number;
				velocityY?: number;
				spring?:
					| typeof glideSpring
					| typeof momentumSpring
					| typeof edgeReturnSpring
					| typeof hoverTrackSpring;
			} = {},
		) => {
			if (frameSize.width <= 0 || frameSize.height <= 0) {
				normalizedPosRef.current = {
					x: clamp(target.x, 0, 1),
					y: clamp(target.y, 0, 1),
				};
				return;
			}
			const bounds = getBounds(frameSize, effectiveLensSize);
			const px = clamp(target.x * frameSize.width, bounds.minX, bounds.maxX);
			const py = clamp(target.y * frameSize.height, bounds.minY, bounds.maxY);
			const normalized = {
				x: roundTo(px / frameSize.width, 4),
				y: roundTo(py / frameSize.height, 4),
			};
			normalizedPosRef.current = normalized;

			stopPositionAnimations();

			if (options.emit) {
				onPositionChange?.(normalized);
			}

			if (options.immediate || prefersReducedMotion) {
				lensX.set(px);
				lensY.set(py);
				if (options.commit) {
					onPositionCommit?.(normalized);
				}
				return;
			}

			const spring = options.spring ?? glideSpring;
			let finished = 0;
			const onDone = () => {
				finished += 1;
				if (finished === 2 && options.commit) {
					onPositionCommit?.(normalized);
				}
			};

			xAnimRef.current = animate(lensX, px, {
				...spring,
				velocity: options.velocityX,
				onComplete: onDone,
			});
			yAnimRef.current = animate(lensY, py, {
				...spring,
				velocity: options.velocityY,
				onComplete: onDone,
			});
		},
		[
			effectiveLensSize,
			frameSize,
			lensX,
			lensY,
			onPositionChange,
			onPositionCommit,
			prefersReducedMotion,
			stopPositionAnimations,
		],
	);

	// Sync controlled `position` updates smoothly.
	const controlledX = positionProp?.x;
	const controlledY = positionProp?.y;
	useEffect(() => {
		if (controlledX === undefined || controlledY === undefined) return;
		if (!hasMeasuredRef.current || isDragging) return;
		animateToPoint(
			{ x: controlledX, y: controlledY },
			{ immediate: false, commit: false, emit: false },
		);
	}, [animateToPoint, controlledX, controlledY, isDragging]);

	// Sync `zoom` changes smoothly on `zoomMV`.
	useEffect(() => {
		zoomAnimRef.current?.stop();
		if (prefersReducedMotion) {
			zoomMV.set(activeZoom);
			return;
		}
		zoomAnimRef.current = animate(zoomMV, activeZoom, zoomSpring);
	}, [activeZoom, prefersReducedMotion, zoomMV]);

	// Sync visibility when toggling between `drag` and `hover` modes.
	useEffect(() => {
		if (mode === "drag") {
			setIsHoverActive(false);
			animate(lensOpacity, 1, { duration: 0.16 });
			animate(hoverScale, 1, pressSpring);
		} else {
			const visible = isHoverActive || isFocusVisible;
			if (prefersReducedMotion) {
				lensOpacity.set(visible ? 1 : 0);
				hoverScale.set(1);
			} else {
				animate(lensOpacity, visible ? 1 : 0, {
					duration: visible ? 0.16 : 0.14,
					ease: [0.23, 1, 0.32, 1],
				});
				animate(hoverScale, visible ? 1 : 0.92, {
					duration: visible ? 0.18 : 0.14,
					ease: [0.23, 1, 0.32, 1],
				});
			}
		}
	}, [
		hoverScale,
		isFocusVisible,
		isHoverActive,
		lensOpacity,
		mode,
		prefersReducedMotion,
	]);

	// Clean up timers & animations on unmount.
	useEffect(() => {
		return () => {
			stopPositionAnimations();
			zoomAnimRef.current?.stop();
			if (badgeTimerRef.current !== null) {
				window.clearTimeout(badgeTimerRef.current);
			}
		};
	}, [stopPositionAnimations]);

	const flashBadge = useCallback(() => {
		setBadgeFlash(true);
		if (badgeTimerRef.current !== null) {
			window.clearTimeout(badgeTimerRef.current);
		}
		badgeTimerRef.current = window.setTimeout(() => {
			setBadgeFlash(false);
			badgeTimerRef.current = null;
		}, BADGE_FLASH_MS);
	}, []);

	const updateZoom = useCallback(
		(nextZoom: number) => {
			const clamped = roundTo(clamp(nextZoom, safeMinZoom, safeMaxZoom), 2);
			if (clamped === activeZoom) return;
			if (!isZoomControlled) {
				setUncontrolledZoom(clamped);
			}
			onZoomChange?.(clamped);
			flashBadge();
		},
		[
			activeZoom,
			flashBadge,
			isZoomControlled,
			onZoomChange,
			safeMaxZoom,
			safeMinZoom,
		],
	);

	useImperativeHandle(
		ref,
		() => ({
			moveTo(point: GlassLensZoomPoint) {
				animateToPoint(point, { emit: true, commit: true });
			},
			reset() {
				animateToPoint(
					{ x: defaultX, y: defaultY },
					{ emit: true, commit: true },
				);
				updateZoom(defaultZoom);
			},
		}),
		[animateToPoint, defaultX, defaultY, defaultZoom, updateZoom],
	);

	// Drag state for direct 1:1 pointer tracking on the lens.
	const dragRef = useRef<{
		pointerId: number;
		grabOffsetX: number;
		grabOffsetY: number;
		samples: PointerSample[];
	} | null>(null);

	// Tap state on the outer frame for click-to-glide (without interfering with mobile scroll).
	const frameTapRef = useRef<{
		pointerId: number;
		startClientX: number;
		startClientY: number;
		moved: boolean;
	} | null>(null);

	const getLocalCoords = useCallback((clientX: number, clientY: number) => {
		const node = frameRef.current;
		if (!node) return null;
		const rect = node.getBoundingClientRect();
		return {
			x: clientX - rect.left,
			y: clientY - rect.top,
			width: rect.width,
			height: rect.height,
		};
	}, []);

	const handleLensPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (disabled) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		if (dragRef.current) return;

		const local = getLocalCoords(event.clientX, event.clientY);
		if (!local) return;

		event.stopPropagation();
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			// Ignore synthetic or already-canceled pointer capture errors.
		}
		stopPositionAnimations();

		const currentX = lensX.get();
		const currentY = lensY.get();
		dragRef.current = {
			pointerId: event.pointerId,
			grabOffsetX: local.x - currentX,
			grabOffsetY: local.y - currentY,
			samples: [{ time: performance.now(), x: currentX, y: currentY }],
		};
		setIsDragging(true);
		if (mode === "hover") {
			setIsHoverActive(true);
		}
		if (!prefersReducedMotion) {
			animate(liftScale, 1.035, pressSpring);
		}
	};

	const handleLensPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (frameSize.width <= 0 || frameSize.height <= 0) return;

		const local = getLocalCoords(event.clientX, event.clientY);
		if (!local) return;

		const bounds = getBounds(frameSize, effectiveLensSize);
		const rawX = local.x - drag.grabOffsetX;
		const rawY = local.y - drag.grabOffsetY;
		const nextX = rubberBand(
			rawX,
			bounds.minX,
			bounds.maxX,
			RUBBER_BAND_LIMIT_PX,
		);
		const nextY = rubberBand(
			rawY,
			bounds.minY,
			bounds.maxY,
			RUBBER_BAND_LIMIT_PX,
		);

		lensX.set(nextX);
		lensY.set(nextY);
		emitPositionChange(nextX, nextY);

		const now = performance.now();
		drag.samples.push({ time: now, x: nextX, y: nextY });
		while (
			drag.samples.length > 2 &&
			now - drag.samples[0].time > VELOCITY_WINDOW_MS
		) {
			drag.samples.shift();
		}
	};

	const finishLensDrag = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;

		try {
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
		} catch {
			// Ignore release errors when pointer capture was already dropped.
		}
		dragRef.current = null;
		setIsDragging(false);

		if (!prefersReducedMotion) {
			animate(liftScale, 1, pressSpring);
		}

		if (frameSize.width <= 0 || frameSize.height <= 0) return;
		const bounds = getBounds(frameSize, effectiveLensSize);
		const currentX = lensX.get();
		const currentY = lensY.get();
		const outOfBounds =
			currentX < bounds.minX ||
			currentX > bounds.maxX ||
			currentY < bounds.minY ||
			currentY > bounds.maxY;

		if (outOfBounds) {
			animateToPoint(
				{
					x: clamp(currentX, bounds.minX, bounds.maxX) / frameSize.width,
					y: clamp(currentY, bounds.minY, bounds.maxY) / frameSize.height,
				},
				{ emit: true, commit: true, spring: edgeReturnSpring },
			);
			return;
		}

		// Compute recent pointer velocity for subtle momentum carry.
		const now = performance.now();
		const latest = drag.samples[drag.samples.length - 1];
		const earliest = drag.samples[0];
		let vx = 0;
		let vy = 0;
		if (
			latest &&
			earliest &&
			now - latest.time <= STALE_VELOCITY_MS &&
			latest.time - earliest.time >= 8
		) {
			const dt = (latest.time - earliest.time) / 1000;
			vx = (latest.x - earliest.x) / dt;
			vy = (latest.y - earliest.y) / dt;
		}

		const speed = Math.hypot(vx, vy);
		if (!prefersReducedMotion && speed >= FLICK_THRESHOLD_PX_S) {
			const dx = clamp(
				vx * PROJECTION_SECONDS,
				-MAX_FLICK_TRAVEL_PX,
				MAX_FLICK_TRAVEL_PX,
			);
			const dy = clamp(
				vy * PROJECTION_SECONDS,
				-MAX_FLICK_TRAVEL_PX,
				MAX_FLICK_TRAVEL_PX,
			);
			const targetX = clamp(currentX + dx, bounds.minX, bounds.maxX);
			const targetY = clamp(currentY + dy, bounds.minY, bounds.maxY);
			animateToPoint(
				{ x: targetX / frameSize.width, y: targetY / frameSize.height },
				{
					emit: true,
					commit: true,
					velocityX: vx * 0.65,
					velocityY: vy * 0.65,
					spring: momentumSpring,
				},
			);
			return;
		}

		onPositionCommit?.(toNormalized(currentX, currentY));
	};

	// Double-clicking the lens smoothly toggles between base zoom and boosted zoom.
	const handleLensDoubleClick = () => {
		if (disabled) return;
		const boosted = clamp(
			roundTo(defaultZoom + 1.0, 1),
			safeMinZoom,
			safeMaxZoom,
		);
		if (Math.abs(activeZoom - defaultZoom) < 0.15 && boosted > defaultZoom) {
			updateZoom(boosted);
		} else {
			updateZoom(defaultZoom);
		}
	};

	// Frame pointer handlers: click-to-glide in drag mode, pointer tracking in hover mode.
	const handleFramePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (disabled) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;

		if (mode === "hover" && event.pointerType === "touch") {
			const local = getLocalCoords(event.clientX, event.clientY);
			if (local && frameSize.width > 0 && frameSize.height > 0) {
				setIsHoverActive(true);
				animateToPoint(
					{ x: local.x / frameSize.width, y: local.y / frameSize.height },
					{ emit: true, commit: true },
				);
			}
			return;
		}

		frameTapRef.current = {
			pointerId: event.pointerId,
			startClientX: event.clientX,
			startClientY: event.clientY,
			moved: false,
		};
	};

	const handleFramePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (disabled) return;

		if (
			frameTapRef.current &&
			frameTapRef.current.pointerId === event.pointerId
		) {
			const dist = Math.hypot(
				event.clientX - frameTapRef.current.startClientX,
				event.clientY - frameTapRef.current.startClientY,
			);
			if (dist > TAP_SLOP_PX) {
				frameTapRef.current.moved = true;
			}
		}

		if (mode !== "hover" || event.pointerType === "touch" || isDragging) return;
		if (frameSize.width <= 0 || frameSize.height <= 0) return;

		const local = getLocalCoords(event.clientX, event.clientY);
		if (!local) return;

		const bounds = getBounds(frameSize, effectiveLensSize);
		const px = clamp(local.x, bounds.minX, bounds.maxX);
		const py = clamp(local.y, bounds.minY, bounds.maxY);

		if (!isHoverActive) {
			// Anchor directly at the entry point before revealing so the lens never flies in from off-frame.
			stopPositionAnimations();
			lensX.set(px);
			lensY.set(py);
			setIsHoverActive(true);
			emitPositionChange(px, py);
			return;
		}

		animateToPoint(
			{ x: px / frameSize.width, y: py / frameSize.height },
			{ emit: true, commit: false, spring: hoverTrackSpring },
		);
	};

	const handleFramePointerUp = (event: PointerEvent<HTMLDivElement>) => {
		const tap = frameTapRef.current;
		if (!tap || tap.pointerId !== event.pointerId) return;
		frameTapRef.current = null;

		if (disabled || tap.moved || mode !== "drag") return;
		if (frameSize.width <= 0 || frameSize.height <= 0) return;

		const local = getLocalCoords(event.clientX, event.clientY);
		if (!local) return;

		animateToPoint(
			{ x: local.x / frameSize.width, y: local.y / frameSize.height },
			{ emit: true, commit: true, spring: glideSpring },
		);
	};

	const handleFramePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
		frameTapRef.current = null;
		if (mode === "hover" && event.pointerType !== "touch" && !isDragging) {
			setIsHoverActive(false);
		}
	};

	// Keyboard navigation: direct, zero-lag steps (never animate repeated keyboard actions).
	const handleLensKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (disabled) return;
		const step = event.shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP;
		const current = normalizedPosRef.current;

		switch (event.key) {
			case "ArrowLeft": {
				event.preventDefault();
				animateToPoint(
					{ x: clamp(current.x - step, 0, 1), y: current.y },
					{ immediate: true, emit: true, commit: true },
				);
				break;
			}
			case "ArrowRight": {
				event.preventDefault();
				animateToPoint(
					{ x: clamp(current.x + step, 0, 1), y: current.y },
					{ immediate: true, emit: true, commit: true },
				);
				break;
			}
			case "ArrowUp": {
				event.preventDefault();
				animateToPoint(
					{ x: current.x, y: clamp(current.y - step, 0, 1) },
					{ immediate: true, emit: true, commit: true },
				);
				break;
			}
			case "ArrowDown": {
				event.preventDefault();
				animateToPoint(
					{ x: current.x, y: clamp(current.y + step, 0, 1) },
					{ immediate: true, emit: true, commit: true },
				);
				break;
			}
			case "+":
			case "=": {
				event.preventDefault();
				updateZoom(activeZoom + zoomStep);
				break;
			}
			case "-":
			case "_": {
				event.preventDefault();
				updateZoom(activeZoom - zoomStep);
				break;
			}
			case "0":
			case "Home": {
				event.preventDefault();
				animateToPoint(
					{ x: defaultX, y: defaultY },
					{
						immediate: true,
						emit: true,
						commit: true,
					},
				);
				updateZoom(defaultZoom);
				break;
			}
		}
	};

	// Optical filter parameters.
	const clampedStrength = clamp(refractionStrength, 0, 1);
	const clampedDispersion = clamp(chromaticAberration, 0, 1);
	const baseDisplacementScale = roundTo(
		effectiveLensSize * 0.16 * clampedStrength,
		2,
	);
	const dispersionSpread = clampedDispersion * 0.16;
	const scaleR = roundTo(baseDisplacementScale * (1 - dispersionSpread), 2);
	const scaleG = baseDisplacementScale;
	const scaleB = roundTo(baseDisplacementScale * (1 + dispersionSpread), 2);
	const useSvgFilter =
		supportsRefraction && Boolean(mapHref) && baseDisplacementScale > 0.25;
	const useChromatic = useSvgFilter && dispersionSpread > 0.005;

	const lensRadiusStyle = shape === "circle" ? "9999px" : "26%";
	const badgeVisible = showZoomBadge || badgeFlash;
	const ready = frameSize.width > 0 && frameSize.height > 0;
	const displayZoom = `${activeZoom.toFixed(1)}×`;

	return (
		<div
			data-slot="glass-lens-zoom"
			data-mode={mode}
			data-shape={shape}
			data-dragging={isDragging ? "true" : undefined}
			data-disabled={disabled ? "true" : undefined}
			className={cn("relative w-full select-none", className)}
			{...props}
		>
			{useSvgFilter ? (
				<svg
					aria-hidden="true"
					className="pointer-events-none absolute size-0 overflow-hidden"
					focusable="false"
				>
					<defs>
						<filter
							id={filterId}
							x="0%"
							y="0%"
							width="100%"
							height="100%"
							colorInterpolationFilters="sRGB"
						>
							<feImage
								href={mapHref}
								x="0"
								y="0"
								width="100%"
								height="100%"
								preserveAspectRatio="none"
								result="lensMap"
							/>
							{useChromatic ? (
								<>
									<feDisplacementMap
										in="SourceGraphic"
										in2="lensMap"
										scale={scaleR}
										xChannelSelector="R"
										yChannelSelector="G"
										result="dispR"
									/>
									<feDisplacementMap
										in="SourceGraphic"
										in2="lensMap"
										scale={scaleG}
										xChannelSelector="R"
										yChannelSelector="G"
										result="dispG"
									/>
									<feDisplacementMap
										in="SourceGraphic"
										in2="lensMap"
										scale={scaleB}
										xChannelSelector="R"
										yChannelSelector="G"
										result="dispB"
									/>
									<feColorMatrix
										in="dispR"
										type="matrix"
										values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
										result="onlyR"
									/>
									<feColorMatrix
										in="dispG"
										type="matrix"
										values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 0"
										result="onlyG"
									/>
									<feColorMatrix
										in="dispB"
										type="matrix"
										values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 0"
										result="onlyB"
									/>
									<feComposite
										in="onlyR"
										in2="onlyG"
										operator="arithmetic"
										k1={0}
										k2={1}
										k3={1}
										k4={0}
										result="rg"
									/>
									<feComposite
										in="rg"
										in2="onlyB"
										operator="arithmetic"
										k1={0}
										k2={1}
										k3={1}
										k4={0}
									/>
								</>
							) : (
								<feDisplacementMap
									in="SourceGraphic"
									in2="lensMap"
									scale={scaleG}
									xChannelSelector="R"
									yChannelSelector="G"
								/>
							)}
						</filter>
					</defs>
				</svg>
			) : null}

			<div
				ref={frameRef}
				data-slot="glass-lens-zoom-frame"
				onPointerDown={handleFramePointerDown}
				onPointerMove={handleFramePointerMove}
				onPointerUp={handleFramePointerUp}
				onPointerCancel={() => {
					frameTapRef.current = null;
				}}
				onPointerLeave={handleFramePointerLeave}
				className={cn(
					"relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/[0.1]",
					mode === "drag" && !disabled ? "cursor-crosshair" : undefined,
					mode === "hover" && !disabled ? "cursor-none" : undefined,
					disabled ? "opacity-75" : undefined,
					classNames?.frame,
				)}
				style={{ touchAction: "pan-y" }}
			>
				{/* Base image */}
				{/* biome-ignore lint/performance/noImgElement: framework-agnostic registry component */}
				<img
					src={src}
					alt={alt}
					draggable={false}
					data-slot="glass-lens-zoom-image"
					className={cn(
						"pointer-events-none block size-full select-none object-cover",
						classNames?.image,
					)}
				/>

				{/* Floating glass lens */}
				{ready ? (
					<motion.div
						ref={lensRef}
						role="button"
						aria-roledescription="movable magnifying lens"
						aria-label={`Glass magnifying lens at ${displayZoom} zoom. Use arrow keys to move, plus or minus to zoom, and 0 to reset.`}
						tabIndex={disabled ? -1 : 0}
						data-slot="glass-lens-zoom-lens"
						data-dragging={isDragging ? "true" : undefined}
						onPointerDown={handleLensPointerDown}
						onPointerMove={handleLensPointerMove}
						onPointerUp={finishLensDrag}
						onPointerCancel={finishLensDrag}
						onDoubleClick={handleLensDoubleClick}
						onKeyDown={handleLensKeyDown}
						onFocus={(event) => {
							if (event.currentTarget.matches(":focus-visible")) {
								setIsFocusVisible(true);
							}
						}}
						onBlur={() => setIsFocusVisible(false)}
						className={cn(
							"absolute top-0 left-0 outline-none focus-visible:ring-2 focus-visible:ring-white/95 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950/70",
							!disabled && mode === "drag"
								? isDragging
									? "cursor-grabbing"
									: "cursor-grab"
								: undefined,
							mode === "hover" && !isHoverActive && !isFocusVisible
								? "pointer-events-none"
								: undefined,
							classNames?.lens,
						)}
						style={{
							width: effectiveLensSize,
							height: effectiveLensSize,
							borderRadius: lensRadiusStyle,
							transform: lensTransform,
							opacity: lensOpacity,
							touchAction: "none",
							willChange: "transform",
							boxShadow: isDragging
								? "0 20px 42px -12px rgb(0 0 0 / 0.42), 0 6px 16px -4px rgb(0 0 0 / 0.24), 0 0 0 1px rgb(0 0 0 / 0.14)"
								: "0 12px 28px -10px rgb(0 0 0 / 0.32), 0 3px 10px -2px rgb(0 0 0 / 0.18), 0 0 0 1px rgb(0 0 0 / 0.12)",
							transition: "box-shadow 180ms cubic-bezier(0.23, 1, 0.32, 1)",
						}}
					>
						{/* Clipped optical aperture */}
						<div
							aria-hidden="true"
							className="pointer-events-none relative size-full overflow-hidden bg-zinc-900/10"
							style={{ borderRadius: "inherit" }}
						>
							{/* Filtered magnified image layer */}
							<div
								className="pointer-events-none relative size-full overflow-hidden"
								style={{
									filter: useSvgFilter ? `url(#${filterId})` : undefined,
								}}
							>
								{/* biome-ignore lint/performance/noImgElement: framework-agnostic registry component */}
								<motion.img
									src={zoomSrc ?? src}
									alt=""
									draggable={false}
									className="pointer-events-none block max-w-none select-none object-cover"
									style={{
										width: frameSize.width * renderScale,
										height: frameSize.height * renderScale,
										transformOrigin: "0 0",
										transform: zoomedImageTransform,
										willChange: "transform",
									}}
								/>
							</div>

							{/* Optical glass depth: subtle edge meniscus + overhead glass sheen */}
							<div
								className="pointer-events-none absolute inset-0"
								style={{
									borderRadius: "inherit",
									background:
										"radial-gradient(circle at 32% 24%, rgb(255 255 255 / 0.16) 0%, rgb(255 255 255 / 0.03) 34%, rgb(255 255 255 / 0) 62%, rgb(0 0 0 / 0.14) 100%)",
									boxShadow:
										"inset 0 1.5px 2px rgb(255 255 255 / 0.72), inset 0 -1.5px 3px rgb(0 0 0 / 0.22), inset 0 0 0 1px rgb(255 255 255 / 0.42)",
								}}
							/>

							{/* Specular crescent rim matching both circle and rounded-square geometry */}
							<motion.div
								className="pointer-events-none absolute inset-0"
								style={{
									...BEVEL_RING_MASK,
									borderRadius: "inherit",
									transform: shape === "circle" ? specularRotation : undefined,
									background:
										"conic-gradient(from 295deg at 50% 50%, rgb(255 255 255 / 0.85) 0deg, rgb(255 255 255 / 0.12) 72deg, rgb(255 255 255 / 0) 145deg, rgb(255 255 255 / 0.28) 205deg, rgb(255 255 255 / 0) 270deg, rgb(255 255 255 / 0.85) 360deg)",
								}}
							/>

							{/* Subtle magnification readout pill */}
							<div
								data-slot="glass-lens-zoom-badge"
								data-visible={badgeVisible ? "true" : "false"}
								className={cn(
									"pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-zinc-950/65 px-2 py-0.5 font-medium text-[11px] text-white tabular-nums tracking-tight ring-1 ring-white/20 backdrop-blur-md transition-[opacity,transform] duration-200 ease-out",
									badgeVisible
										? "translate-y-0 opacity-100"
										: "translate-y-1 opacity-0",
									classNames?.badge,
								)}
							>
								{displayZoom}
							</div>
						</div>
					</motion.div>
				) : null}
			</div>
		</div>
	);
}
