"use client";

import { useRef } from "react";

import { SnapSheet } from "@/registry/components/snap-sheet/snap-sheet";

function SnapSheetPreview() {
	const screenRef = useRef<HTMLDivElement>(null);

	return (
		<div
			ref={screenRef}
			className="relative h-[280px] w-[270px] overflow-clip rounded-[32px] border bg-muted/40"
		>
			<SnapSheet
				defaultOpen
				defaultSnap={1}
				snapPoints={["96px", 0.55, 1]}
				modal={false}
				scaleBackground
			>
				<div
					data-sheet-wrapper
					className="absolute inset-0 grid content-start gap-3 bg-muted/40 p-6"
				>
					<span className="h-2.5 w-24 rounded-full bg-muted-foreground/20" />
					<span className="h-2 w-40 rounded-full bg-muted-foreground/15" />
					<span className="mt-2 h-20 rounded-2xl bg-muted-foreground/10" />
					<SnapSheet.Trigger className="absolute inset-x-6 bottom-6 h-11 cursor-pointer rounded-full bg-foreground font-medium text-background text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
						Open sheet
					</SnapSheet.Trigger>
				</div>

				<SnapSheet.Content container={screenRef} className="max-w-none">
					<SnapSheet.Handle className="mt-1.5" />
					<div className="px-5 pt-1 pb-6">
						<SnapSheet.Title>Snap sheet</SnapSheet.Title>
						<SnapSheet.Description>
							Drag between snap points
						</SnapSheet.Description>
						<div className="mt-5 grid gap-2.5">
							<span className="h-2 w-full rounded-full bg-muted" />
							<span className="h-2 w-5/6 rounded-full bg-muted" />
							<span className="h-2 w-2/3 rounded-full bg-muted" />
						</div>
					</div>
				</SnapSheet.Content>
			</SnapSheet>
		</div>
	);
}

export default SnapSheetPreview;
