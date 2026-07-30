"use client";

import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const TAU = Math.PI * 2;
const MAX_SIZE = 0.9;
const SPEED = 0.02;
const ALPHA_STEPS = 6;

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

function smoothstep(value: number, edge0: number, edge1: number) {
	const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
	return t * t * (3 - 2 * t);
}

function hash(x: number, y: number) {
	const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
	return value - Math.floor(value);
}

class TileFieldEngine {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private host: HTMLElement;
	private color: string;
	private reducedMotion: boolean;
	private restColor = "gray";
	private word: string;

	private dpr = Math.min(2, window.devicePixelRatio || 1);
	private viewW = 0;
	private viewH = 0;
	private cell = 10;
	private time = 0;

	private n = 0;
	private px = new Float32Array(0);
	private py = new Float32Array(0);
	private drawX = new Float32Array(0);
	private drawY = new Float32Array(0);
	private spark = new Uint8Array(0);
	private lit = new Float32Array(0);
	private seed = new Float32Array(0);

	private hasPointer = false;
	private rawX = 0;
	private rawY = 0;
	private lightX = 0;
	private lightY = 0;
	private lightSpeed = 0;
	private raf = 0;

	constructor(host: HTMLElement, word: string, color: string) {
		this.host = host;
		this.word = word;
		this.color = color;
		this.canvas = document.createElement("canvas");
		this.canvas.className =
			"pointer-events-none absolute inset-0 block size-full";
		this.canvas.setAttribute("aria-hidden", "true");
		this.ctx = this.canvas.getContext("2d")!;
		this.host.appendChild(this.canvas);
		this.reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		this.resize();
		this.host.addEventListener("pointermove", this.onMove, { passive: true });
		this.host.addEventListener("pointerleave", this.onLeave);
	}

	resize() {
		const rect = this.host.getBoundingClientRect();
		this.viewW = rect.width;
		this.viewH = rect.height;
		this.dpr = Math.min(2, window.devicePixelRatio || 1);
		this.cell = Math.max(2, Math.round(this.viewW / 460));

		this.canvas.style.width = `${Math.round(this.viewW)}px`;
		this.canvas.style.height = `${Math.round(this.viewH)}px`;
		this.canvas.width = Math.ceil(this.viewW * this.dpr);
		this.canvas.height = Math.ceil(this.viewH * this.dpr);
		this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		this.ctx.imageSmoothingEnabled = false;
		this.updateTheme();

		const source = document.createElement("canvas");
		source.width = Math.max(1, Math.floor(this.viewW));
		source.height = Math.max(1, Math.floor(this.viewH));
		const sourceCtx = source.getContext("2d")!;
		const spacedCtx = sourceCtx as CanvasRenderingContext2D & {
			letterSpacing?: string;
		};
		sourceCtx.fillStyle = "#000";
		sourceCtx.textAlign = "center";
		sourceCtx.textBaseline = "middle";

		let fontSize = this.viewH * 0.9;
		spacedCtx.letterSpacing = `${-0.02 * fontSize}px`;
		sourceCtx.font = `600 ${fontSize}px ui-sans-serif, system-ui, Arial, sans-serif`;
		const measuredWidth = sourceCtx.measureText(this.word).width || 1;
		fontSize *= (this.viewW * 0.92) / measuredWidth;
		spacedCtx.letterSpacing = `${-0.02 * fontSize}px`;
		sourceCtx.font = `600 ${fontSize}px ui-sans-serif, system-ui, Arial, sans-serif`;
		sourceCtx.fillText(this.word, this.viewW / 2, this.viewH / 2);

		const data = sourceCtx.getImageData(0, 0, source.width, source.height).data;
		const xs: number[] = [];
		const ys: number[] = [];
		const sparks: number[] = [];
		const seeds: number[] = [];
		const columns = Math.ceil(this.viewW / this.cell);
		const rows = Math.ceil(this.viewH / this.cell);

		for (let row = 0; row < rows; row++) {
			for (let column = 0; column < columns; column++) {
				const x = Math.floor(column * this.cell + this.cell / 2);
				const y = Math.floor(row * this.cell + this.cell / 2);
				if (x >= source.width || y >= source.height) continue;

				const alpha = (data[(y * source.width + x) * 4 + 3] ?? 0) / 255;
				if (alpha <= 0.5) continue;

				xs.push(x);
				ys.push(y);
				sparks.push(hash(x + 7, y - 3) > 0.82 ? 1 : 0);
				seeds.push(hash(x * 1.3, y * 0.7));
			}
		}

		this.n = xs.length;
		this.px = new Float32Array(xs);
		this.py = new Float32Array(ys);
		this.drawX = new Float32Array(xs);
		this.drawY = new Float32Array(ys);
		this.spark = new Uint8Array(sparks);
		this.seed = new Float32Array(seeds);
		this.lit = new Float32Array(this.n);

		if (this.reducedMotion) this.renderStatic();
	}

