"use client";

import {
	AnimatePresence,
	motion,
	useInView,
	usePageInView,
	useReducedMotion,
} from "motion/react";
import type { ReactNode } from "react";
import { Children, memo, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_COLUMN_COUNT = 4;
const CYCLE_INTERVAL = 1600;
const STAGGER_DELAY = 125;
const EASE_OUT_QUAD = [0.25, 0.46, 0.45, 0.94] as const;

type WaveDirection = "ltr" | "rtl";

export type LogosCarouselProps = {
	/** Logo elements to cycle through. Each child is rendered as a single logo. */
	children: ReactNode;
	/**
	 * Number of columns to spread the logos across. Capped at the number of logos.
	 * @defaultValue 4
	 */
	columnCount?: number;
	/**
	 * Direction the ripple travels: left-to-right or right-to-left.
	 * @defaultValue "ltr"
	 */
	direction?: WaveDirection;
	className?: string;
};

export function LogosCarousel({
	children,
	columnCount = DEFAULT_COLUMN_COUNT,
	direction = "ltr",
	className,
}: LogosCarouselProps) {
	const columns = useMemo(
		() => distributeLogos(Children.toArray(children), columnCount),
		[children, columnCount],
	);
	const reduceMotion = useReducedMotion() ?? false;
	const containerRef = useRef<HTMLDivElement>(null);
	const isPageInView = usePageInView();
	const isInView = useInView(containerRef, { margin: "100px" });
	const shouldPlay = !reduceMotion && isPageInView && isInView;
	const [activeIndices, setActiveIndices] = useState<number[]>(() =>
		columns.map(() => 0),
	);
	const columnsRef = useRef(columns);

	useEffect(() => {
		columnsRef.current = columns;
	}, [columns]);

	useEffect(() => {
		if (!shouldPlay) return;

		const beatId = setInterval(() => {
			setActiveIndices((previous) =>
				columnsRef.current.map(
					(column, columnIndex) =>
						((previous[columnIndex] ?? 0) + 1) % column.length,
				),
			);
		}, CYCLE_INTERVAL);

		return () => clearInterval(beatId);
	}, [shouldPlay]);

	if (columns.length === 0) return null;

	return (
		<div
			ref={containerRef}
			data-slot="logos-carousel"
			className={cn("grid", className)}
			style={{
				gridTemplateColumns: `repeat(var(--column-count,${columns.length}), minmax(0, 1fr))`,
			}}
		>
			{columns.map((columnLogos, columnIndex) => {
				const waveIndex =
					direction === "rtl" ? columns.length - 1 - columnIndex : columnIndex;

				return (
					<LogoColumn
						key={columnIndex}
						logos={columnLogos}
						columnIndex={columnIndex}
						waveIndex={waveIndex}
						activeIndex={(activeIndices[columnIndex] ?? 0) % columnLogos.length}
						reduceMotion={reduceMotion}
					/>
				);
			})}
		</div>
	);
}

type LogoColumnProps = {
	logos: ReactNode[];
	columnIndex: number;
	waveIndex: number;
	activeIndex: number;
	reduceMotion: boolean;
};

const LogoColumn = memo(function LogoColumn({
	logos,
	columnIndex,
	waveIndex,
	activeIndex,
	reduceMotion,
}: LogoColumnProps) {
	const swapDelay = reduceMotion ? 0 : waveIndex * (STAGGER_DELAY / 1000);

	return (
		<motion.div
			data-slot="logos-carousel-column"
			className="relative"
			initial={
				reduceMotion ? false : { opacity: 0, transform: "translateY(60%)" }
			}
			animate={{ opacity: 1, transform: "translateY(0%)" }}
			transition={
				reduceMotion
					? { duration: 0 }
					: { ease: EASE_OUT_QUAD, duration: 0.5, delay: swapDelay }
			}
		>
			<AnimatePresence mode="popLayout">
				<motion.div
					key={`${columnIndex}-${activeIndex}`}
					data-slot="logos-carousel-logo"
					className="flex size-full items-center justify-center"
					initial={
						reduceMotion
							? false
							: {
									transform: "translateY(60%)",
									opacity: 0,
									filter: "blur(2px)",
								}
					}
					animate={{
						transform: "translateY(0%)",
						opacity: 1,
						filter: "blur(0px)",
						transition: reduceMotion
							? { duration: 0 }
							: { ease: EASE_OUT_QUAD, duration: 0.5, delay: swapDelay },
					}}
					exit={
						reduceMotion
							? undefined
							: {
									transform: "translateY(-50%)",
									opacity: 0,
									filter: "blur(3px)",
									transition: {
										ease: EASE_OUT_QUAD,
										duration: 0.5,
										delay: swapDelay,
									},
								}
					}
				>
					{logos[activeIndex]}
				</motion.div>
			</AnimatePresence>
		</motion.div>
	);
});

function distributeLogos(
	logos: ReactNode[],
	columnCount: number,
): ReactNode[][] {
	const requestedCount = Number.isFinite(columnCount)
		? Math.max(1, Math.floor(columnCount))
		: DEFAULT_COLUMN_COUNT;
	const effectiveCount = Math.min(requestedCount, logos.length);
	const columns: ReactNode[][] = Array.from(
		{ length: effectiveCount },
		() => [],
	);

	logos.forEach((logo, index) => {
		columns[index % effectiveCount].push(logo);
	});

	return columns;
}

export default LogosCarousel;
