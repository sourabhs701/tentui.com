"use client";

import { type ReactNode, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
	TextScramble,
	type TextScrambleDirection,
	type TextScrambleHandle,
	type TextScramblePreset,
} from "@/registry/components/text-scramble/text-scramble";

const STATUS_OPTIONS = [
	"Drafting",
	"Reviewing",
	"Deploying",
	"Published",
] as const;

const CHARSET_OPTIONS: {
	value: TextScramblePreset;
	label: string;
	sample: string;
}[] = [
	{
		value: "alphanumeric",
		label: "Alphanumeric",
		sample: "BUILD 4092 · READY",
	},
	{ value: "uppercase", label: "Uppercase", sample: "RELEASE 2.4 LIVE" },
	{ value: "symbols", label: "Symbols", sample: "CIPHER // VERIFIED" },
	{ value: "numeric", label: "Numeric", sample: "LATENCY 14.20 MS" },
	{ value: "binary", label: "Binary", sample: "SIGNAL 0101 LOCKED" },
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

function ReplayButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="h-7 shrink-0 cursor-pointer rounded-md border bg-background px-2.5 font-medium text-foreground text-xs shadow-xs outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
		>
			Replay
		</button>
	);
}

function DirectionRow({
	direction,
	label,
}: {
	direction: TextScrambleDirection;
	label: string;
}) {
	const textRef = useRef<TextScrambleHandle>(null);

	return (
		<div className="flex w-full items-center justify-between gap-3">
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="text-muted-foreground text-xs">{label}</span>
				<TextScramble
					ref={textRef}
					as="p"
					size="sm"
					direction={direction}
					trigger="manual"
				>
					Signal locked
				</TextScramble>
			</div>
			<ReplayButton onClick={() => textRef.current?.replay()} />
		</div>
	);
}

function TextScrambleDemo() {
	const [status, setStatus] =
		useState<(typeof STATUS_OPTIONS)[number]>("Deploying");
	const [charset, setCharset] = useState<TextScramblePreset>("alphanumeric");
	const charsetRef = useRef<TextScrambleHandle>(null);

	const activeCharset =
		CHARSET_OPTIONS.find((item) => item.value === charset) ??
		CHARSET_OPTIONS[0]!;

	return (
		<div className="flex w-full max-w-xl flex-col items-center gap-12 px-4 py-6">
			<Section
				title="Dynamic text morphing"
				description="Switch states and watch the shared prefix stay anchored while the new word settles."
			>
				<div
					role="group"
					aria-label="Deployment status"
					className="inline-flex flex-wrap items-center justify-center gap-1 rounded-lg border bg-muted/40 p-1"
				>
					{STATUS_OPTIONS.map((option) => (
						<button
							key={option}
							type="button"
							aria-pressed={status === option}
							onClick={() => setStatus(option)}
							className={cn(
								"h-7 cursor-pointer rounded-md px-2.5 font-medium text-xs outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
								status === option
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{option}
						</button>
					))}
				</div>

				<div className="flex flex-col items-center gap-1.5 text-center">
					<TextScramble
						as="h3"
						size="lg"
						trigger="manual"
						duration={560}
						className="mx-auto max-w-md text-balance text-center"
					>
						{`Status: ${status}`}
					</TextScramble>
					<p className="text-muted-foreground text-xs">
						Surrounding layout never shifts while glyphs cycle
					</p>
				</div>
			</Section>

			<Section
				title="Sweep directions"
				description="Control the order in which characters lock onto the final word."
			>
				<div className="flex w-full max-w-xs flex-col gap-5">
					<DirectionRow direction="ltr" label="From the start" />
					<DirectionRow direction="rtl" label="From the end" />
					<DirectionRow direction="center" label="From the center" />
					<DirectionRow direction="random" label="Random" />
				</div>
			</Section>

			<Section
				title="Character sets"
				description="Pick a built-in alphabet preset or supply any custom string of glyphs."
			>
				<div
					role="group"
					aria-label="Scramble character set"
					className="inline-flex flex-wrap items-center justify-center gap-1 rounded-lg border bg-muted/40 p-1"
				>
					{CHARSET_OPTIONS.map((option) => (
						<button
							key={option.value}
							type="button"
							aria-pressed={charset === option.value}
							onClick={() => {
								setCharset(option.value);
								requestAnimationFrame(() => charsetRef.current?.replay());
							}}
							className={cn(
								"h-7 cursor-pointer rounded-md px-2.5 font-medium text-xs outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
								charset === option.value
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{option.label}
						</button>
					))}
				</div>

				<div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-2.5">
					<TextScramble
						ref={charsetRef}
						as="span"
						trigger="manual"
						characterSet={activeCharset.value}
						duration={620}
						className="font-medium font-mono text-sm tracking-tight"
					>
						{activeCharset.sample}
					</TextScramble>
					<ReplayButton onClick={() => charsetRef.current?.replay()} />
				</div>
			</Section>

			<Section
				title="Hover navigation"
				description="Fast, restrained in-place scrambles on pointer enter, tap, or keyboard focus."
			>
				<div className="flex w-full max-w-xs flex-col items-center gap-2">
					{["Typography", "Interaction", "Engineering"].map((item) => (
						<TextScramble
							key={item}
							as="span"
							size="sm"
							trigger="hover"
							duration={440}
							speed={30}
							tabIndex={0}
							className="cursor-default"
						>
							{item}
						</TextScramble>
					))}
				</div>
			</Section>
		</div>
	);
}

export default TextScrambleDemo;
