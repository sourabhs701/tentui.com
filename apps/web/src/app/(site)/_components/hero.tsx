"use client";

import { motion, useAnimationFrame, useMotionValue } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SHOWCASE_ITEMS = [
	{
		id: 1,
		image:
			"https://cdn.dribbble.com/userupload/46030284/file/8dfdc9a8b09fdbd99b010c1dcb279841.jpg?resize=1024x1693&vertical=center",
		height: "h-[400px]",
		bgColor: "bg-rose-200 dark:bg-rose-900/30",
	},
	{
		id: 2,
		image:
			"https://cdn.dribbble.com/userupload/46029941/file/f3b0e906d38980bf48e008f5542a58b5.jpg?resize=1024x1693&vertical=center",
		height: "h-[450px]",
		bgColor: "bg-lime-200 dark:bg-lime-900/30",
	},
	{
		id: 3,
		image:
			"https://cdn.dribbble.com/userupload/45777759/file/acf14657b38cd25e64bb16b4f201bef8.jpg?resize=1024x1529&vertical=center",
		height: "h-[420px]",
		bgColor: "bg-blue-200 dark:bg-blue-900/30",
	},
	{
		id: 4,
		image:
			"https://cdn.dribbble.com/userupload/46068721/file/3910087a60fe6f781ddae7c14daf1804.jpg?resize=1024x1589&vertical=center",
		height: "h-[380px]",
		bgColor: "bg-neutral-200 dark:bg-neutral-800",
	},
];

type SoftButtonProps = ComponentPropsWithoutRef<typeof Link> & {
	variant?: "default" | "outline";
};

function SoftButton({
	className,
	variant = "default",
	...props
}: SoftButtonProps) {
	return (
		<Link
			className={cn(
				"group relative inline-flex items-center justify-center rounded-xl border-2 px-6 py-4 font-semibold uppercase transition-all duration-150 ease-[cubic-bezier(0,0,0.58,1)]",
				"shadow-[0_12px_0_-2px_#60a5fa,0_12px_0_0_#1d4ed8,0_22px_0_0_#dbeafe]",
				"dark:shadow-[0_12px_0_-2px_#60a5fa,0_12px_0_0_#1d4ed8,0_22px_15px_-5px_rgba(0,0,0,0.3)]",
				"hover:translate-y-1 hover:shadow-[0_8px_0_-2px_#60a5fa,0_8px_0_0_#1d4ed8,0_16px_0_0_#dbeafe]",
				"dark:hover:shadow-[0_8px_0_-2px_#60a5fa,0_8px_0_0_#1d4ed8,0_16px_10px_-5px_rgba(0,0,0,0.3)]",
				"active:translate-y-3 active:shadow-[0_0px_0_-2px_#60a5fa,0_0px_0_0_#1d4ed8,0_0px_0_0_#dbeafe]",
				"dark:active:shadow-[0_0px_0_-2px_#60a5fa,0_0px_0_0_#1d4ed8,0_0px_0_0_rgba(0,0,0,0)]",
				{
					"border-blue-700 bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-600":
						variant === "default",
					"border-blue-600 bg-transparent text-blue-600 dark:text-blue-400":
						variant === "outline",
				},
				className,
			)}
			{...props}
		/>
	);
}

