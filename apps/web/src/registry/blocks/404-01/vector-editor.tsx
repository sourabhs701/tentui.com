"use client";

import {
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";
import { serializePath } from "./parse";
import type { Anchor, Vec, VectorPath } from "./types";
import { add, sub, v } from "./types";

export type Mirror = "none" | "angle" | "angle-length";

/**
 * Colors accept any CSS color, including `var(--token)` and `color-mix()`.
 * Sizes are in screen pixels and stay constant however the canvas scales.
 */
export interface EditorStyle {
	accent: string;
	arm: string;
	anchorR: number;
	handleR: number;
	hitR: number;
	pointFill: string;
	fill: string;
	fillOpacity: number;
	stroke: string;
	strokeWidth: number;
	showRig: boolean;
	fillRule: "nonzero" | "evenodd";
}

export const DEFAULT_EDITOR: EditorStyle = {
	accent: "#0d99ff",
	arm: "color-mix(in oklab, #0d99ff 45%, var(--background))",
	anchorR: 4,
	handleR: 3.2,
	hitR: 12,
	pointFill: "var(--background)",
	fill: "#0d99ff",
	fillOpacity: 0.08,
	stroke: "#0d99ff",
	strokeWidth: 1.5,
	showRig: true,
	fillRule: "evenodd",
};

type Side = "in" | "out";

type Drag =
	| { kind: "anchor"; index: number; offset: Vec }
	| {
			kind: "handle";
			index: number;
			side: Side;
			mirror: Mirror;
			offset: Vec;
	  };

type PointKey = `a${number}` | `in${number}` | `out${number}`;

function arrowDelta(key: string, amount: number): Vec | null {
	switch (key) {
		case "ArrowLeft":
			return v(-amount, 0);
		case "ArrowRight":
			return v(amount, 0);
		case "ArrowUp":
			return v(0, -amount);
		case "ArrowDown":
			return v(0, amount);
		default:
			return null;
	}
}

/** Every editable point in reading order: anchor, then its handles. */
function pointKeys(path: VectorPath, showRig: boolean): PointKey[] {
	if (!showRig) return [];
	const keys: PointKey[] = [];
	path.anchors.forEach((anchor, index) => {
		if (anchor.in) keys.push(`in${index}`);
		keys.push(`a${index}`);
		if (anchor.out) keys.push(`out${index}`);
	});
	return keys;
}

const round = (value: number) => Math.round(value);

export function VectorEditor({
	path,
	onChange,
	style = DEFAULT_EDITOR,
	mirror = "angle-length",
	viewBox,
	width,
	height,
	className,
	ariaLabel = "Editable vector",
	ariaDescribedBy,
}: {
	path: VectorPath;
	onChange: (next: VectorPath) => void;
	style?: EditorStyle;
	mirror?: Mirror;
	viewBox: [number, number, number, number];
	width?: number;
	height?: number;
	className?: string;
	ariaLabel?: string;
	ariaDescribedBy?: string;
}) {
	const svgRef = useRef<SVGSVGElement>(null);
	const drag = useRef<Drag | null>(null);
	const pathRef = useRef(path);
	pathRef.current = path;
	const pending = useRef<Vec | null>(null);
	const animationFrame = useRef(0);
	const [active, setActive] = useState<PointKey | null>(null);
	const [dragging, setDragging] = useState(false);
	const [scale, setScale] = useState(1);

	// Keep points and hit areas a constant on-screen size as the canvas scales.
	useEffect(() => {
		const svg = svgRef.current;
		if (!svg) return;
		const update = () => {
			const rendered = svg.getBoundingClientRect().width;
			if (rendered > 0) setScale(rendered / viewBox[2]);
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(svg);
		return () => observer.disconnect();
	}, [viewBox[2]]);

	useEffect(
		() => () => {
			if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
		},
		[],
	);

	const unit = 1 / (scale || 1);
	const anchorR = style.anchorR * unit;
	const handleR = style.handleR * unit;
	const hitR = style.hitR * unit;

	const keys = pointKeys(path, style.showRig);
	const tabStop = active && keys.includes(active) ? active : keys[0];

	function toUser(event: { clientX: number; clientY: number }): Vec {
		const svg = svgRef.current;
		const matrix = svg?.getScreenCTM();
		if (!svg || !matrix) return v(0, 0);
		const point = svg.createSVGPoint();
		point.x = event.clientX;
		point.y = event.clientY;
		const transformed = point.matrixTransform(matrix.inverse());
		return v(transformed.x, transformed.y);
	}

	function beginDrag(event: ReactPointerEvent, next: Drag, key: PointKey) {
		event.stopPropagation();
		event.preventDefault();
		const target = event.currentTarget as SVGGElement;
		target.setPointerCapture(event.pointerId);
		target.focus({ preventScroll: true });
		drag.current = next;
		setActive(key);
		setDragging(true);
	}

	function startAnchor(event: ReactPointerEvent, index: number) {
		if (drag.current || event.button !== 0) return;
		const position = pathRef.current.anchors[index].p;
		beginDrag(
			event,
			{ kind: "anchor", index, offset: sub(position, toUser(event)) },
			`a${index}`,
		);
	}

	function startHandle(event: ReactPointerEvent, index: number, side: Side) {
		if (drag.current || event.button !== 0) return;
		const position = pathRef.current.anchors[index][side];
		if (!position) return;
		beginDrag(
			event,
			{
				kind: "handle",
				index,
				side,
				mirror: event.altKey ? "none" : mirror,
				offset: sub(position, toUser(event)),
			},
			`${side}${index}`,
		);
	}

	function applyDrag(activeDrag: Drag, pointer: Vec): VectorPath {
		const anchors = pathRef.current.anchors.map((anchor) => ({
			p: { ...anchor.p },
			in: anchor.in ? { ...anchor.in } : null,
			out: anchor.out ? { ...anchor.out } : null,
		})) as Anchor[];
		const target = add(pointer, activeDrag.offset);
		const anchor = anchors[activeDrag.index];

		if (activeDrag.kind === "anchor") {
			const delta = sub(target, anchor.p);
			anchor.p = target;
			if (anchor.in) anchor.in = add(anchor.in, delta);
			if (anchor.out) anchor.out = add(anchor.out, delta);
		} else {
			anchor[activeDrag.side] = target;
			const other = activeDrag.side === "out" ? anchor.in : anchor.out;
			if (activeDrag.mirror !== "none" && other) {
				const relative = sub(target, anchor.p);
				const relativeLength = Math.hypot(relative.x, relative.y) || 1;
				const length =
					activeDrag.mirror === "angle-length"
						? relativeLength
						: Math.hypot(other.x - anchor.p.x, other.y - anchor.p.y);
				const opposite = {
					x: anchor.p.x - (relative.x / relativeLength) * length,
					y: anchor.p.y - (relative.y / relativeLength) * length,
				};
				if (activeDrag.side === "out") anchor.in = opposite;
				else anchor.out = opposite;
			}
		}

		return {
			anchors,
			starts: pathRef.current.starts,
			closed: pathRef.current.closed,
		};
	}

	function commit(next: VectorPath) {
		pathRef.current = next;
		onChange(next);
	}

	function onMove(event: ReactPointerEvent) {
		if (!drag.current) return;
		pending.current = toUser(event);
		if (animationFrame.current) return;
		animationFrame.current = requestAnimationFrame(() => {
			animationFrame.current = 0;
			if (drag.current && pending.current) {
				commit(applyDrag(drag.current, pending.current));
			}
		});
	}

	function endDrag(event: ReactPointerEvent) {
		if (!drag.current) return;
		if (animationFrame.current) {
			cancelAnimationFrame(animationFrame.current);
			animationFrame.current = 0;
			if (pending.current) commit(applyDrag(drag.current, pending.current));
		}
		try {
			(event.target as Element).releasePointerCapture(event.pointerId);
		} catch {
			// Pointer capture may already be released by the browser.
		}
		drag.current = null;
		pending.current = null;
		setDragging(false);
	}

	function focusPoint(key: PointKey) {
		setActive(key);
		svgRef.current
			?.querySelector<SVGGElement>(`[data-point="${key}"]`)
			?.focus({ preventScroll: true });
	}

	function onPointKeyDown(
		event: ReactKeyboardEvent,
		key: PointKey,
		activeDrag: Drag,
		position: Vec,
	) {
		if (event.key === "]" || event.key === "[") {
			event.preventDefault();
			const index = keys.indexOf(key);
			const step = event.key === "]" ? 1 : -1;
			focusPoint(keys[(index + step + keys.length) % keys.length]);
			return;
		}
		if (event.key === "Escape") {
			(event.currentTarget as SVGGElement).blur();
			return;
		}
		const delta = arrowDelta(event.key, event.shiftKey ? 10 : 1);
		if (!delta) return;
		event.preventDefault();
		commit(applyDrag({ ...activeDrag, offset: v(0, 0) }, add(position, delta)));
	}

	const d = serializePath(path);
	const arms: {
		key: string;
		ax: number;
		ay: number;
		hx: number;
		hy: number;
	}[] = [];
	if (style.showRig) {
		path.anchors.forEach((anchor, index) => {
			for (const side of ["in", "out"] as const) {
				const handle = anchor[side];
				if (!handle) continue;
				arms.push({
					key: `${side}${index}`,
					ax: anchor.p.x,
					ay: anchor.p.y,
					hx: handle.x,
					hy: handle.y,
				});
			}
		});
	}

	const pointProps = (key: PointKey) => ({
		point: key,
		active: active === key,
		tabIndex: key === tabStop ? 0 : -1,
		onFocus: () => setActive(key),
		hitR,
		accent: style.accent,
		fill: style.pointFill,
	});

	return (
		<svg
			ref={svgRef}
			role="group"
			aria-roledescription="vector editor"
			aria-label={ariaLabel}
			aria-describedby={ariaDescribedBy}
			viewBox={viewBox.join(" ")}
			width={width ?? viewBox[2]}
			height={height ?? viewBox[3]}
			className={cn(
				"block select-none overflow-visible",
				dragging && "cursor-grabbing",
				className,
			)}
			onPointerMove={onMove}
			onPointerUp={endDrag}
			onPointerCancel={endDrag}
			onLostPointerCapture={endDrag}
		>
			<path
				d={d}
				fillRule={style.fillRule}
				vectorEffect="non-scaling-stroke"
				style={{
					fill: style.fill,
					fillOpacity: style.fillOpacity,
					stroke: style.stroke,
					strokeWidth: style.strokeWidth,
				}}
			/>

			{style.showRig ? (
				<g>
					<g
						style={{
							stroke: style.arm,
							strokeWidth: Math.max(0.75, style.strokeWidth * 0.75),
						}}
					>
						{arms.map((arm) => (
							<line
								key={arm.key}
								x1={arm.ax}
								y1={arm.ay}
								x2={arm.hx}
								y2={arm.hy}
								vectorEffect="non-scaling-stroke"
							/>
						))}
					</g>

					{path.anchors.map((anchor, index) =>
						(["in", "out"] as const).map((side) => {
							const handle = anchor[side];
							if (!handle) return null;
							const key: PointKey = `${side}${index}`;
							return (
								<Point
									key={key}
									{...pointProps(key)}
									shape="diamond"
									cx={handle.x}
									cy={handle.y}
									r={handleR}
									label={`${side === "in" ? "Incoming" : "Outgoing"} handle of anchor ${index + 1}, at ${round(handle.x)}, ${round(handle.y)}`}
									onPointerDown={(event) => startHandle(event, index, side)}
									onKeyDown={(event) =>
										onPointKeyDown(
											event,
											key,
											{
												kind: "handle",
												index,
												side,
												mirror: event.altKey ? "none" : mirror,
												offset: v(0, 0),
											},
											handle,
										)
									}
								/>
							);
						}),
					)}

					{path.anchors.map((anchor, index) => {
						const key: PointKey = `a${index}`;
						return (
							<Point
								key={key}
								{...pointProps(key)}
								shape="circle"
								cx={anchor.p.x}
								cy={anchor.p.y}
								r={anchorR}
								label={`Anchor ${index + 1} of ${path.anchors.length}, at ${round(anchor.p.x)}, ${round(anchor.p.y)}`}
								onPointerDown={(event) => startAnchor(event, index)}
								onKeyDown={(event) =>
									onPointKeyDown(
										event,
										key,
										{ kind: "anchor", index, offset: v(0, 0) },
										anchor.p,
									)
								}
							/>
						);
					})}
				</g>
			) : null}
		</svg>
	);
}

function Point({
	shape,
	point,
	cx,
	cy,
	r,
	hitR,
	accent,
	fill,
	active,
	tabIndex,
	label,
	onFocus,
	onPointerDown,
	onKeyDown,
}: {
	shape: "circle" | "diamond";
	point: PointKey;
	cx: number;
	cy: number;
	r: number;
	hitR: number;
	accent: string;
	fill: string;
	active: boolean;
	tabIndex: number;
	label: string;
	onFocus: () => void;
	onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
	onKeyDown: (event: ReactKeyboardEvent<SVGGElement>) => void;
}) {
	const visual = {
		fill: active ? accent : fill,
		stroke: accent,
		strokeWidth: 1.25,
	};

	return (
		<g
			role="button"
			aria-roledescription="draggable point"
			aria-label={label}
			data-point={point}
			tabIndex={tabIndex}
			className="group cursor-grab touch-none outline-none"
			onFocus={onFocus}
			onPointerDown={onPointerDown}
			onKeyDown={onKeyDown}
		>
			<circle cx={cx} cy={cy} r={hitR} fill="transparent" />
			<circle
				cx={cx}
				cy={cy}
				r={r * 2}
				fill="none"
				vectorEffect="non-scaling-stroke"
				style={{ stroke: accent, strokeWidth: 1.5 }}
				className="opacity-0 transition-opacity duration-150 group-hover:opacity-40 group-focus-visible:opacity-100 motion-reduce:transition-none"
			/>
			{shape === "circle" ? (
				<circle
					cx={cx}
					cy={cy}
					r={r}
					vectorEffect="non-scaling-stroke"
					style={visual}
				/>
			) : (
				<rect
					x={cx - r}
					y={cy - r}
					width={r * 2}
					height={r * 2}
					vectorEffect="non-scaling-stroke"
					style={{
						...visual,
						transform: "rotate(45deg)",
						transformBox: "fill-box",
						transformOrigin: "50% 50%",
					}}
				/>
			)}
		</g>
	);
}
