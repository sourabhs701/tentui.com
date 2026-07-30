"use client";

import { type ComponentProps, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import { EmbossEngine, type EmbossOptions } from "./realistic-emboss-engine";

export interface RealisticEmbossProps
	extends Omit<ComponentProps<"div">, "children"> {
	/** Text to press when no SVG is provided. */
	text?: string;
	/** Raw SVG markup. SVG content takes precedence over text. */
	svg?: string | null;
	/** CSS color used for the plaster surface. */
	color?: string;
	depth?: number;
	size?: number;
	soften?: number;
	lightAngle?: number;
	lightAltitude?: number;
	highlight?: number;
	shadow?: number;
	grain?: number;
	brightness?: number;
	/** Content height as a fraction of the surface height. */
	contentScale?: number;
	/** Content center as normalized x/y coordinates. */
	contentPosition?: readonly [number, number];
	fontFamily?: string;
}

export function RealisticEmboss({
	text = "emboss",
	svg = null,
	color = "#c7b8a1",
	depth = 1.15,
	size = 2.5,
	soften = 0.7,
	lightAngle = 315,
	lightAltitude = 28,
	highlight = 0.24,
	shadow = 0.32,
	grain = 0.55,
	brightness = 1,
	contentScale = 0.38,
	contentPosition = [0.5, 0.5],
	fontFamily = "ui-sans-serif, system-ui, sans-serif",
	className,
	style,
	"aria-label": ariaLabel,
	...props
}: RealisticEmbossProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const engineRef = useRef<EmbossEngine | null>(null);
	const optionsRef = useRef<EmbossOptions | null>(null);
	const positionX = contentPosition[0];
	const positionY = contentPosition[1];
	optionsRef.current = {
		text,
		svg,
		color,
		depth,
		size,
		soften,
		lightAngle,
		lightAltitude,
		highlight,
		shadow,
		grain,
		brightness,
		contentScale,
		contentPosition: [positionX, positionY],
		fontFamily,
	};

	useEffect(() => {
		const host = hostRef.current;
		const initialOptions = optionsRef.current;
		if (!host || !initialOptions) return;

		try {
			const engine = new EmbossEngine(host, initialOptions);
			engineRef.current = engine;
			const observer = new ResizeObserver(() => engine.resize());
			observer.observe(host);

			return () => {
				observer.disconnect();
				engine.destroy();
				engineRef.current = null;
			};
		} catch (error) {
			host.dataset.embossFallback =
				error instanceof Error ? error.message : "WebGL is unavailable";
			return;
		}
	}, []);

	useEffect(() => {
		engineRef.current?.setOptions({
			text,
			svg,
			color,
			depth,
			size,
			soften,
			lightAngle,
			lightAltitude,
			highlight,
			shadow,
			grain,
			brightness,
			contentScale,
			contentPosition: [positionX, positionY],
			fontFamily,
		});
	}, [
		text,
		svg,
		color,
		depth,
		size,
		soften,
		lightAngle,
		lightAltitude,
		highlight,
		shadow,
		grain,
		brightness,
		contentScale,
		positionX,
		positionY,
		fontFamily,
	]);

	const accessibilityProps = ariaLabel
		? { "aria-label": ariaLabel, role: "img" as const }
		: { "aria-hidden": true as const };

	return (
		<div
			{...accessibilityProps}
			className={cn("relative isolate overflow-hidden", className)}
			data-slot="realistic-emboss"
			ref={hostRef}
			style={{ backgroundColor: color, ...style }}
			{...props}
		/>
	);
}
