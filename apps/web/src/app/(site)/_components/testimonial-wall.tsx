"use client";

import {
	motion,
	useAnimationFrame,
	useInView,
	useMotionValue,
	useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface Testimonial {
	id: string;
	text: string;
	author: {
		name: string;
		handle: string;
		avatarUrl?: string;
		verified?: boolean;
	};
}

// Speed is px/s; negative scrolls down. Extra columns appear as space allows.
const COLUMNS = [
	{ speed: 24, className: "" },
	{ speed: -20, className: "hidden sm:block" },
	{ speed: 30, className: "hidden lg:block" },
];

// Each loop must be taller than the viewport, so short lists repeat.
const MIN_CARDS_PER_LOOP = 6;

export function XLogo({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			fill="currentColor"
			viewBox="0 0 24 24"
		>
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
		</svg>
	);
}

function VerifiedMark() {
	return (
		<svg
			aria-label="Verified"
			className="size-3.5 shrink-0 text-[#1d9bf0]"
			fill="currentColor"
			role="img"
			viewBox="0 0 22 22"
		>
			<path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44C12.275 1.819 11.647 1.62 11 1.604c-.646.017-1.275.213-1.815.568s-.972.854-1.246 1.44c-.608-.223-1.264-.27-1.898-.14-.633.13-1.217.437-1.687.882-.445.47-.751 1.053-.882 1.687-.13.633-.083 1.29.14 1.897-.586.274-1.086.705-1.44 1.246-.354.54-.55 1.17-.569 1.816.018.646.215 1.275.57 1.816.354.54.853.972 1.439 1.246-.223.607-.27 1.264-.14 1.897.131.634.437 1.218.882 1.687.47.445 1.053.751 1.687.882.633.131 1.29.083 1.897-.14.274.587.705 1.086 1.246 1.44.54.354 1.17.551 1.816.569.646-.018 1.275-.215 1.816-.57.54-.354.972-.852 1.246-1.439.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.882.445-.47.751-1.053.882-1.687.13-.633.083-1.29-.14-1.897.587-.274 1.086-.705 1.44-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
		</svg>
	);
}

function initials(name: string) {
	return name
		.split(/\s+/)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

// Short posts read as a headline, longer ones as a quote.
function Quote({ text }: { text: string }) {
	const words = text.split(/\s+/).length;

	return (
		<blockquote
			className={cn(
				"text-pretty font-semibold text-foreground tracking-tight",
				words <= 3 && "text-[clamp(2rem,11cqi,2.75rem)] leading-none",
				words > 3 &&
					words <= 18 &&
					"text-[clamp(1.25rem,7cqi,1.75rem)] leading-[1.15]",
				words > 18 && "text-[clamp(1rem,5cqi,1.125rem)] leading-snug",
			)}
		>
			{text}
		</blockquote>
	);
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
	const { author } = testimonial;

	return (
		<a
			aria-label={`Read ${author.name}'s post on X`}
			className="group flex flex-col rounded-[21px] border bg-muted p-0.5 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
			href={`https://x.com/${author.handle}/status/${testimonial.id}`}
			rel="noreferrer"
			target="_blank"
		>
			<div className="@container relative flex min-h-40 flex-col justify-end rounded-[19px] border bg-background p-5 pt-12">
				<XLogo className="absolute top-5 right-5 size-4 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
				<Quote text={testimonial.text} />
			</div>

			<div className="flex items-center gap-2.5 px-3 pt-2 pb-1.5">
				<Avatar size="sm">
					{author.avatarUrl ? (
						<AvatarImage
							alt=""
							src={author.avatarUrl.replace("_normal.", "_bigger.")}
						/>
					) : null}
					<AvatarFallback className="text-[10px]">
						{initials(author.name)}
					</AvatarFallback>
				</Avatar>
				<span className="flex min-w-0 items-center gap-1 font-semibold text-sm tracking-tight">
					<span className="truncate">{author.name}</span>
					{author.verified ? <VerifiedMark /> : null}
				</span>
				<span className="ml-auto shrink-0 text-muted-foreground text-xs">
					@{author.handle}
				</span>
			</div>
		</a>
	);
}

function MarqueeColumn({
	items,
	speed,
	className,
}: {
	items: Testimonial[];
	speed: number;
	className?: string;
}) {
	const reduceMotion = useReducedMotion();
	const viewportRef = useRef<HTMLDivElement>(null);
	const loopRef = useRef<HTMLDivElement>(null);
	const loopHeight = useRef(0);
	const velocity = useRef(speed);
	const isInView = useInView(viewportRef);
	const [isPaused, setIsPaused] = useState(false);
	const y = useMotionValue(0);

	// Quotes reflow with the column width and avatars load late.
	useEffect(() => {
		const loop = loopRef.current;
		if (!loop) return;

		const observer = new ResizeObserver(() => {
			loopHeight.current = loop.offsetHeight;
		});
		observer.observe(loop);
		return () => observer.disconnect();
	}, []);

	useAnimationFrame((_t, delta) => {
		const height = loopHeight.current;
		if (!height || !isInView) return;

		// Ease to a stop under the pointer so a post can be read.
		const target = reduceMotion || isPaused ? 0 : speed;
		velocity.current = velocity.current * 0.9 + target * 0.1;

		const next = y.get() - velocity.current * (delta / 1000);
		y.set(((next % height) - height) % height || 0);
	});

	return (
		<div
			className={cn(
				"relative h-[680px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] sm:h-[800px] lg:h-[880px]",
				className,
			)}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) {
					setIsPaused(false);
				}
			}}
			onFocus={() => setIsPaused(true)}
			onPointerEnter={() => setIsPaused(true)}
			onPointerLeave={() => setIsPaused(false)}
			ref={viewportRef}
		>
			<motion.div style={{ y }}>
				<div className="flex flex-col gap-4 pb-4" ref={loopRef}>
					{items.map((testimonial, index) => (
						<TestimonialCard
							key={`${testimonial.id}-${index}`}
							testimonial={testimonial}
						/>
					))}
				</div>
				{/* A copy of the loop so the wrap is seamless. */}
				<div aria-hidden="true" className="flex flex-col gap-4 pb-4" inert>
					{items.map((testimonial, index) => (
						<TestimonialCard
							key={`${testimonial.id}-${index}`}
							testimonial={testimonial}
						/>
					))}
				</div>
			</motion.div>
		</div>
	);
}

// Every column shows every post, offset so neighbours never line up.
function columnItems(testimonials: Testimonial[], column: number) {
	const start = Math.round((column * testimonials.length) / COLUMNS.length);
	const rotated = [
		...testimonials.slice(start),
		...testimonials.slice(0, start),
	];
	const repeats = Math.ceil(MIN_CARDS_PER_LOOP / rotated.length);

	return Array.from({ length: repeats }, () => rotated).flat();
}

export function TestimonialWall({
	testimonials,
}: {
	testimonials: Testimonial[];
}) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{COLUMNS.map((column, index) => (
				<MarqueeColumn
					className={column.className}
					items={columnItems(testimonials, index)}
					key={column.speed}
					speed={column.speed}
				/>
			))}
		</div>
	);
}
