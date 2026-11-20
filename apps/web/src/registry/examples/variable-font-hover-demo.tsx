"use client";

import { Mona_Sans } from "next/font/google";
import { type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";
import {
	VariableFontHover,
	type VariableFontHoverAxis,
} from "@/registry/components/variable-font-hover/variable-font-hover";

const monaSans = Mona_Sans({
	subsets: ["latin"],
	axes: ["wdth"],
	preload: false,
});

const AXIS_OPTIONS: { value: VariableFontHoverAxis; label: string }[] = [
	{ value: "weight", label: "Weight" },
	{ value: "width", label: "Width" },
	{ value: "both", label: "Both" },
];

function Section({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<div className="flex flex-col items-center gap-1 text-center">
				<p className="font-medium text-muted-foreground text-xs">{title}</p>
				{description ? (
					<p className="max-w-sm text-muted-foreground/80 text-xs">
						{description}
					</p>
				) : null}
			</div>
			{children}
		</section>
	);
}

function VariableFontHoverDemo() {
	const [axis, setAxis] = useState<VariableFontHoverAxis>("both");

	return (
		<div className="flex w-full max-w-xl flex-col items-center gap-12 px-4 py-6">
			<Section
				title="Axes (Mona Sans)"
				description="Switch between weight, width, or both axes together."
			>
				<div
					role="group"
					aria-label="Variable font axis"
					className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1"
				>
					{AXIS_OPTIONS.map((option) => (
						<button
							key={option.value}
							type="button"
							aria-pressed={axis === option.value}
							onClick={() => setAxis(option.value)}
							className={cn(
								"h-7 rounded-md px-2.5 font-medium text-xs outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
								axis === option.value
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{option.label}
						</button>
					))}
				</div>

				<div className="flex flex-col items-center gap-1.5 text-center">
					<VariableFontHover
						as="h3"
						size="lg"
						axis={axis}
						weightRange={[350, 850]}
						widthRange={[95, 125]}
						radius={160}
						tabIndex={0}
						className={cn(
							monaSans.className,
							"mx-auto max-w-md text-balance text-center",
						)}
					>
						Fluid optical weight
					</VariableFontHover>
					<p className="text-muted-foreground text-xs">
						Surrounding copy stays anchored with zero layout shift
					</p>
				</div>
			</Section>

			<Section
				title="Per-word granularity"
				description="Whole words swell cleanly across multi-line copy."
			>
				<VariableFontHover
					as="p"
					size="sm"
					granularity="word"
					weightRange={[350, 750]}
					radius={150}
					falloff="cosine"
					tabIndex={0}
					className="max-w-md text-center leading-relaxed tracking-[-0.015em]"
				>
					Good typography feels alive without ever disturbing the calm geometry
					of the page around it.
				</VariableFontHover>
			</Section>

			<Section
				title="Restrained emphasis"
				description="Lower intensity and tighter radius for subtle navigation or lists."
			>
				<div className="flex w-full max-w-xs flex-col items-center gap-2">
					{["Typography", "Motion", "Interaction"].map((item) => (
						<VariableFontHover
							key={item}
							as="span"
							size="sm"
							weightRange={[400, 750]}
							radius={100}
							intensity={0.85}
							tabIndex={0}
							className="cursor-default"
						>
							{item}
						</VariableFontHover>
					))}
				</div>
			</Section>
		</div>
	);
}

export default VariableFontHoverDemo;