export function Hero() {
	const [isDragging, setIsDragging] = useState(false);
	const [hoveredId, setHoveredId] = useState<number | null>(null);
	const [oneSetWidth, setOneSetWidth] = useState(0);

	const baseVelocity = -20;
	const baseX = useMotionValue(0);
	const scrollVelocity = useRef(baseVelocity);
	const scrollerRef = useRef<HTMLDivElement>(null);

	const items = [
		...SHOWCASE_ITEMS,
		...SHOWCASE_ITEMS,
		...SHOWCASE_ITEMS,
		...SHOWCASE_ITEMS,
		...SHOWCASE_ITEMS,
		...SHOWCASE_ITEMS,
	];

	useEffect(() => {
		const handleResize = () => {
			const isMobile = window.innerWidth < 640;
			const itemWidth = isMobile ? 280 : 320;
			const gap = 24;
			const width = (itemWidth + gap) * SHOWCASE_ITEMS.length;
			setOneSetWidth(width);

			baseX.set(-width);
		};

		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [baseX]);

	useAnimationFrame((_t, delta) => {
		if (!oneSetWidth) return;

		if (!isDragging) {
			scrollVelocity.current =
				scrollVelocity.current * 0.9 + baseVelocity * 0.1;

			const moveBy = scrollVelocity.current * (delta / 1000);
			baseX.set(baseX.get() + moveBy);

			const x = baseX.get();
			if (x <= -oneSetWidth * 2) {
				baseX.set(x + oneSetWidth);
			} else if (x > 0) {
				baseX.set(x - oneSetWidth);
			}
		}
	});

	return (
		<section className="w-full bg-white px-4 py-12 sm:px-6 lg:px-8 dark:bg-neutral-950">
			<div className="mx-auto max-w-[1400px]">
				{/* Header Section */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6 }}
					className="mx-auto max-w-6xl"
				>
					<div className="max-w-4xl">
						<h2 className="font-medium text-5xl text-neutral-900 leading-[1.15] tracking-tight sm:text-[5rem] dark:text-neutral-100">
							Landing pages that feel {<br />}hand crafted.
						</h2>
						<p className="mb-8 max-w-2xl text-md text-neutral-800 sm:mb-10 sm:text-xl dark:text-neutral-400">
							100+ production-ready components, blocks, and templates to give
							your site a polished, designer-built feel. Copy, paste, customize.
						</p>
						<div className="flex flex-col gap-5 sm:flex-row sm:gap-2">
							<SoftButton href="/components">Browse Components</SoftButton>
							<SoftButton href="/blocks" variant="outline">
								Explore Blocks
							</SoftButton>
						</div>
					</div>
				</motion.div>

				{/* Infinite Carousel */}
				<div className="relative -mx-4 overflow-hidden py-20 sm:-mx-6 lg:-mx-8">
					<motion.div
						ref={scrollerRef}
						className="flex cursor-grab items-end gap-6 active:cursor-grabbing"
						style={{ x: baseX }}
						drag="x"
						onDragStart={() => setIsDragging(true)}
						onDragEnd={(_event, info) => {
							setIsDragging(false);
							scrollVelocity.current = info.velocity.x;
						}}
						dragElastic={0.05}
						dragMomentum={false}
					>
						{items.map((item, index) => (
							<motion.div
								key={`${item.id}-${index}`}
								className={`w-[280px] shrink-0 sm:w-[320px] ${item.height} pointer-events-auto relative select-none overflow-hidden rounded-2xl`}
								initial={{ rotateX: 0, opacity: 1 }}
								animate={
									hoveredId === index
										? {
												scale: 1.05,
												rotateX: -15,
												y: -25,
												zIndex: 50,
											}
										: {
												scale: 1,
												rotateX: 0,
												y: 0,
												zIndex: 1,
											}
								}
								transition={{
									duration: 0.3,
									ease: "backOut",
									zIndex: { delay: hoveredId === index ? 0 : 0.4 },
								}}
								onMouseEnter={() => setHoveredId(index)}
								onMouseLeave={() => setHoveredId(null)}
								style={{ transformPerspective: 1000 }}
							>
								<div className={`relative h-full w-full ${item.bgColor}`}>
									<Image
										src={item.image}
										alt=""
										fill
										sizes="(max-width: 639px) 280px, 320px"
										className="pointer-events-none object-cover object-top"
										draggable="false"
									/>
								</div>
							</motion.div>
						))}
					</motion.div>
				</div>
			</div>
		</section>
	);
}
