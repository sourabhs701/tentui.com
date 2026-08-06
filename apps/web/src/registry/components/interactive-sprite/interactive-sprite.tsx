"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type SpriteFrame = {
	column: number;
	row: number;
};

type Direction =
	| "center"
	| "east"
	| "north"
	| "north-east"
	| "north-west"
	| "south"
	| "south-east"
	| "south-west"
	| "west";

export type DirectionFrameMap = Record<Direction, SpriteFrame>;

export type InteractiveSpriteProps = {
	/** Accessible description for the character. Use an empty string when decorative. */
	alt: string;
	/** Number of equally sized columns in the sprite sheet. */
	columns?: number;
	/** Distance from the character's center that keeps the resting frame active. */
	deadZone?: number;
	/** Maps pointer directions to cells in the sprite sheet. */
	frames?: DirectionFrameMap;
	/** Time without pointer movement before returning to the center frame. */
	idleDelay?: number;
	/** Number of equally sized rows in the sprite sheet. */
	rows?: number;
	/** Public URL for the sprite sheet. */
	src: string;
	className?: string;
	style?: CSSProperties;
};

const DEFAULT_FRAMES: DirectionFrameMap = {
	"north-west": { column: 0, row: 0 },
	north: { column: 1, row: 0 },
	"north-east": { column: 2, row: 0 },
	west: { column: 0, row: 1 },
	center: { column: 1, row: 1 },
	east: { column: 2, row: 1 },
	"south-west": { column: 0, row: 2 },
	south: { column: 1, row: 2 },
	"south-east": { column: 2, row: 2 },
};

const OCTANTS: Direction[] = [
	"east",
	"south-east",
	"south",
	"south-west",
	"west",
	"north-west",
	"north",
	"north-east",
];

function getDirection(deltaX: number, deltaY: number, deadZone: number) {
	if (Math.hypot(deltaX, deltaY) <= deadZone) return "center";

	const octant =
		(Math.round(Math.atan2(deltaY, deltaX) / (Math.PI / 4)) + 8) % 8;

	return OCTANTS[octant];
}

function getBackgroundPosition(
	frame: SpriteFrame,
	columns: number,
	rows: number,
) {
	const x = columns === 1 ? 0 : (frame.column / (columns - 1)) * 100;
	const y = rows === 1 ? 0 : (frame.row / (rows - 1)) * 100;

	return `${x}% ${y}%`;
}

export function InteractiveSprite({
	alt,
	className,
	columns = 3,
	deadZone = 24,
	frames = DEFAULT_FRAMES,
	idleDelay = 300,
	rows = 3,
	src,
	style,
}: InteractiveSpriteProps) {
	const rootRef = useRef<HTMLSpanElement>(null);
	const activeDirectionRef = useRef<Direction>("center");
	const [activeDirection, setActiveDirection] = useState<Direction>("center");

	useEffect(() => {
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
		let animationFrame: number | null = null;
		let idleTimeout: number | undefined;

		const resetDirection = () => {
			if (activeDirectionRef.current === "center") return;

			activeDirectionRef.current = "center";
			setActiveDirection("center");
		};

		const handlePointerMove = (event: PointerEvent) => {
			if (event.pointerType === "touch" || reducedMotion.matches) return;

			window.clearTimeout(idleTimeout);
			if (animationFrame !== null) cancelAnimationFrame(animationFrame);

			animationFrame = requestAnimationFrame(() => {
				animationFrame = null;
				const root = rootRef.current;
				if (!root || reducedMotion.matches) return;

				const bounds = root.getBoundingClientRect();
				const direction = getDirection(
					event.clientX - (bounds.left + bounds.width / 2),
					event.clientY - (bounds.top + bounds.height / 2),
					deadZone,
				);

				if (direction !== activeDirectionRef.current) {
					activeDirectionRef.current = direction;
					setActiveDirection(direction);
				}

				idleTimeout = window.setTimeout(resetDirection, idleDelay);
			});
		};

		const handleMotionPreferenceChange = () => {
			if (reducedMotion.matches) resetDirection();
		};

		window.addEventListener("pointermove", handlePointerMove, {
			passive: true,
		});
		reducedMotion.addEventListener("change", handleMotionPreferenceChange);

		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			reducedMotion.removeEventListener("change", handleMotionPreferenceChange);
			window.clearTimeout(idleTimeout);
			if (animationFrame !== null) cancelAnimationFrame(animationFrame);
		};
	}, [deadZone, idleDelay]);

	const frame = frames[activeDirection];
	const spriteStyle: CSSProperties = {
		backgroundImage: `url("${src}")`,
		backgroundPosition: getBackgroundPosition(frame, columns, rows),
		backgroundRepeat: "no-repeat",
		backgroundSize: `${columns * 100}% ${rows * 100}%`,
	};
	const accessibilityProps = alt
		? { "aria-label": alt, role: "img" }
		: { "aria-hidden": true as const };

	return (
		<span
			ref={rootRef}
			className={cn("block overflow-hidden", className)}
			data-direction={activeDirection}
			data-slot="interactive-sprite"
			style={style}
			{...accessibilityProps}
		>
			<span
				aria-hidden="true"
				className="block size-full"
				style={spriteStyle}
			/>
		</span>
	);
}

export default InteractiveSprite;
