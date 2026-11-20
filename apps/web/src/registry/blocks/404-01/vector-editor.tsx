"use client";

import {
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useRef,
} from "react";

import { serializePath } from "./parse";
import type { Anchor, Vec, VectorPath } from "./types";
import { add, sub, v } from "./types";

export type Mirror = "none" | "angle" | "angle-length";

export interface EditorStyle {
	accent: string;
	arm: string;
	anchorR: number;
	handleR: number;
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
	arm: "#9bb7d4",
	anchorR: 4,
	handleR: 3.2,
	pointFill: "var(--background)",
	fill: "#0d99ff",
	fillOpacity: 0.08,
	stroke: "#0d99ff",
	strokeWidth: 1.5,
	showRig: true,
	fillRule: "evenodd",
};

type Drag =
	| { kind: "anchor"; index: number; offset: Vec }
	| {
			kind: "handle";
			index: number;
			side: "in" | "out";
			mirror: Mirror;
			offset: Vec;
	  };

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

	function startAnchor(event: ReactPointerEvent, index: number) {
		if (drag.current) return;
		event.stopPropagation();
		(event.currentTarget as Element).setPointerCapture(event.pointerId);
		const position = pathRef.current.anchors[index].p;
		drag.current = {
			kind: "anchor",
			index,
			offset: sub(position, toUser(event)),
		};
	}

	function startHandle(
		event: ReactPointerEvent,
		index: number,
		side: "in" | "out",
	) {
		if (drag.current) return;
		event.stopPropagation();
		(event.currentTarget as Element).setPointerCapture(event.pointerId);
		const anchor = pathRef.current.anchors[index];
		const position = anchor[side];
		if (!position) return;
		drag.current = {
			kind: "handle",
			index,
			side,
			mirror: event.altKey ? "none" : mirror,
			offset: sub(position, toUser(event)),
		};
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
	}

	function nudge(event: ReactKeyboardEvent, activeDrag: Drag, position: Vec) {
		const delta = arrowDelta(event.key, event.shiftKey ? 10 : 1);
		if (!delta) return;
		event.preventDefault();
		commit(applyDrag({ ...activeDrag, offset: v(0, 0) }, add(position, delta)));
	}

	const d = serializePath(path);
	const arms: { ax: number; ay: number; hx: number; hy: number }[] = [];
	if (style.showRig) {
		for (const anchor of path.anchors) {
			if (anchor.out) {
				arms.push({
					ax: anchor.p.x,
					ay: anchor.p.y,
					hx: anchor.out.x,
					hy: anchor.out.y,
				});
			}
			if (anchor.in) {
				arms.push({
					ax: anchor.p.x,
					ay: anchor.p.y,
					hx: anchor.in.x,
					hy: anchor.in.y,
				});
			}
		}
	}

	return (
		<svg
			ref={svgRef}
			role="application"
			aria-label={ariaLabel}
			aria-describedby={ariaDescribedBy}
			viewBox={viewBox.join(" ")}
			width={width ?? viewBox[2]}
			height={height ?? viewBox[3]}
			className={className}
			style={{
				display: "block",
				overflow: "visible",
				touchAction: "none",
				userSelect: "none",
			}}
			onPointerMove={onMove}
			onPointerUp={endDrag}
			onPointerCancel={endDrag}
		>
			<path
				d={d}
				fill={style.fill}
				fillRule={style.fillRule}
				fillOpacity={style.fillOpacity}
				stroke={style.stroke}
				strokeWidth={style.strokeWidth}
			/>

			{style.showRig ? (
				<g>
					<g
						stroke={style.arm}
						strokeWidth={Math.max(0.75, style.strokeWidth * 0.6)}
					>
						{arms.map((arm, index) => (
							<line
								key={`${arm.ax}-${arm.ay}-${arm.hx}-${arm.hy}-${index}`}
								x1={arm.ax}
								y1={arm.ay}
								x2={arm.hx}
								y2={arm.hy}
							/>
						))}
					</g>

					{path.anchors.map((anchor, index) => (
						<g key={`handles-${index}`}>
							{anchor.out ? (
								<Diamond
									cx={anchor.out.x}
									cy={anchor.out.y}
									r={style.handleR}
									fill={style.pointFill}
									stroke={style.accent}
									label={`Outgoing handle ${index + 1}. Use arrow keys to move.`}
									onPointerDown={(event) => startHandle(event, index, "out")}
									onKeyDown={(event) =>
										nudge(
											event,
											{
												kind: "handle",
												index,
												side: "out",
												mirror: event.altKey ? "none" : mirror,
												offset: v(0, 0),
											},
											anchor.out as Vec,
										)
									}
								/>
							) : null}
							{anchor.in ? (
								<Diamond
									cx={anchor.in.x}
									cy={anchor.in.y}
									r={style.handleR}
									fill={style.pointFill}
									stroke={style.accent}
									label={`Incoming handle ${index + 1}. Use arrow keys to move.`}
									onPointerDown={(event) => startHandle(event, index, "in")}
									onKeyDown={(event) =>
										nudge(
											event,
											{
												kind: "handle",
												index,
												side: "in",
												mirror: event.altKey ? "none" : mirror,
												offset: v(0, 0),
											},
											anchor.in as Vec,
										)
									}
								/>
							) : null}
						</g>
					))}

					{path.anchors.map((anchor, index) => (
						<g
							key={`anchor-${index}`}
							role="button"
							tabIndex={0}
							aria-label={`Anchor ${index + 1}. Use arrow keys to move.`}
							className="group outline-none"
							style={{ cursor: "grab" }}
							onPointerDown={(event) => startAnchor(event, index)}
							onKeyDown={(event) =>
								nudge(
									event,
									{ kind: "anchor", index, offset: v(0, 0) },
									anchor.p,
								)
							}
						>
							<circle
								cx={anchor.p.x}
								cy={anchor.p.y}
								r={style.anchorR * 3}
								fill="transparent"
							/>
							<circle
								cx={anchor.p.x}
								cy={anchor.p.y}
								r={style.anchorR * 1.8}
								fill="none"
								stroke={style.accent}
								strokeWidth={1}
								className="opacity-0 group-focus-visible:opacity-100"
							/>
							<circle
								cx={anchor.p.x}
								cy={anchor.p.y}
								r={style.anchorR}
								fill={style.pointFill}
								stroke={style.accent}
								strokeWidth={1.25}
							/>
						</g>
					))}
				</g>
			) : null}
		</svg>
	);
}

function Diamond({
	cx,
	cy,
	r,
	fill,
	stroke,
	label,
	onPointerDown,
	onKeyDown,
}: {
	cx: number;
	cy: number;
	r: number;
	fill: string;
	stroke: string;
	label: string;
	onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
	onKeyDown: (event: ReactKeyboardEvent<SVGGElement>) => void;
}) {
	return (
		<g
			role="button"
			tabIndex={0}
			aria-label={label}
			className="group outline-none"
			style={{ cursor: "grab" }}
			onPointerDown={onPointerDown}
			onKeyDown={onKeyDown}
		>
			<circle cx={cx} cy={cy} r={r * 3.5} fill="transparent" />
			<circle
				cx={cx}
				cy={cy}
				r={r * 1.8}
				fill="none"
				stroke={stroke}
				strokeWidth={1}
				className="opacity-0 group-focus-visible:opacity-100"
			/>
			<rect
				x={cx - r}
				y={cy - r}
				width={r * 2}
				height={r * 2}
				fill={fill}
				stroke={stroke}
				strokeWidth={1.1}
				style={{
					transform: "rotate(45deg)",
					transformBox: "fill-box",
					transformOrigin: "50% 50%",
				}}
			/>
		</g>
	);
}
