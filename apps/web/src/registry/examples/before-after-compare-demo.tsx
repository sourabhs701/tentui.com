"use client";

import { useState } from "react";

import { BeforeAfterCompare } from "@/registry/components/before-after-compare/before-after-compare";

const MOUNTAIN_PHOTO =
	"https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?auto=format&fit=crop&w=1200&h=750&q=85";

function ArchitectureComparison({ mode }: { mode: "wireframe" | "interface" }) {
	const isWire = mode === "wireframe";

	return (
		<div
			className={
				isWire
					? "flex size-full items-center justify-center bg-zinc-100 p-6 sm:p-10"
					: "flex size-full items-center justify-center bg-[#09090b] p-6 sm:p-10"
			}
			style={{
				backgroundImage: isWire
					? "radial-gradient(rgba(24,24,27,0.12) 1px, transparent 1px)"
					: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
				backgroundSize: "16px 16px",
			}}
		>
			<div
				className={
					isWire
						? "w-full max-w-[16rem] rounded-xl border border-zinc-400/70 border-dashed bg-white/80 p-3.5 text-zinc-500 sm:max-w-xs sm:p-4"
						: "w-full max-w-[16rem] rounded-xl border border-white/12 bg-zinc-900/95 p-3.5 text-zinc-100 shadow-xl sm:max-w-xs sm:p-4"
				}
			>
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<div
							className={
								isWire
									? "size-6 rounded-md border border-zinc-400/70 border-dashed bg-zinc-200/70"
									: "flex size-6 items-center justify-center rounded-md bg-blue-500/15 text-blue-400 ring-1 ring-blue-400/30"
							}
						>
							{!isWire ? (
								<span className="size-2 rounded-full bg-blue-400" />
							) : null}
						</div>
						<span
							className={
								isWire
									? "font-mono text-[11px] uppercase tracking-wider"
									: "font-medium text-xs tracking-tight"
							}
						>
							{isWire ? "HEADER_SLOT" : "Production Build"}
						</span>
					</div>
					<span
						className={
							isWire
								? "rounded border border-zinc-400/60 border-dashed px-1.5 py-0.5 font-mono text-[10px]"
								: "rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-[10px] text-emerald-400 ring-1 ring-emerald-500/25"
						}
					>
						{isWire ? "STATUS" : "Ready"}
					</span>
				</div>

				<div className="mt-3 space-y-2">
					<div
						className={
							isWire
								? "flex h-7 items-center justify-between rounded-md border border-zinc-400/60 border-dashed px-2.5 font-mono text-[10px]"
								: "flex h-7 items-center justify-between rounded-md bg-white/[0.04] px-2.5 text-xs ring-1 ring-white/8"
						}
					>
						<span>{isWire ? "ROW_01 · 32px" : "edge-gateway"}</span>
						<span
							className={isWire ? "" : "font-mono text-[11px] text-zinc-400"}
						>
							{isWire ? "VAL" : "12 ms"}
						</span>
					</div>
					<div
						className={
							isWire
								? "flex h-7 items-center justify-between rounded-md border border-zinc-400/60 border-dashed px-2.5 font-mono text-[10px]"
								: "flex h-7 items-center justify-between rounded-md bg-white/[0.04] px-2.5 text-xs ring-1 ring-white/8"
						}
					>
						<span>{isWire ? "ROW_02 · 32px" : "cache-layer"}</span>
						<span
							className={isWire ? "" : "font-mono text-[11px] text-zinc-400"}
						>
							{isWire ? "VAL" : "99.4%"}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function TokenSurface({ contrast }: { contrast: "soft" | "crisp" }) {
	const isSoft = contrast === "soft";

	return (
		<div
			className={
				isSoft
					? "flex size-full flex-col justify-center gap-3 bg-zinc-100 px-6 pt-10 pb-6 text-zinc-700 sm:px-10"
					: "flex size-full flex-col justify-center gap-3 bg-zinc-950 px-6 pt-10 pb-6 text-zinc-100 sm:px-10"
			}
		>
			<div className="grid grid-cols-3 gap-2.5">
				{[
					{ name: "Canvas", hex: isSoft ? "#F4F4F5" : "#09090B" },
					{ name: "Surface", hex: isSoft ? "#FFFFFF" : "#18181B" },
					{ name: "Accent", hex: isSoft ? "#3B82F6" : "#60A5FA" },
				].map((swatch) => (
					<div
						key={swatch.name}
						className={
							isSoft
								? "rounded-xl border border-black/8 bg-white p-2.5 sm:p-3"
								: "rounded-xl border border-white/10 bg-zinc-900 p-2.5 sm:p-3"
						}
					>
						<div
							className={
								isSoft
									? "h-7 w-full rounded-md border border-black/8 sm:h-9"
									: "h-7 w-full rounded-md border border-white/12 sm:h-9"
							}
							style={{ backgroundColor: swatch.hex }}
						/>
						<p className="mt-2 font-medium text-[11px] tracking-tight">
							{swatch.name}
						</p>
						<p
							className={
								isSoft
									? "font-mono text-[10px] text-zinc-500"
									: "font-mono text-[10px] text-zinc-400"
							}
						>
							{swatch.hex}
						</p>
					</div>
				))}
			</div>
		</div>
	);
}

function ShaderArtSurface({ variant }: { variant: "wire" | "lit" }) {
	const isWire = variant === "wire";

	return (
		<div
			className={
				isWire
					? "flex size-full items-center justify-center bg-zinc-950"
					: "flex size-full items-center justify-center bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-950"
			}
		>
			<svg
				viewBox="0 0 480 300"
				aria-hidden="true"
				className="size-full"
				preserveAspectRatio="xMidYMid slice"
			>
				<defs>
					<radialGradient id="orb-glow" cx="42%" cy="38%" r="55%">
						<stop offset="0%" stopColor="#93c5fd" />
						<stop offset="55%" stopColor="#2563eb" />
						<stop offset="100%" stopColor="#0f172a" />
					</radialGradient>
				</defs>
				{isWire ? (
					<g stroke="rgba(255,255,255,0.28)" strokeWidth="1" fill="none">
						<circle cx="240" cy="150" r="82" />
						<ellipse cx="240" cy="150" rx="82" ry="30" />
						<ellipse cx="240" cy="150" rx="82" ry="60" />
						<ellipse cx="240" cy="150" rx="32" ry="82" />
						<ellipse cx="240" cy="150" rx="64" ry="82" />
						<line x1="120" y1="150" x2="360" y2="150" strokeDasharray="4 4" />
						<line x1="240" y1="45" x2="240" y2="255" strokeDasharray="4 4" />
					</g>
				) : (
					<g>
						<circle cx="240" cy="150" r="82" fill="url(#orb-glow)" />
						<circle
							cx="240"
							cy="150"
							r="82"
							fill="none"
							stroke="rgba(191,219,254,0.45)"
							strokeWidth="1.25"
						/>
						<ellipse
							cx="216"
							cy="118"
							rx="24"
							ry="13"
							transform="rotate(-24 216 118)"
							fill="rgba(255,255,255,0.28)"
						/>
					</g>
				)}
			</svg>
		</div>
	);
}

const PRESETS = [0, 25, 50, 75, 100] as const;

export default function BeforeAfterCompareDemo() {
	const [position, setPosition] = useState(35);

	return (
		<div className="flex w-full max-w-2xl flex-col gap-10 px-4 py-6">
			<section className="flex flex-col gap-3">
				<h3 className="font-medium text-muted-foreground text-sm">
					Photo grading
				</h3>
				<BeforeAfterCompare
					aria-label="Compare monochrome original and color-graded landscape"
					beforeLabel="Original"
					afterLabel="Graded"
					className="aspect-4/3 sm:aspect-16/10"
					before={
						<img
							src={MOUNTAIN_PHOTO}
							alt="Mountain ridge before color grading"
							className="brightness-[0.98] contrast-[0.88] grayscale"
						/>
					}
					after={
						<img
							src={MOUNTAIN_PHOTO}
							alt="Mountain ridge after color grading"
							className="contrast-[1.06] saturate-[1.15]"
						/>
					}
				/>
			</section>

			<section className="flex flex-col gap-3">
				<h3 className="font-medium text-muted-foreground text-sm">
					Vertical split
				</h3>
				<BeforeAfterCompare
					aria-label="Compare wireframe specification and rendered interface vertically"
					orientation="vertical"
					beforeLabel="Wireframe"
					afterLabel="Interface"
					defaultValue={48}
					className="aspect-4/3 sm:aspect-16/10"
					before={<ArchitectureComparison mode="wireframe" />}
					after={<ArchitectureComparison mode="interface" />}
				/>
			</section>

			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="font-medium text-muted-foreground text-sm">
						Controlled with presets
					</h3>
					<div className="flex flex-wrap items-center gap-1.5">
						<span className="mr-1 font-mono text-muted-foreground text-xs tabular-nums">
							{position}%
						</span>
						{PRESETS.map((preset) => (
							<button
								key={preset}
								type="button"
								onClick={() => setPosition(preset)}
								aria-pressed={position === preset}
								className={
									position === preset
										? "h-6 cursor-pointer rounded-md bg-foreground px-2 font-mono text-[11px] text-background tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
										: "h-6 cursor-pointer rounded-md border bg-background px-2 font-mono text-[11px] text-muted-foreground tabular-nums outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
								}
							>
								{preset}%
							</button>
						))}
					</div>
				</div>
				<BeforeAfterCompare
					aria-label="Compare light and dark surface tokens"
					value={position}
					onValueChange={setPosition}
					beforeLabel="Light tokens"
					afterLabel="Dark tokens"
					className="aspect-4/3 sm:aspect-16/10"
					before={<TokenSurface contrast="soft" />}
					after={<TokenSurface contrast="crisp" />}
				/>
			</section>

			<section className="flex flex-col gap-3">
				<h3 className="font-medium text-muted-foreground text-sm">
					Custom handle
				</h3>
				<BeforeAfterCompare
					aria-label="Compare wireframe sphere mesh and shaded render"
					beforeLabel="Mesh"
					afterLabel="Shaded"
					defaultValue={50}
					className="aspect-4/3 sm:aspect-16/10"
					before={<ShaderArtSurface variant="wire" />}
					after={<ShaderArtSurface variant="lit" />}
					handle={({ position: pct, isDragging }) => (
						<span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-zinc-950/90 px-2.5 font-medium font-mono text-[11px] text-white tabular-nums shadow-lg ring-1 ring-white/25 backdrop-blur-md">
							{isDragging ? `${pct}%` : "‹ ›"}
						</span>
					)}
				/>
			</section>
		</div>
	);
}
