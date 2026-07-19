"use client";

import { type HTMLMotionProps, motion, type Variants } from "motion/react";
import {
	type ComponentType,
	forwardRef,
	type ReactNode,
	useId,
	useSyncExternalStore,
} from "react";

import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const DRAW_PATH = {
	hidden: { pathLength: 0 },
	visible: { pathLength: 1 },
} satisfies Variants;

const REVEAL_LEFT = {
	hidden: { clipPath: "inset(0 100% 0 0)" },
	visible: { clipPath: "inset(0 0% 0 0)" },
} satisfies Variants;

function getTransition(
	shouldReduceMotion: boolean,
	duration: number,
	delay = 0,
) {
	return shouldReduceMotion
		? { duration: 0 }
		: { duration, delay, ease: EASE_OUT };
}

function subscribeToReducedMotion(onStoreChange: () => void) {
	const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
	mediaQuery.addEventListener("change", onStoreChange);

	return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
	return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot() {
	return false;
}

type ScribbleDecorationProps = {
	className?: string;
	roughFilterId: string;
	shouldReduceMotion: boolean;
	softFilterId: string;
};

function RoughFilters({
	roughFilterId,
	softFilterId,
}: Pick<ScribbleDecorationProps, "roughFilterId" | "softFilterId">) {
	return (
		<svg
			className="pointer-events-none absolute size-0 overflow-hidden"
			aria-hidden="true"
		>
			<defs>
				<filter id={roughFilterId} x="-30%" y="-30%" width="160%" height="160%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency={0.045}
						numOctaves={2}
						seed={4}
						result="noise"
					/>
					<feDisplacementMap
						in="SourceGraphic"
						in2="noise"
						scale={2.6}
						xChannelSelector="R"
						yChannelSelector="G"
					/>
				</filter>
				<filter id={softFilterId} x="-30%" y="-30%" width="160%" height="160%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency={0.035}
						numOctaves={2}
						seed={11}
						result="softNoise"
					/>
					<feDisplacementMap
						in="SourceGraphic"
						in2="softNoise"
						scale={1.5}
						xChannelSelector="R"
						yChannelSelector="G"
					/>
				</filter>
			</defs>
		</svg>
	);
}

function WavyUnderlineDecoration({
	className,
	shouldReduceMotion,
	softFilterId,
}: ScribbleDecorationProps) {
	return (
		<svg
			className={className}
			viewBox="0 0 140 14"
			fill="none"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<motion.path
				d="M2,6 Q5.5,3 9,6 T17,6 T25,6 T33,6 T41,6 T49,6 T57,6 T65,6 T73,6 T81,6 T89,6 T97,6 T105,6 T113,6 T121,6 T129,6 T137,6"
				stroke="currentColor"
				strokeWidth={2.2}
				strokeLinecap="round"
				fill="none"
				filter={`url(#${softFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.5)}
			/>
		</svg>
	);
}

function CircleDecoration({
	className,
	roughFilterId,
	shouldReduceMotion,
	softFilterId,
}: ScribbleDecorationProps) {
	return (
		<svg
			className={className}
			viewBox="0 0 220 64"
			fill="none"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<motion.path
				d="M40,40 C20,23 53,7 102,5 C153,3 207,11 211,29 C215,47 167,60 109,60 C59,60 15,53 19,35 C21,27 27,22 37,20"
				stroke="currentColor"
				strokeWidth={3}
				strokeLinecap="round"
				fill="none"
				filter={`url(#${roughFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.65)}
			/>
			<motion.path
				d="M43,37 C28,25 58,9 105,7 C151,6 199,14 206,29 C212,45 167,57 110,58"
				stroke="currentColor"
				strokeWidth={1.5}
				strokeLinecap="round"
				fill="none"
				opacity={0.55}
				filter={`url(#${softFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.65, 0.08)}
			/>
		</svg>
	);
}

function HighlightDecoration({
	className,
	shouldReduceMotion,
	softFilterId,
}: ScribbleDecorationProps) {
	return (
		<svg
			className={className}
			viewBox="0 0 170 26"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<motion.path
				d="M4,17 C2,11 5,7 12,6 C45,2 95,2 138,4 C152,5 164,7 166,13 C167,18 163,21 155,22 C112,24 60,24 16,22 C8,21.5 4,20 4,17 Z"
				fill="currentColor"
				filter={`url(#${softFilterId})`}
				variants={REVEAL_LEFT}
				transition={getTransition(shouldReduceMotion, 0.45)}
			/>
		</svg>
	);
}

function UnderlineDecoration({
	className,
	shouldReduceMotion,
	softFilterId,
}: ScribbleDecorationProps) {
	return (
		<svg
			className={className}
			viewBox="0 0 140 10"
			fill="none"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<motion.path
				d="M3,6 C40,3 100,3 137,5"
				stroke="currentColor"
				strokeWidth={2.4}
				strokeLinecap="round"
				fill="none"
				filter={`url(#${softFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.42)}
			/>
		</svg>
	);
}

function StraightUnderlineDecoration({
	className,
	shouldReduceMotion,
}: ScribbleDecorationProps) {
	return (
		<motion.span
			aria-hidden="true"
			className={cn("block rounded-full bg-current", className)}
			variants={REVEAL_LEFT}
			transition={getTransition(shouldReduceMotion, 0.35)}
		/>
	);
}

function DottedUnderlineDecoration({
	className,
	shouldReduceMotion,
}: ScribbleDecorationProps) {
	return (
		<motion.span
			aria-hidden="true"
			className={cn(
				"bg-[radial-gradient(circle,currentColor_1.5px,transparent_1.5px)]",
				"bg-position-[0_100%] bg-size-[0.5em_100%] bg-repeat-x",
				className,
			)}
			variants={REVEAL_LEFT}
			transition={getTransition(shouldReduceMotion, 0.4)}
		/>
	);
}

function DoubleUnderlineDecoration({
	className,
	shouldReduceMotion,
	softFilterId,
}: ScribbleDecorationProps) {
	return (
		<svg
			className={className}
			viewBox="0 0 140 16"
			fill="none"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<motion.path
				d="M3,5 C40,2 100,2 137,4"
				stroke="currentColor"
				strokeWidth={2.2}
				strokeLinecap="round"
				fill="none"
				filter={`url(#${softFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.45)}
			/>
			<motion.path
				d="M5,12 C42,9 98,10 135,11"
				stroke="currentColor"
				strokeWidth={1.8}
				strokeLinecap="round"
				fill="none"
				opacity={0.75}
				filter={`url(#${softFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.4, 0.08)}
			/>
		</svg>
	);
}

function StrikethroughDecoration({
	className,
	shouldReduceMotion,
	softFilterId,
}: ScribbleDecorationProps) {
	return (
		<svg
			className={className}
			viewBox="0 0 140 10"
			fill="none"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<motion.path
				d="M3,5 C40,7 100,3 137,5"
				stroke="currentColor"
				strokeWidth={2.4}
				strokeLinecap="round"
				fill="none"
				filter={`url(#${softFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.42)}
			/>
		</svg>
	);
}

function CrossOutDecoration({
	className,
	roughFilterId,
	shouldReduceMotion,
	softFilterId,
}: ScribbleDecorationProps) {
	return (
		<svg
			className={className}
			viewBox="0 0 140 40"
			fill="none"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<motion.path
				d="M4,32 C40,10 96,30 136,8"
				stroke="currentColor"
				strokeWidth={2.4}
				strokeLinecap="round"
				fill="none"
				filter={`url(#${roughFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.42)}
			/>
			<motion.path
				d="M6,10 C44,30 92,12 134,30"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				fill="none"
				opacity={0.7}
				filter={`url(#${softFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.42, 0.08)}
			/>
		</svg>
	);
}

function ArrowUnderlineDecoration({
	className,
	shouldReduceMotion,
	softFilterId,
}: ScribbleDecorationProps) {
	return (
		<svg
			className={className}
			viewBox="0 0 150 18"
			fill="none"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<motion.path
				d="M3,7 C45,3 105,4 140,8"
				stroke="currentColor"
				strokeWidth={2.4}
				strokeLinecap="round"
				fill="none"
				filter={`url(#${softFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.48)}
			/>
			<motion.path
				d="M132,3 L142,8 L131,13"
				stroke="currentColor"
				strokeWidth={2.4}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
				filter={`url(#${softFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.2, 0.34)}
			/>
		</svg>
	);
}

function BracketDecoration({
	className,
	roughFilterId,
	shouldReduceMotion,
}: ScribbleDecorationProps) {
	return (
		<svg
			className={className}
			viewBox="0 0 160 60"
			fill="none"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<motion.path
				d="M18,6 C9,7 6,12 6,30 C6,48 9,53 18,54"
				stroke="currentColor"
				strokeWidth={2.6}
				strokeLinecap="round"
				fill="none"
				filter={`url(#${roughFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.45)}
			/>
			<motion.path
				d="M142,6 C151,7 154,12 154,30 C154,48 151,53 142,54"
				stroke="currentColor"
				strokeWidth={2.6}
				strokeLinecap="round"
				fill="none"
				filter={`url(#${roughFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.45, 0.05)}
			/>
		</svg>
	);
}

function BoxDecoration({
	className,
	roughFilterId,
	shouldReduceMotion,
}: ScribbleDecorationProps) {
	return (
		<svg
			className={className}
			viewBox="0 0 200 64"
			fill="none"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<motion.path
				d="M12,10 C60,6 140,6 188,10 C193,26 193,40 188,54 C140,58 60,58 12,54 C7,40 7,26 12,10 Z"
				stroke="currentColor"
				strokeWidth={2.6}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
				filter={`url(#${roughFilterId})`}
				variants={DRAW_PATH}
				transition={getTransition(shouldReduceMotion, 0.65)}
			/>
		</svg>
	);
}

type ScribbleStyle = {
	wrapperClassName?: string;
	Decoration: ComponentType<ScribbleDecorationProps>;
	decorationClassName: string;
	defaultColorClassName: string;
};

const scribbleStyles = {
	wavyUnderline: {
		Decoration: WavyUnderlineDecoration,
		decorationClassName: "-bottom-[0.4em] -left-[2%] h-[0.7em] w-[104%]",
		defaultColorClassName: "text-purple-300",
	},
	circle: {
		wrapperClassName: "px-1",
		Decoration: CircleDecoration,
		decorationClassName:
			"inset-[-0.6em_-0.55em] h-[calc(100%+1.2em)] w-[calc(100%+1.1em)]",
		defaultColorClassName: "text-cyan-200",
	},
	highlight: {
		wrapperClassName: "isolate",
		Decoration: HighlightDecoration,
		decorationClassName:
			"inset-x-[-4%] -bottom-[0.08em] z-0 h-[1.15em] w-[108%]",
		defaultColorClassName: "text-yellow-300/60",
	},
	underline: {
		Decoration: UnderlineDecoration,
		decorationClassName: "-bottom-[0.32em] -left-[1%] h-[0.5em] w-[102%]",
		defaultColorClassName: "text-purple-400",
	},
	straightUnderline: {
		Decoration: StraightUnderlineDecoration,
		decorationClassName: "-bottom-[0.18em] -left-[1%] h-0.5 w-[102%]",
		defaultColorClassName: "text-neutral-500",
	},
	dottedUnderline: {
		Decoration: DottedUnderlineDecoration,
		decorationClassName: "-bottom-[0.35em] -left-[1%] h-[0.55em] w-[102%]",
		defaultColorClassName: "text-neutral-400",
	},
	doubleUnderline: {
		Decoration: DoubleUnderlineDecoration,
		decorationClassName: "-bottom-[0.5em] -left-[1%] h-[0.7em] w-[102%]",
		defaultColorClassName: "text-emerald-400",
	},
	strikethrough: {
		Decoration: StrikethroughDecoration,
		decorationClassName:
			"top-1/2 -left-[1%] h-[0.5em] w-[102%] -translate-y-1/2",
		defaultColorClassName: "text-red-400",
	},
	crossOut: {
		Decoration: CrossOutDecoration,
		decorationClassName:
			"top-1/2 -left-[2%] h-[1.4em] w-[104%] -translate-y-1/2",
		defaultColorClassName: "text-red-400",
	},
	arrowUnderline: {
		Decoration: ArrowUnderlineDecoration,
		decorationClassName: "-bottom-[0.45em] -left-[1%] h-[0.8em] w-[106%]",
		defaultColorClassName: "text-blue-400",
	},
	bracket: {
		wrapperClassName: "px-[0.35em]",
		Decoration: BracketDecoration,
		decorationClassName:
			"inset-y-[-0.25em] -left-[0.15em] h-[calc(100%+0.5em)] w-[calc(100%+0.3em)]",
		defaultColorClassName: "text-neutral-500",
	},
	box: {
		wrapperClassName: "px-[0.4em]",
		Decoration: BoxDecoration,
		decorationClassName:
			"inset-[-0.4em_-0.4em] h-[calc(100%+0.8em)] w-[calc(100%+0.8em)]",
		defaultColorClassName: "text-orange-400",
	},
} as const satisfies Record<string, ScribbleStyle>;

export type ScribbledTextVariant = keyof typeof scribbleStyles;

type ScribbledTextControllerProp =
	| "animate"
	| "initial"
	| "variants"
	| "viewport"
	| "whileInView";

export interface ScribbledTextProps
	extends Omit<
		HTMLMotionProps<"span">,
		ScribbledTextControllerProp | "children"
	> {
	/** Whether the hand-drawn mark animates when it enters the viewport. */
	animated?: boolean;
	children?: ReactNode;
	/** The shape of the hand-drawn mark. */
	variant?: ScribbledTextVariant;
	/** Classes applied only to the hand-drawn mark. */
	scribbleClassName?: string;
}

export const ScribbledText = forwardRef<HTMLSpanElement, ScribbledTextProps>(
	(
		{
			animated = true,
			children,
			className,
			scribbleClassName,
			variant = "wavyUnderline",
			...props
		},
		ref,
	) => {
		const shouldReduceMotion = useSyncExternalStore(
			subscribeToReducedMotion,
			getReducedMotionSnapshot,
			getReducedMotionServerSnapshot,
		);
		const shouldAnimate = animated && !shouldReduceMotion;
		const filterIdPrefix = useId().replaceAll(":", "");
		const roughFilterId = `${filterIdPrefix}-scribbled-text-rough`;
		const softFilterId = `${filterIdPrefix}-scribbled-text-soft`;
		const style: ScribbleStyle = scribbleStyles[variant];
		const Decoration = style.Decoration;
		const decorationClassName = cn(
			"pointer-events-none absolute",
			style.decorationClassName,
			style.defaultColorClassName,
			scribbleClassName,
		);

		return (
			<motion.span
				ref={ref}
				initial={shouldAnimate ? "hidden" : false}
				animate={shouldAnimate ? undefined : "visible"}
				whileInView={shouldAnimate ? "visible" : undefined}
				viewport={{ once: true, margin: "-100px" }}
				data-slot="scribbled-text"
				data-variant={variant}
				className={cn(
					"relative inline-block whitespace-nowrap",
					style.wrapperClassName,
					className,
				)}
				{...props}
			>
				<RoughFilters
					roughFilterId={roughFilterId}
					softFilterId={softFilterId}
				/>
				{variant === "highlight" ? (
					<span data-slot="scribbled-text-content" className="relative z-10">
						{children}
					</span>
				) : (
					children
				)}
				<Decoration
					className={decorationClassName}
					roughFilterId={roughFilterId}
					shouldReduceMotion={!shouldAnimate}
					softFilterId={softFilterId}
				/>
			</motion.span>
		);
	},
);

ScribbledText.displayName = "ScribbledText";

export default ScribbledText;
