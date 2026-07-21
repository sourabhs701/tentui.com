"use client";

import { MotionConfig, motion } from "motion/react";
import * as React from "react";

import { cn } from "@/lib/utils";

export type AnimatedTab = {
	value: string;
	label: React.ReactNode;
};

export type AnimatedTabsProps = Omit<
	React.ComponentProps<"div">,
	"defaultValue" | "role"
> & {
	tabs: readonly AnimatedTab[];
	/** Controlled active tab value. */
	value?: string;
	/** Initial active tab value when uncontrolled. Defaults to the first tab. */
	defaultValue?: string;
	/** Fired when the active tab changes. */
	onValueChange?: (value: string) => void;
	/** Shared-layout id for the active indicator. */
	layoutId?: string;
};

const INDICATOR_SPRING = {
	type: "spring",
	duration: 0.35,
	bounce: 0.12,
} as const;

const INSTANT_TRANSITION = { duration: 0 } as const;

export function AnimatedTabs({
	tabs,
	value,
	defaultValue,
	onValueChange,
	layoutId,
	className,
	onKeyDown,
	...props
}: AnimatedTabsProps) {
	const generatedLayoutId = React.useId();
	const [internalValue, setInternalValue] = React.useState(
		defaultValue ?? tabs[0]?.value,
	);
	const requestedValue = value ?? internalValue;
	const active = tabs.some((tab) => tab.value === requestedValue)
		? requestedValue
		: tabs[0]?.value;
	const indicatorLayoutId = layoutId ?? `animated-tabs-${generatedLayoutId}`;
	const tabRefs = React.useRef(new Map<string, HTMLButtonElement>());
	const instantValueRef = React.useRef<string | null>(null);

	function selectTab(nextValue: string, animate = true) {
		instantValueRef.current = animate ? null : nextValue;
		if (value === undefined) setInternalValue(nextValue);
		onValueChange?.(nextValue);
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		onKeyDown?.(event);
		if (event.defaultPrevented) return;

		const index = tabs.findIndex((tab) => tab.value === active);
		if (index === -1 || tabs.length === 0) return;

		let nextTab: AnimatedTab | undefined;
		if (event.key === "ArrowRight" || event.key === "ArrowDown") {
			nextTab = tabs[(index + 1) % tabs.length];
		} else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
			nextTab = tabs[(index - 1 + tabs.length) % tabs.length];
		} else if (event.key === "Home") {
			nextTab = tabs[0];
		} else if (event.key === "End") {
			nextTab = tabs[tabs.length - 1];
		} else {
			return;
		}

		event.preventDefault();
		if (!nextTab) return;

		selectTab(nextTab.value, false);
		tabRefs.current.get(nextTab.value)?.focus();
	}

	if (tabs.length === 0) return null;

	return (
		<MotionConfig reducedMotion="user">
			<div
				{...props}
				className={cn(
					"relative inline-flex items-center gap-1 rounded-md bg-muted/60 p-1",
					className,
				)}
				data-slot="animated-tabs"
				onKeyDown={handleKeyDown}
				role="radiogroup"
			>
				{tabs.map((tab) => {
					const selected = tab.value === active;

					return (
						<button
							aria-checked={selected}
							className={cn(
								"relative inline-flex h-6 flex-1 cursor-pointer touch-manipulation items-center justify-center rounded-md px-3 font-medium text-sm transition-[color,transform] ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98]",
								instantValueRef.current === active
									? "duration-0"
									: "duration-160",
								selected
									? "text-primary-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
							data-slot="animated-tabs-trigger"
							data-state={selected ? "active" : "inactive"}
							key={tab.value}
							onClick={() => selectTab(tab.value)}
							ref={(node) => {
								if (node) tabRefs.current.set(tab.value, node);
								else tabRefs.current.delete(tab.value);
							}}
							role="radio"
							tabIndex={selected ? 0 : -1}
							type="button"
						>
							{selected ? (
								<motion.span
									aria-hidden="true"
									className="absolute inset-0 rounded-md bg-primary shadow-sm"
									data-slot="animated-tabs-indicator"
									layoutId={indicatorLayoutId}
									transition={
										instantValueRef.current === active
											? INSTANT_TRANSITION
											: INDICATOR_SPRING
									}
								/>
							) : null}
							<span className="relative z-10">{tab.label}</span>
						</button>
					);
				})}
			</div>
		</MotionConfig>
	);
}

export default AnimatedTabs;