	private distSegSq(
		qx: number,
		qy: number,
		ax: number,
		ay: number,
		bx: number,
		by: number,
	) {
		const dx = bx - ax;
		const dy = by - ay;
		if (dx === 0 && dy === 0) {
			const ex = qx - ax;
			const ey = qy - ay;
			return ex * ex + ey * ey;
		}

		const t = clamp(
			((qx - ax) * dx + (qy - ay) * dy) / (dx * dx + dy * dy),
			0,
			1,
		);
		const ex = qx - (ax + dx * t);
		const ey = qy - (ay + dy * t);
		return ex * ex + ey * ey;
	}

	private frame = (timestamp: number) => {
		const { viewW, viewH, cell, n, px, py } = this;
		const drawX = this.drawX;
		const drawY = this.drawY;
		const spark = this.spark;
		const lit = this.lit;
		const seed = this.seed;
		this.ctx.clearRect(0, 0, viewW, viewH);
		this.time += SPEED;
		const time = this.time;

		const previousX = this.lightX;
		const previousY = this.lightY;
		if (this.hasPointer) {
			this.lightX += (this.rawX - this.lightX) * 0.5;
			this.lightY += (this.rawY - this.lightY) * 0.5;
		}

		const lightX = this.lightX;
		const lightY = this.lightY;
		const stepDistance = Math.hypot(lightX - previousX, lightY - previousY);
		this.lightSpeed = 0.9 * this.lightSpeed + 0.1 * stepDistance;

		const reach = clamp(
			viewH * 0.22 + this.lightSpeed * 0.9,
			viewH * 0.18,
			viewH * 0.42,
		);
		const influence = 1.5 * reach;
		const influenceSq = influence * influence;
		const minX = Math.min(previousX, lightX) - influence;
		const maxX = Math.max(previousX, lightX) + influence;
		const minY = Math.min(previousY, lightY) - influence;
		const maxY = Math.max(previousY, lightY) + influence;

		const grayPath = new Path2D();
		const litList: number[] = [];
		const buckets = Array.from({ length: ALPHA_STEPS }, () => new Path2D());

		for (let index = 0; index < n; index++) {
			const x = px[index];
			const y = py[index];
			let target = 0;

			if (this.hasPointer && x >= minX && x <= maxX && y >= minY && y <= maxY) {
				const distanceSq = this.distSegSq(
					x,
					y,
					previousX,
					previousY,
					lightX,
					lightY,
				);
				if (distanceSq <= influenceSq) {
					const angle = Math.atan2(y - lightY, x - lightX);
					const wobble =
						1 +
						0.3 * Math.sin(3 * angle + time * 1.6) +
						0.16 * Math.sin(5 * angle - time * 1.1 + 1.3);
					const amount = clamp(
						1 - Math.sqrt(distanceSq) / (reach * wobble),
						0,
						1,
					);
					target = amount * amount * (3 - 2 * amount);
				}
			}

			const rate = target > lit[index] ? 0.24 : 0.02;
			lit[index] += (target - lit[index]) * rate;

			const pointerX = x - lightX;
			const pointerY = y - lightY;
			const pointerDistance = Math.max(1, Math.hypot(pointerX, pointerY));
			const motion =
				lit[index] *
				cell *
				(0.65 + 0.2 * Math.sin(seed[index] * TAU + time * 2));
			const drift = lit[index] * cell * 0.18;
			const tileX =
				x +
				(pointerX / pointerDistance) * motion +
				Math.sin(seed[index] * TAU + time * 2.4) * drift;
			const tileY =
				y +
				(pointerY / pointerDistance) * motion +
				Math.cos(seed[index] * TAU - time * 2) * drift;
			drawX[index] = tileX;
			drawY[index] = tileY;

			const u = x / Math.max(viewW, 1);
			const v = y / Math.max(viewH, 1);
			const flow =
				Math.sin((u * 1.6 + 0.4 * Math.sin(time * 0.3)) * TAU + time * 0.8) +
				0.7 * Math.sin((v * 2.1 - u * 0.9) * TAU - time * 0.6 + 1.7) +
				0.5 * Math.sin((u * 3.3 + v * 2.7) * TAU + time * 0.4 + 4.2) +
				0.4 *
					Math.cos((v * 1.3 - 1.1 * Math.sin(time * 0.2)) * TAU - time * 0.5);
			let colorAmount = smoothstep(flow, 0.1, 1.6);
			colorAmount = Math.max(colorAmount, lit[index]);

			const breathe = 0.5 + 0.5 * Math.sin(seed[index] * TAU + time * 1.3);
			const base = 0.42 + 0.08 * breathe;
			const size = cell * (base + (MAX_SIZE - base) * colorAmount);
			const half = size / 2;
			grayPath.rect(tileX - half, tileY - half, size, size);

			if (colorAmount > 0.04) {
				const alphaStep = Math.min(
					ALPHA_STEPS - 1,
					Math.floor(colorAmount * ALPHA_STEPS),
				);
				buckets[alphaStep].rect(tileX - half, tileY - half, size, size);
			}

			if (lit[index] > 0.02) litList.push(index);
		}

		this.ctx.fillStyle = this.restColor;
		this.ctx.fill(grayPath);

		this.ctx.fillStyle = this.color;
		for (let alphaStep = 0; alphaStep < ALPHA_STEPS; alphaStep++) {
			this.ctx.globalAlpha = (alphaStep + 1) / ALPHA_STEPS;
			this.ctx.fill(buckets[alphaStep]);
		}
		this.ctx.globalAlpha = 1;

		for (const index of litList) {
			const light = lit[index];
			const x = drawX[index];
			const y = drawY[index];
			const glowSize = cell * (0.7 + (MAX_SIZE - 0.7) * light);
			const glowHalf = glowSize / 2;

			if (spark[index]) {
				const phase = seed[index];
				const sparkTime = 0.00025 * timestamp;
				const amplitude = (0.45 + phase) * cell * 0.28;
				const jitterX =
					x + Math.sin(0.05 * x + 1.3 * sparkTime + phase * TAU) * amplitude;
				const jitterY =
					y + Math.cos(0.04 * y - 0.9 * sparkTime + phase * TAU) * amplitude;
				this.ctx.globalAlpha = 0.1 * light;
				this.ctx.fillStyle = this.color;
				this.ctx.fillRect(
					jitterX - glowHalf * 1.5,
					jitterY - glowHalf * 1.5,
					glowSize * 1.5,
					glowSize * 1.5,
				);
				this.ctx.globalAlpha = 0.55 * light;
				this.ctx.fillRect(
					jitterX - glowHalf,
					jitterY - glowHalf,
					glowSize,
					glowSize,
				);
			} else {
				this.ctx.globalAlpha = 0.85 * light;
				this.ctx.fillStyle = this.color;
				this.ctx.fillRect(x - glowHalf, y - glowHalf, glowSize, glowSize);
			}
		}
		this.ctx.globalAlpha = 1;

		this.raf = requestAnimationFrame(this.frame);
	};

