"use client";

import { type ReactNode, useRef } from "react";

import {
	AsciiDecodeText,
	type AsciiDecodeTextDirection,
	type AsciiDecodeTextHandle,
} from "@/registry/components/ascii-decode-text/ascii-decode-text";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function ReplayButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="h-7 shrink-0 rounded-md border bg-background px-2.5 font-medium text-foreground text-xs shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			Replay
		</button>
	);
}

function DirectionLine({
	direction,
	label,
}: {
	direction: AsciiDecodeTextDirection;
	label: string;
}) {
	const text = useRef<AsciiDecodeTextHandle>(null);
	return (
		<div className="flex w-full items-center justify-between gap-3">
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="text-muted-foreground text-xs">{label}</span>
				<AsciiDecodeText ref={text} as="p" size="sm" direction={direction}>
					Signal found
				</AsciiDecodeText>
			</div>
			<ReplayButton onClick={() => text.current?.replay()} />
		</div>
	);
}

function AsciiDecodeTextDemo() {
	const hero = useRef<AsciiDecodeTextHandle>(null);

	return (
		<div className="flex w-full max-w-xl flex-col items-center gap-12 px-4 py-6">
			<Section title="On view">
				<AsciiDecodeText
					ref={hero}
					as="h3"
					size="lg"
					className="max-w-md text-balance text-center"
				>
					Every interface starts as noise
				</AsciiDecodeText>
				<ReplayButton onClick={() => hero.current?.replay()} />
			</Section>

			<Section title="Decoder lens">
				<AsciiDecodeText
					as="h3"
					size="lg"
					trigger="manual"
					decoded
					className="max-w-md text-balance text-center"
				>
					Read between the lines
				</AsciiDecodeText>
				<p className="text-muted-foreground text-xs">
					<span className="pointer-coarse:hidden">Move across the text</span>
					<span className="pointer-coarse:inline hidden">
						Drag across the text
					</span>
				</p>
			</Section>

			<Section title="Directions">
				<div className="flex w-full max-w-xs flex-col gap-5">
					<DirectionLine direction="ltr" label="From the start" />
					<DirectionLine direction="center" label="From the center" />
					<DirectionLine direction="random" label="Random" />
				</div>
			</Section>
		</div>
	);
}

export default AsciiDecodeTextDemo;
