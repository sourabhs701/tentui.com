"use client";

import {
	motion,
	useMotionTemplate,
	useMotionValue,
	useReducedMotion,
	useSpring,
} from "motion/react";
import type { ComponentProps, PointerEvent } from "react";

import { cn } from "@/lib/utils";

export interface GlowCardProps extends ComponentProps<"div"> {
	glowColor?: string;
	glowSize?: number;
}

export function GlowCard({
	children,
	className,
	glowColor = "hsl(217 91% 60%)",
	glowSize = 140,
	onPointerLeave,
	onPointerMove,
	...props
}: GlowCardProps) {
	const mouseX = useMotionValue(-glowSize);
	const mouseY = useMotionValue(-glowSize);
	const smoothX = useSpring(mouseX, {
		stiffness: 220,
		damping: 30,
		mass: 0.25,
	});
	const smoothY = useSpring(mouseY, {
		stiffness: 220,
		damping: 30,
		mass: 0.25,
	});
	const reduceMotion = useReducedMotion();
	const backgroundImage = useMotionTemplate`radial-gradient(${glowSize}px circle at ${smoothX}px ${smoothY}px, ${glowColor}, transparent 70%)`;

	function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
		onPointerMove?.(event);
		if (
			event.defaultPrevented ||
			event.pointerType === "touch" ||
			reduceMotion
		) {
			return;
		}

		const bounds = event.currentTarget.getBoundingClientRect();
		mouseX.set(event.clientX - bounds.left);
		mouseY.set(event.clientY - bounds.top);
	}

	function handlePointerLeave(event: PointerEvent<HTMLDivElement>) {
		onPointerLeave?.(event);
		mouseX.set(-glowSize);
		mouseY.set(-glowSize);
	}

	return (
		<div
			className={cn(
				"group/glow-card relative overflow-hidden rounded-xl bg-border/70 p-px",
				className,
			)}
			data-slot="glow-card"
			onPointerLeave={handlePointerLeave}
			onPointerMove={handlePointerMove}
			{...props}
		>
			<motion.div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:opacity-0 motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover/glow-card:opacity-100"
				style={{ backgroundImage }}
			/>
			<div className="relative h-full overflow-hidden rounded-[inherit]">
				{children}
			</div>
		</div>
	);
}
