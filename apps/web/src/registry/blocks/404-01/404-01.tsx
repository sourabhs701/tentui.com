"use client";

import { ArrowLeft, RotateCcw } from "lucide-react";
import { useState } from "react";
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

const EDITOR_STYLE: EditorStyle = {
	accent: "#0d99ff",
	arm: "#8dbce0",
	anchorR: 4,
	handleR: 3.2,
	pointFill: "var(--background)",
	fill: "none",
	fillOpacity: 0,
	stroke: "#0d99ff",
	strokeWidth: 1.25,
	showRig: true,
	fillRule: "evenodd",
};

export default function NotFound01() {
	const [path, setPath] = useState(() => parsePath(NOT_FOUND_PATH));

	return (
		<section className="relative isolate flex min-h-svh flex-col overflow-hidden bg-background text-foreground">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[24px_24px] opacity-35 [mask-image:radial-gradient(ellipse_70%_62%_at_50%_40%,black,transparent)]"
			/>

			<main className="flex flex-1 flex-col items-center justify-center px-5 py-16 sm:px-8 sm:py-20">
				<div className="relative w-full max-w-[40rem] px-4 sm:px-10">
					<Button
						className="absolute top-0 right-0 text-muted-foreground"
						variant="ghost"
						size="icon-sm"
						aria-label="Reset vector"
						title="Reset vector"
						onClick={() => setPath(parsePath(NOT_FOUND_PATH))}
					>
						<RotateCcw />
					</Button>
					<VectorEditor
						path={path}
						onChange={setPath}
						style={EDITOR_STYLE}
						viewBox={[0, 0, 560, 235]}
						width={560}
						height={235}
						className="h-auto w-full"
						ariaLabel="Editable 404 vector"
					/>
				</div>

				<div className="mt-14 flex max-w-xl flex-col items-center text-center sm:mt-16">
					<h1 className="text-balance font-medium text-3xl tracking-[-0.04em] sm:text-5xl">
						This page slipped off the canvas.
					</h1>
					<p className="mt-4 max-w-md text-pretty text-muted-foreground leading-6">
						The layer you were looking for was moved, renamed, or never made it
						past the first draft.
					</p>
					<Button
						className="mt-7 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none"
						size="lg"
						nativeButton={false}
						render={<a href="/" />}
					>
						<ArrowLeft data-icon="inline-start" />
						Back to home
					</Button>
				</div>
			</main>
		</section>
	);
}
