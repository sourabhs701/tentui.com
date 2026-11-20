"use client";

import { BeforeAfterCompare } from "@/registry/components/before-after-compare/before-after-compare";

function WorkspaceSurface({ theme }: { theme: "light" | "dark" }) {
	const isDark = theme === "dark";

	return (
		<div
			className={
				isDark
					? "flex size-full flex-col justify-between bg-[#09090b] text-zinc-100"
					: "flex size-full flex-col justify-between bg-[#fafafa] text-zinc-900"
			}
		>
			<div
				className={
					isDark
						? "flex h-11 shrink-0 items-center justify-center border-white/8 border-b px-4"
						: "flex h-11 shrink-0 items-center justify-center border-black/8 border-b px-4"
				}
			>
				<div className="flex items-center gap-1.5 font-mono text-[11px] tracking-tight">
					<span className="size-1.5 rounded-full bg-emerald-500" />
					<span className={isDark ? "text-zinc-300" : "text-zinc-700"}>
						edge-api
					</span>
					<span className={isDark ? "text-zinc-600" : "text-zinc-400"}>/</span>
					<span className={isDark ? "text-zinc-500" : "text-zinc-500"}>
						prod
					</span>
				</div>
			</div>

			<div className="flex flex-1 flex-col justify-between gap-3 p-3.5 sm:gap-4 sm:p-5">
				<div className="grid grid-cols-3 gap-2 sm:gap-3">
					{[
						{ label: "P95 Latency", value: "18 ms", delta: "-4 ms" },
						{ label: "Throughput", value: "14.2k/s", delta: "+6.4%" },
						{ label: "Uptime", value: "99.98%", delta: "30d" },
					].map((metric) => (
						<div
							key={metric.label}
							className={
								isDark
									? "rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 sm:px-3 sm:py-2.5"
									: "rounded-xl border border-black/7 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:px-3 sm:py-2.5"
							}
						>
							<p
								className={
									isDark
										? "truncate text-[10px] text-zinc-400 sm:text-[11px]"
										: "truncate text-[10px] text-zinc-500 sm:text-[11px]"
								}
							>
								{metric.label}
							</p>
							<div className="mt-1 flex items-baseline justify-between gap-1">
								<span className="font-semibold text-xs tabular-nums tracking-tight sm:text-sm">
									{metric.value}
								</span>
								<span
									className={
										isDark
											? "hidden font-mono text-[10px] text-emerald-400 tabular-nums sm:inline"
											: "hidden font-mono text-[10px] text-emerald-600 tabular-nums sm:inline"
									}
								>
									{metric.delta}
								</span>
							</div>
						</div>
					))}
				</div>

				<div
					className={
						isDark
							? "relative flex flex-1 flex-col justify-between overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-2.5 sm:p-3"
							: "relative flex flex-1 flex-col justify-between overflow-hidden rounded-xl border border-black/7 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-3"
					}
				>
					<div className="flex items-center justify-between text-[10px] sm:text-[11px]">
						<span className={isDark ? "text-zinc-400" : "text-zinc-500"}>
							Global response time
						</span>
						<span
							className={
								isDark
									? "font-mono text-zinc-300 tabular-nums"
									: "font-mono text-zinc-700 tabular-nums"
							}
						>
							iad1 · fra1 · hnd1
						</span>
					</div>

					<div className="relative h-14 w-full sm:h-20">
						<svg
							viewBox="0 0 400 96"
							preserveAspectRatio="none"
							aria-hidden="true"
							className="size-full"
						>
							<defs>
								<linearGradient
									id={`area-${theme}`}
									x1="0"
									x2="0"
									y1="0"
									y2="1"
								>
									<stop
										offset="0%"
										stopColor={isDark ? "#60a5fa" : "#2563eb"}
										stopOpacity={isDark ? 0.28 : 0.18}
									/>
									<stop
										offset="100%"
										stopColor={isDark ? "#60a5fa" : "#2563eb"}
										stopOpacity="0"
									/>
								</linearGradient>
							</defs>
							<line
								x1="0"
								y1="24"
								x2="400"
								y2="24"
								stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
								strokeDasharray="3 4"
							/>
							<line
								x1="0"
								y1="56"
								x2="400"
								y2="56"
								stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
								strokeDasharray="3 4"
							/>
							<path
								d="M0 72 C48 68, 72 44, 118 48 C164 52, 190 28, 240 34 C284 40, 324 20, 392 22 L392 96 L0 96 Z"
								fill={`url(#area-${theme})`}
							/>
							<path
								d="M0 72 C48 68, 72 44, 118 48 C164 52, 190 28, 240 34 C284 40, 324 20, 392 22"
								fill="none"
								stroke={isDark ? "#60a5fa" : "#2563eb"}
								strokeWidth="2"
								strokeLinecap="round"
								vectorEffect="non-scaling-stroke"
							/>
						</svg>
						<span
							aria-hidden="true"
							className={
								isDark
									? "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400 ring-2 ring-blue-400/25"
									: "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 ring-2 ring-blue-600/20"
							}
							style={{ left: "98%", top: "22.9167%" }}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function BeforeAfterComparePreview() {
	return (
		<div className="w-full max-w-xl px-4 py-4">
			<BeforeAfterCompare
				aria-label="Compare light and dark dashboard themes"
				beforeLabel="Light"
				afterLabel="Dark"
				defaultValue={50}
				className="aspect-4/3 sm:aspect-16/10"
				before={<WorkspaceSurface theme="light" />}
				after={<WorkspaceSurface theme="dark" />}
			/>
		</div>
	);
}
