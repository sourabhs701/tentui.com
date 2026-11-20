"use client";

import { ArrowLeft, PenTool, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { parsePath } from "./parse";
import { type EditorStyle, VectorEditor } from "./vector-editor";

const NOT_FOUND_PATH = `
	M 20 165 L 20 130 L 105 25 L 150 25 L 150 125 L 172 125 L 172 165 L 150 165 L 150 210 L 105 210 L 105 165 Z
	M 105 125 L 105 82 L 70 125 Z
	M 280 25 C 225 25 195 62 195 118 C 195 174 225 210 280 210 C 335 210 365 174 365 118 C 365 62 335 25 280 25 Z
	M 280 72 C 302 72 314 88 314 118 C 314 148 302 163 280 163 C 258 163 246 148 246 118 C 246 88 258 72 280 72 Z
	M 388 165 L 388 130 L 473 25 L 518 25 L 518 125 L 540 125 L 540 165 L 518 165 L 518 210 L 473 210 L 473 165 Z
	M 473 125 L 473 82 L 438 125 Z
`;

const INITIAL_PATH = parsePath(NOT_FOUND_PATH);

/** Figma's selection blue, kept as the editor's signature accent. */
const ACCENT = "#0d99ff";

const EDITOR_STYLE: EditorStyle = {
	accent: ACCENT,
	arm: `color-mix(in oklab, ${ACCENT} 45%, var(--background))`,
	anchorR: 4,
	handleR: 3.25,
	hitR: 12,
	pointFill: "var(--background)",
	fill: ACCENT,
	fillOpacity: 0.04,
	stroke: ACCENT,
	strokeWidth: 1.25,
	showRig: true,
	fillRule: "evenodd",
};

export default function NotFound01() {
	const [path, setPath] = useState(INITIAL_PATH);
	const hintId = useId();
	const edited = path !== INITIAL_PATH;

	return (
		<section className="relative isolate flex min-h-svh flex-col overflow-hidden bg-background text-foreground">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[24px_24px] opacity-50 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]"
			/>

			<div className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-8 sm:py-24">
				<figure className="w-full max-w-[40rem] px-2 sm:px-10">
					<div className="mb-4 flex h-6 items-center justify-between gap-3">
						<span className="inline-flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
							<PenTool aria-hidden="true" className="size-3.5" />
							404.svg
						</span>
						<Button
							variant="ghost"
							size="xs"
							className="text-muted-foreground"
							disabled={!edited}
							onClick={() => setPath(INITIAL_PATH)}
						>
							<RotateCcw data-icon="inline-start" />
							Reset
						</Button>
					</div>

					<VectorEditor
						path={path}
						onChange={setPath}
						style={EDITOR_STYLE}
						viewBox={[0, 0, 560, 235]}
						width={560}
						height={235}
						className="h-auto w-full"
						ariaLabel="Editable 404 vector"
						ariaDescribedBy={hintId}
					/>

					<figcaption
						id={hintId}
						className="mt-5 text-balance text-center text-muted-foreground text-xs"
					>
						Drag any point to reshape the 404.
						<span className="hidden sm:inline">
							{" "}
							Arrow keys nudge, Shift moves by 10, [ and ] switch points, Alt
							breaks a curve handle.
						</span>
					</figcaption>
				</figure>

				<div className="mt-12 flex max-w-xl flex-col items-center text-center sm:mt-14">
					<h1 className="text-balance font-medium text-3xl tracking-tight sm:text-5xl sm:tracking-[-0.04em]">
						This page slipped off the canvas.
					</h1>
					<p className="mt-4 max-w-md text-pretty text-base text-muted-foreground leading-relaxed">
						The layer you were looking for was moved, renamed, or never made it
						past the first draft.
					</p>
					<Button
						className="mt-8 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
						size="lg"
						nativeButton={false}
						render={<a href="/" />}
					>
						<ArrowLeft data-icon="inline-start" />
						Back to home
					</Button>
				</div>
			</div>
		</section>
	);
}
