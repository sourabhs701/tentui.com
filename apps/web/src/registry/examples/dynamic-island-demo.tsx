"use client";

import { CircleCheck, CloudUpload, Headphones } from "lucide-react";

import {
	DynamicIsland,
	DynamicIslandView,
	useDynamicIsland,
} from "@/registry/components/dynamic-island/dynamic-island";

const events = [
	{ id: "upload", label: "Upload 40%", duration: 2000 },
	{ id: "airpods", label: "AirPods connected", duration: 2000 },
	{ id: "build", label: "Build passed", duration: 4000 },
] as const;

function DynamicIslandDemo() {
	const island = useDynamicIsland();

	return (
		<div className="flex w-full max-w-sm flex-col items-center gap-6">
			{/* Room for the expanded card, so the buttons below never move. */}
			<div className="h-36 w-full">
				<DynamicIsland view={island.view} onDismiss={island.hide}>
					<DynamicIslandView id="upload" label="Uploading, 40 percent">
						<CloudUpload aria-hidden className="size-4" />
						<span className="font-semibold tabular-nums">40%</span>
					</DynamicIslandView>
					<DynamicIslandView id="airpods" label="AirPods connected">
						<Headphones aria-hidden className="size-4" />
						<span>Connected</span>
					</DynamicIslandView>
					<DynamicIslandView id="build" size="expanded" label="Build passed">
						<div className="flex items-center gap-3">
							<CircleCheck aria-hidden className="size-5 shrink-0" />
							<div className="min-w-0">
								<p className="font-semibold">Build passed</p>
								<p className="text-background/70">main · 42 checks in 1m 08s</p>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={island.hide}
								className="h-9 cursor-pointer rounded-full bg-background/15 font-medium outline-none transition-colors hover:bg-background/25 focus-visible:ring-2 focus-visible:ring-background/60"
							>
								Close
							</button>
							<button
								type="button"
								onClick={island.hide}
								className="h-9 cursor-pointer rounded-full bg-background font-medium text-foreground outline-none transition-colors hover:bg-background/90 focus-visible:ring-2 focus-visible:ring-background/60 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
							>
								Deploy
							</button>
						</div>
					</DynamicIslandView>
				</DynamicIsland>
			</div>
			<div className="flex flex-wrap justify-center gap-2">
				{events.map((event) => (
					<button
						key={event.id}
						type="button"
						onClick={() => island.show(event.id, { duration: event.duration })}
						className="h-9 cursor-pointer rounded-full border bg-background px-4 font-medium text-sm shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						{event.label}
					</button>
				))}
			</div>
		</div>
	);
}

export default DynamicIslandDemo;