	renderStatic() {
		this.ctx.clearRect(0, 0, this.viewW, this.viewH);
		const path = new Path2D();
		for (let index = 0; index < this.n; index++) {
			const size = this.cell * 0.5;
			const half = size / 2;
			path.rect(this.px[index] - half, this.py[index] - half, size, size);
		}
		this.ctx.fillStyle = this.restColor;
		this.ctx.fill(path);
	}

	updateTheme() {
		this.restColor = getComputedStyle(this.host).color;
		if (this.reducedMotion) this.renderStatic();
	}

	setColor(color: string) {
		this.color = color;
	}

	setReducedMotion(reducedMotion: boolean) {
		this.reducedMotion = reducedMotion;
		if (reducedMotion) this.renderStatic();
	}

	private onMove = (event: PointerEvent) => {
		if (event.pointerType === "touch") return;

		const rect = this.host.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		if (!this.hasPointer) {
			this.hasPointer = true;
			this.lightX = x;
			this.lightY = y;
			this.lightSpeed = 0;
		}
		this.rawX = x;
		this.rawY = y;
	};

	private onLeave = () => {
		this.hasPointer = false;
	};

	start() {
		if (this.reducedMotion || this.raf) return;
		this.raf = requestAnimationFrame(this.frame);
	}

	stop() {
		if (this.raf) cancelAnimationFrame(this.raf);
		this.raf = 0;
	}

