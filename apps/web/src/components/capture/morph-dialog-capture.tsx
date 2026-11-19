"use client";

import { useEffect, useState } from "react";

import {
	MorphDialog,
	MorphDialogClose,
	MorphDialogContent,
	MorphDialogDescription,
	MorphDialogMedia,
	MorphDialogSubtitle,
	MorphDialogTitle,
	MorphDialogTrigger,
} from "@/registry/components/morph-dialog/morph-dialog";

const photo = {
	src: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?auto=format&fit=crop&w=960&h=600&q=75",
	alt: "Snowy peaks rising through clouds",
};

/**
 * A compact card and dialog that fit the 480x360 frame whole. The still shows
 * the dialog open over its card, since the morph is the point. Motion takes
 * load the page with `?motion` and start on the card, so the scripted click
 * opens it.
 */
export function MorphDialogCapture() {
	const [open, setOpen] = useState<boolean | null>(null);

	useEffect(() => {
		setOpen(!new URLSearchParams(window.location.search).has("motion"));
	}, []);

	if (open === null) return null;
	return (
		<>
			<MorphDialog defaultOpen={open}>
				<MorphDialogTrigger className="w-56 rounded-2xl bg-card p-2 shadow-black/5 shadow-sm ring-1 ring-foreground/10">
					<MorphDialogMedia
						{...photo}
						className="aspect-[4/3] w-full rounded-lg"
					/>
					<span className="block px-1.5 pt-2.5 pb-1">
						<MorphDialogTitle className="text-[15px] leading-5">
							Above the cloud line
						</MorphDialogTitle>
						<MorphDialogSubtitle className="mt-0.5 text-[13px] leading-5">
							A slow week in the Dolomites
						</MorphDialogSubtitle>
					</span>
				</MorphDialogTrigger>
				<MorphDialogContent className="w-80">
					<div className="p-2">
						<MorphDialogMedia
							{...photo}
							className="aspect-[2/1] w-full rounded-2xl"
						/>
					</div>
					<div className="px-5 pt-2 pb-4">
						<MorphDialogTitle className="text-xl leading-7">
							Above the cloud line
						</MorphDialogTitle>
						<MorphDialogSubtitle className="text-sm leading-5">
							A slow week in the Dolomites
						</MorphDialogSubtitle>
						<MorphDialogDescription className="mt-3 text-muted-foreground text-sm leading-relaxed">
							Seven days hut to hut from Val Gardena, above the fog every
							morning.
						</MorphDialogDescription>
					</div>
					<MorphDialogClose />
				</MorphDialogContent>
			</MorphDialog>
			{open ? (
				// The dialog is portaled out of the stage, which only waits for images
				// inside it. A hidden copy of its photo holds the still.
				<div
					aria-hidden
					className="pointer-events-none fixed size-px opacity-0"
				>
					{/* biome-ignore lint/performance/noImgElement: preloads the dialog's plain image */}
					<img src={photo.src} alt="" className="size-px" />
				</div>
			) : null}
		</>
	);
}
