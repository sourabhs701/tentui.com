"use client";

import { ScratchCard } from "@/registry/components/scratch-card/scratch-card";

function ScratchCardPreview() {
	return (
		<ScratchCard aria-label="Scratch to reveal" className="max-w-[280px]">
			<div className="flex flex-col items-center gap-1 px-6 text-center">
				<p className="font-semibold text-base text-foreground tracking-tight">
					You found it
				</p>
				<p className="text-muted-foreground text-xs">
					A little something, just for you.
				</p>
			</div>
		</ScratchCard>
	);
}

export default ScratchCardPreview;