	destroy() {
		this.stop();
		this.host.removeEventListener("pointermove", this.onMove);
		this.host.removeEventListener("pointerleave", this.onLeave);
		this.canvas.remove();
	}
}

export interface TileFieldProps
	extends Omit<ComponentProps<"div">, "children" | "ref"> {
	/** Color used by the wave, pointer glow, and sparks. */
	color?: string;
	/** Text rendered into the tile grid. */
	word?: string;
}

export function TileField({
	"aria-label": ariaLabel,
	className,
	color = "#6366f1",
	word = "Localhost",
	...props
}: TileFieldProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const engineRef = useRef<TileFieldEngine>(null);
	const colorRef = useRef(color);
	colorRef.current = color;

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		const engine = new TileFieldEngine(host, word, colorRef.current);
		engineRef.current = engine;
		const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		let isInView = true;

		const syncAnimation = () => {
			engine.setReducedMotion(motionQuery.matches);
			if (isInView && !document.hidden && !motionQuery.matches) {
				engine.start();
			} else {
				engine.stop();
			}
		};
		const resizeObserver = new ResizeObserver(() => engine.resize());
		const themeObserver = new MutationObserver(() => engine.updateTheme());
		const intersectionObserver = new IntersectionObserver(([entry]) => {
			isInView = entry?.isIntersecting ?? true;
			syncAnimation();
		});

		resizeObserver.observe(host);
		themeObserver.observe(document.documentElement, {
			attributeFilter: ["class", "style"],
			attributes: true,
		});
		intersectionObserver.observe(host);
		document.addEventListener("visibilitychange", syncAnimation);
		motionQuery.addEventListener("change", syncAnimation);
		syncAnimation();

		return () => {
			resizeObserver.disconnect();
			themeObserver.disconnect();
			intersectionObserver.disconnect();
			document.removeEventListener("visibilitychange", syncAnimation);
			motionQuery.removeEventListener("change", syncAnimation);
			engine.destroy();
			engineRef.current = null;
		};
	}, [word]);

	useEffect(() => engineRef.current?.setColor(color), [color]);

	return (
		<div
			aria-label={ariaLabel ?? word}
			className={cn(
				"relative isolate min-h-48 w-full overflow-hidden text-muted-foreground",
				className,
			)}
			data-slot="tile-field"
			ref={hostRef}
			role="img"
			{...props}
		/>
	);
}

export default TileField;
