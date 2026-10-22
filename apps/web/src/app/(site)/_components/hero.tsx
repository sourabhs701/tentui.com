"use client";

import {
	motion,
	useAnimationFrame,
	useMotionValue,
	useReducedMotion,
} from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ComponentPreviewMedia } from "@/components/component-preview-media";
import { components } from "@/lib/components";

import { SoftButton } from "./soft-button";

// Order mixes shapes and colors so neighbouring cards read differently.
const SHOWCASE_ORDER = [
	"hold-to-confirm",
	"search-command",
	"stateful-button",
	"animated-tabs",
	"scribbled-text",
	"email-dock",
	"tailwindcss-buttons",
	"interactive-sprite",
	"theme-toggle",
	"component-sidebar",
	"copy-button",
	"tile-field",
	"peeping-button",
	"brand-context-menu",
	"animated-arrow",
];

const SHOWCASE_ITEMS = SHOWCASE_ORDER.flatMap((name) => {
	const component = components.find((item) => item.name === name);
	return component ? [component] : [];
});

const CAROUSEL_ITEMS = [
	...SHOWCASE_ITEMS,
	...SHOWCASE_ITEMS,
	...SHOWCASE_ITEMS,
];

const CARD_WIDTH = { mobile: 300, desktop: 360 } as const;
const CARD_GAP = 20;

export function Hero() {
	const reduceMotion = useReducedMotion();
	const [isDragging, setIsDragging] = useState(false);
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const [oneSetWidth, setOneSetWidth] = useState(0);

	const baseVelocity = -28;
	const baseX = useMotionValue(0);
	const scrollVelocity = useRef(baseVelocity);
	const didDrag = useRef(false);

	useEffect(() => {
		const handleResize = () => {
			const cardWidth =
				window.innerWidth < 640 ? CARD_WIDTH.mobile : CARD_WIDTH.desktop;
			const width = (cardWidth + CARD_GAP) * SHOWCASE_ITEMS.length;
			setOneSetWidth(width);
			baseX.set(-width);
		};

		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [baseX]);

	useAnimationFrame((_t, delta) => {
		if (!oneSetWidth || isDragging) return;

		// Ease to a stop under the pointer so a card can be watched.
		const target = reduceMotion || hoveredIndex !== null ? 0 : baseVelocity;
		scrollVelocity.current = scrollVelocity.current * 0.9 + target * 0.1;
		baseX.set(baseX.get() + scrollVelocity.current * (delta / 1000));

		const x = baseX.get();
		if (x <= -oneSetWidth * 2) baseX.set(x + oneSetWidth);
		else if (x > 0) baseX.set(x - oneSetWidth);
	});

	return (
		<section className="w-full overflow-hidden bg-background px-4 pt-12 pb-8 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-6xl">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6 }}
					className="max-w-4xl"
				>
					<h1 className="font-medium text-5xl text-foreground leading-[1.05] tracking-tight sm:text-[5rem]">
						Landing pages that feel <br className="hidden sm:block" />
						hand crafted.
					</h1>
					<p className="mt-6 mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
						Production-ready components and blocks to give your site a polished,
						designer-built feel. Copy, paste, customize.
					</p>
					<div className="flex flex-col gap-5 sm:flex-row sm:gap-3">
						<SoftButton href="/components">Browse Components</SoftButton>
						<SoftButton href="/blocks" variant="outline">
							Explore Blocks
						</SoftButton>
					</div>
				</motion.div>
			</div>

			{/* Infinite carousel of live component previews */}
			<div className="relative -mx-4 mt-16 overflow-hidden py-10 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] sm:-mx-6 lg:-mx-8">
				<motion.div
					className="flex cursor-grab active:cursor-grabbing"
					style={{ x: baseX, gap: CARD_GAP }}
					drag="x"
					onPointerDownCapture={() => {
						didDrag.current = false;
					}}
					onDragStart={() => {
						didDrag.current = true;
						setIsDragging(true);
					}}
					onDragEnd={(_event, info) => {
						setIsDragging(false);
						scrollVelocity.current = info.velocity.x;
					}}
					dragElastic={0.05}
					dragMomentum={false}
				>
					{CAROUSEL_ITEMS.map((component, index) => (
						<motion.div
							key={`${component.name}-${index}`}
							className="w-[300px] shrink-0 select-none sm:w-[420px]"
							animate={
								hoveredIndex === index
									? { scale: 1.03, rotateX: -8, y: -12 }
									: { scale: 1, rotateX: 0, y: 0 }
							}
							transition={{ duration: 0.3, ease: "backOut" }}
							onMouseEnter={() => setHoveredIndex(index)}
							onMouseLeave={() => setHoveredIndex(null)}
							style={{ transformPerspective: 1000 }}
						>
							<Link
								href={`/components/${component.name}` as Route}
								aria-label={component.title ?? component.name}
								draggable={false}
								onClick={(event) => {
									if (didDrag.current) event.preventDefault();
								}}
								className="flex flex-col rounded-[22px] border bg-muted p-1 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)] outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
							>
								<div className="relative aspect-4/3 w-full overflow-hidden rounded-[18px] border bg-background">
									<ComponentPreviewMedia
										component={component}
										sizes="(max-width: 639px) 300px, 360px"
									/>
								</div>
							</Link>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}
