"use client";

import * as React from "react";
import {
	ComposableMap,
	Geographies,
	Geography,
	ZoomableGroup,
} from "react-simple-maps";

import { cn } from "@/lib/utils";

import worldGeoData from "./world-map.geo.json";

export interface GeoFeature {
	rsmKey: string;
	properties: {
		name: string;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

export interface WorldMapProps
	extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
	/** Names of selected countries (matched against `geo.properties.name`). */
	selectedCountries: Set<string>;
	/** Fired when any country path is clicked. Ignored when `static` is true. */
	onCountryClick?: (geo: GeoFeature) => void;
	/**
	 * If true, render a non-interactive map: zoom and pan are disabled, the
	 * hover tooltip is suppressed, and clicks are ignored. Useful for read-only
	 * dashboards where the map is just a visualization.
	 */
	static?: boolean;
	/**
	 * User counts per country, keyed by country name (must match
	 * `geo.properties.name`). When set, hovering a country with an entry shows
	 * the formatted count beneath the country name in the tooltip.
	 */
	userCounts?: Record<string, number>;
}

export function WorldMap({
	selectedCountries,
	onCountryClick,
	static: isStatic = false,
	userCounts,
	className,
	...props
}: WorldMapProps) {
	const [tooltipContent, setTooltipContent] = React.useState("");
	const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });

	const hoveredCount =
		(userCounts && tooltipContent && userCounts[tooltipContent]) ?? 0;

	const renderGeographies = () => (
		<Geographies geography={worldGeoData}>
			{({ geographies }: { geographies: GeoFeature[] }) =>
				geographies.map((geo) => {
					const countryName = geo.properties.name;
					const isSelected = selectedCountries.has(countryName);

					const defaultStyle = {
						fill: isSelected ? "var(--primary)" : "var(--muted)",
						stroke: "var(--background)",
						strokeWidth: 0.5,
						outline: "none",
						transition: "fill 250ms",
					};

					const interactiveStyle = {
						default: defaultStyle,
						hover: {
							fill: "var(--primary)",
							stroke: "var(--background)",
							strokeWidth: 0.5,
							outline: "none",
							cursor: "pointer",
							transition: "fill 250ms",
						},
						pressed: {
							fill: "var(--primary)",
							stroke: "var(--background)",
							strokeWidth: 0.5,
							outline: "none",
						},
					};

					// In static mode every state collapses to the default — no hover
					// shimmer, no pressed state, no pointer cursor.
					const staticStyle = {
						default: defaultStyle,
						hover: defaultStyle,
						pressed: defaultStyle,
					};

					const interactiveHandlers = isStatic
						? {}
						: {
								onClick: () => onCountryClick?.(geo),
								onMouseEnter: (e: React.MouseEvent<SVGPathElement>) => {
									setTooltipContent(countryName);
									setTooltipPos({ x: e.clientX, y: e.clientY });
								},
								onMouseLeave: () => setTooltipContent(""),
								onMouseMove: (e: React.MouseEvent<SVGPathElement>) => {
									setTooltipPos({ x: e.clientX, y: e.clientY });
								},
							};

					return (
						<Geography
							key={geo.rsmKey}
							geography={geo}
							style={isStatic ? staticStyle : interactiveStyle}
							{...interactiveHandlers}
						/>
					);
				})
			}
		</Geographies>
	);

	return (
		<div
			data-slot="world-map"
			data-static={isStatic ? "" : undefined}
			className={cn("relative h-full w-full", className)}
			{...props}
		>
			<ComposableMap
				projectionConfig={{ scale: 140, center: [0, 0] }}
				width={800}
				height={450}
				style={{ width: "100%", height: "100%" }}
			>
				{isStatic ? (
					renderGeographies()
				) : (
					<ZoomableGroup zoom={1}>{renderGeographies()}</ZoomableGroup>
				)}
			</ComposableMap>

			{!isStatic && tooltipContent && (
				<div
					data-slot="world-map-tooltip"
					role="tooltip"
					className={cn(
						"pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full",
						"-mt-2.5 rounded-md bg-popover px-3 py-1.5 shadow-lg",
						"text-popover-foreground",
					)}
					style={{ left: tooltipPos.x, top: tooltipPos.y }}
				>
					<div className="font-medium text-sm leading-tight">
						{tooltipContent}
					</div>
					<div className="mt-0.5 text-xs tabular-nums opacity-80">
						{hoveredCount.toLocaleString()} users
					</div>
					<span
						aria-hidden
						className={cn(
							"absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full",
							"h-0 w-0 border-x-[6px] border-x-transparent border-t-[6px]",
							"border-t-popover",
						)}
					/>
				</div>
			)}
		</div>
	);
}
