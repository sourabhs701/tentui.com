"use client";

import { RotateCcwIcon } from "lucide-react";
import { useRef, useState } from "react";

import {
	GlassLensZoom,
	type GlassLensZoomHandle,
	type GlassLensZoomMode,
	type GlassLensZoomPoint,
	type GlassLensZoomRefraction,
	type GlassLensZoomShape,
} from "@/registry/components/glass-lens-zoom/glass-lens-zoom";

const SUBJECTS = [
	{
		id: "poppies",
		label: "Botanical",
		src: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1200&h=900&q=85",
		zoomSrc:
			"https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=2000&h=1500&q=90",
		alt: "Red poppies blooming in a sunlit field",
		initial: { x: 0.48, y: 0.48 },
	},
	{
		id: "peaks",
		label: "Alpine",
		src: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?auto=format&fit=crop&w=1200&h=900&q=85",
		zoomSrc:
			"https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?auto=format&fit=crop&w=2000&h=1500&q=90",
		alt: "Snowy mountain peaks rising through clouds",
		initial: { x: 0.52, y: 0.42 },
	},
	{
		id: "coast",
		label: "Coastline",
		src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&h=900&q=85",
		zoomSrc:
			"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&h=1500&q=90",
		alt: "Soft waves rolling onto a sandy beach at sunrise",
		initial: { x: 0.44, y: 0.56 },
	},
] as const;

const ZOOM_PRESETS = [1.6, 2.2, 3.0, 3.6] as const;

export default function GlassLensZoomDemo() {
	const lensRef = useRef<GlassLensZoomHandle>(null);
	const [subjectIndex, setSubjectIndex] = useState(0);
	const [mode, setMode] = useState<GlassLensZoomMode>("drag");
	const [shape, setShape] = useState<GlassLensZoomShape>("circle");
	const [refraction, setRefraction] = useState<GlassLensZoomRefraction>("auto");
	const [zoom, setZoom] = useState(2.2);
	const [position, setPosition] = useState<GlassLensZoomPoint>(
		SUBJECTS[0].initial,
	);

	const subject = SUBJECTS[subjectIndex];

	const selectSubject = (index: number) => {
		setSubjectIndex(index);
		const next = SUBJECTS[index].initial;
		setPosition(next);
		lensRef.current?.moveTo(next);
	};

	const handleReset = () => {
		setZoom(2.2);
		setPosition(subject.initial);
		lensRef.current?.moveTo(subject.initial);
	};

	return (
		<div className="flex w-full max-w-[520px] flex-col gap-3.5">
			{/* Top selector bar */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div
					role="group"
					aria-label="Choose image"
					className="inline-flex items-center rounded-lg border border-zinc-200/80 bg-zinc-100/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/80"
				>
					{SUBJECTS.map((item, index) => {
						const active = index === subjectIndex;
						return (
							<button
								key={item.id}
								type="button"
								onClick={() => selectSubject(index)}
								aria-pressed={active}
								className={`min-h-8 rounded-md px-2.5 py-1.5 font-medium text-xs transition-colors sm:min-h-0 sm:py-1 ${
									active
										? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
										: "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
								}`}
							>
								{item.label}
							</button>
						);
					})}
				</div>

				<div className="flex items-center gap-1.5">
					<div
						role="group"
						aria-label="Interaction mode"
						className="inline-flex items-center rounded-lg border border-zinc-200/80 bg-zinc-100/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/80"
					>
						{(["drag", "hover"] as const).map((item) => {
							const active = mode === item;
							return (
								<button
									key={item}
									type="button"
									onClick={() => setMode(item)}
									aria-pressed={active}
									className={`min-h-8 rounded-md px-2.5 py-1.5 font-medium text-xs capitalize transition-colors sm:min-h-0 sm:py-1 ${
										active
											? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
											: "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
									}`}
								>
									{item}
								</button>
							);
						})}
					</div>

					<div
						role="group"
						aria-label="Lens shape"
						className="inline-flex items-center rounded-lg border border-zinc-200/80 bg-zinc-100/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/80"
					>
						{(["circle", "rounded"] as const).map((item) => {
							const active = shape === item;
							return (
								<button
									key={item}
									type="button"
									onClick={() => setShape(item)}
									aria-pressed={active}
									className={`min-h-8 rounded-md px-2.5 py-1.5 font-medium text-xs capitalize transition-colors sm:min-h-0 sm:py-1 ${
										active
											? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
											: "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
									}`}
								>
									{item}
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{/* Lens stage */}
			<GlassLensZoom
				ref={lensRef}
				src={subject.src}
				zoomSrc={subject.zoomSrc}
				alt={subject.alt}
				mode={mode}
				shape={shape}
				refraction={refraction}
				zoom={zoom}
				defaultZoom={2.2}
				onZoomChange={setZoom}
				defaultPosition={subject.initial}
				onPositionChange={setPosition}
				lensSize={164}
				showZoomBadge
			/>

			{/* Bottom optical controls & telemetry */}
			<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800/80 dark:bg-zinc-900/60">
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="mr-0.5 font-medium text-[11px] text-zinc-500 dark:text-zinc-400">
						Zoom
					</span>
					{ZOOM_PRESETS.map((preset) => {
						const active = Math.abs(zoom - preset) < 0.05;
						return (
							<button
								key={preset}
								type="button"
								onClick={() => setZoom(preset)}
								aria-pressed={active}
								className={`min-h-8 rounded-md px-2.5 py-1 font-medium text-xs tabular-nums transition-colors sm:min-h-0 sm:px-2 sm:py-0.5 ${
									active
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
										: "text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
								}`}
							>
								{preset.toFixed(1)}×
							</button>
						);
					})}

					<button
						type="button"
						onClick={() =>
							setRefraction((prev) => (prev === "auto" ? "off" : "auto"))
						}
						aria-pressed={refraction === "auto"}
						className={`ml-1 min-h-8 rounded-md border px-2.5 py-1 font-medium text-xs transition-colors sm:min-h-0 sm:px-2 sm:py-0.5 ${
							refraction === "auto"
								? "border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
								: "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
						}`}
					>
						Refraction {refraction === "auto" ? "On" : "Off"}
					</button>
				</div>

				<div className="flex items-center gap-2.5 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
					<span>
						{Math.round(position.x * 100)}%, {Math.round(position.y * 100)}%
					</span>
					<button
						type="button"
						onClick={handleReset}
						aria-label="Reset lens position and zoom"
						className="inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 py-1 font-medium text-zinc-600 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 sm:min-h-0 sm:px-2 sm:py-0.5 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
					>
						<RotateCcwIcon className="size-3" />
						Reset
					</button>
				</div>
			</div>
		</div>
	);
}
