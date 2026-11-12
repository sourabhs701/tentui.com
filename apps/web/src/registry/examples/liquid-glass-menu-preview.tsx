"use client";

import { CameraIcon, MicIcon, ShoppingBagIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
	LiquidGlassMenu,
	LiquidGlassMenuContent,
	LiquidGlassMenuItem,
	LiquidGlassMenuTrigger,
} from "@/registry/components/liquid-glass-menu/liquid-glass-menu";

const TILES = [
	"bg-[linear-gradient(135deg,#ffe1d2,#ffc2b0)] dark:bg-[linear-gradient(135deg,#4a2b24,#6b3a2f)]",
	"bg-[linear-gradient(135deg,#dbeaff,#b7d4ff)] dark:bg-[linear-gradient(135deg,#1f2f4d,#2b4373)]",
	"bg-[linear-gradient(135deg,#ece4ff,#d3c6ff)] dark:bg-[linear-gradient(135deg,#2f2850,#433879)]",
	"bg-[linear-gradient(135deg,#dcf5e7,#b9ead0)] dark:bg-[linear-gradient(135deg,#1d3a2d,#28553f)]",
];

function Badge({
	className,
	children,
}: {
	className: string;
	children: ReactNode;
}) {
	return (
		<span
			className={`grid size-8 place-items-center rounded-full text-white ${className}`}
		>
			{children}
		</span>
	);
}

/** `defaultOpen` is only used by the capture still; the docs render it closed. */
function LiquidGlassMenuPreview({ defaultOpen }: { defaultOpen?: boolean }) {
	return (
		<div className="relative grid w-full max-w-[320px] grid-cols-2 gap-3">
			{TILES.map((tile) => (
				<div key={tile} className={`aspect-square rounded-2xl ${tile}`} />
			))}
			<div className="absolute right-3 bottom-3">
				<LiquidGlassMenu defaultOpen={defaultOpen}>
					<LiquidGlassMenuTrigger aria-label="Add to library" />
					<LiquidGlassMenuContent side="top" align="end">
						<LiquidGlassMenuItem
							className="min-h-[52px]"
							icon={
								<Badge className="bg-neutral-950 dark:bg-neutral-50 dark:text-neutral-950">
									<CameraIcon />
								</Badge>
							}
						>
							Camera
						</LiquidGlassMenuItem>
						<LiquidGlassMenuItem
							className="min-h-[52px]"
							icon={
								<Badge className="bg-sky-500">
									<ShoppingBagIcon />
								</Badge>
							}
						>
							Store
						</LiquidGlassMenuItem>
						<LiquidGlassMenuItem
							className="min-h-[52px]"
							icon={
								<Badge className="bg-rose-500">
									<MicIcon />
								</Badge>
							}
						>
							Audio
						</LiquidGlassMenuItem>
					</LiquidGlassMenuContent>
				</LiquidGlassMenu>
			</div>
		</div>
	);
}

export default LiquidGlassMenuPreview;
