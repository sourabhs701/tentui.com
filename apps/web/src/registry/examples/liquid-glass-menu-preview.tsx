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
	"bg-[linear-gradient(150deg,#fdebe3,#f8d9cc)] dark:bg-[linear-gradient(150deg,#3b2c28,#4a3630)]",
	"bg-[linear-gradient(150deg,#e6eefa,#d2e1f5)] dark:bg-[linear-gradient(150deg,#212b3c,#2a3850)]",
	"bg-[linear-gradient(150deg,#eeeafa,#ddd7f3)] dark:bg-[linear-gradient(150deg,#2a2740,#352f50)]",
	"bg-[linear-gradient(150deg,#e4f3ea,#cfe8da)] dark:bg-[linear-gradient(150deg,#1f3129,#283f35)]",
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
		<div className="relative my-8 grid w-full max-w-72 grid-cols-2 gap-4">
			{TILES.map((tile) => (
				<div key={tile} className={`aspect-square rounded-2xl ${tile}`} />
			))}
			<div className="absolute right-4 bottom-4">
				<LiquidGlassMenu defaultOpen={defaultOpen}>
					<LiquidGlassMenuTrigger aria-label="Add to library" />
					<LiquidGlassMenuContent side="top" align="end">
						<LiquidGlassMenuItem
							className="min-h-12"
							icon={
								<Badge className="bg-neutral-950 dark:bg-neutral-50 dark:text-neutral-950">
									<CameraIcon />
								</Badge>
							}
						>
							Camera
						</LiquidGlassMenuItem>
						<LiquidGlassMenuItem
							className="min-h-12"
							icon={
								<Badge className="bg-sky-500">
									<ShoppingBagIcon />
								</Badge>
							}
						>
							Store
						</LiquidGlassMenuItem>
						<LiquidGlassMenuItem
							className="min-h-12"
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
