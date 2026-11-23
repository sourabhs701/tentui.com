"use client";

import { BeforeAfterCompare } from "@/registry/components/before-after-compare/before-after-compare";

const LINE =
	"M0 70 C60 66, 90 46, 140 50 C190 54, 220 30, 270 34 C320 38, 350 18, 400 16";

function Surface({ theme }: { theme: "light" | "dark" }) {
	const isDark = theme === "dark";
	const stroke = isDark ? "#fafafa" : "#18181b";

	return (
		<div
			className={
				isDark
					? "flex size-full flex-col justify-between bg-[#0a0a0a] p-6 text-zinc-100"
					: "flex size-full flex-col justify-between bg-white p-6 text-zinc-900"
			}
		>
			<div className="flex flex-col items-center gap-1 pt-4 text-center">
				<span className="text-xs text-zinc-500">Revenue</span>
				<span className="font-semibold text-3xl tabular-nums tracking-tight">
					$48,210
				</span>
			</div>

			<svg
				viewBox="0 0 400 88"
				preserveAspectRatio="none"
				aria-hidden="true"
				className="h-20 w-full"
			>
				<defs>
					<linearGradient id={`fill-${theme}`} x1="0" x2="0" y1="0" y2="1">
						<stop offset="0%" stopColor={stroke} stopOpacity={0.12} />
						<stop offset="100%" stopColor={stroke} stopOpacity={0} />
					</linearGradient>
				</defs>
				<path d={`${LINE} L400 88 L0 88 Z`} fill={`url(#fill-${theme})`} />
				<path
					d={LINE}
					fill="none"
					stroke={stroke}
					strokeWidth="1.5"
					strokeLinecap="round"
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
		</div>
	);
}

export default function BeforeAfterComparePreview() {
	return (
		<div className="w-full max-w-md px-4 py-4">
			<BeforeAfterCompare
				aria-label="Compare light and dark themes"
				beforeLabel="Light"
				afterLabel="Dark"
				defaultValue={50}
				className="aspect-4/3"
				before={<Surface theme="light" />}
				after={<Surface theme="dark" />}
			/>
		</div>
	);
}
