"use client";

import {
	MorphDialog,
	MorphDialogClose,
	MorphDialogContent,
	MorphDialogDescription,
	MorphDialogMedia,
	type MorphDialogProps,
	MorphDialogSubtitle,
	MorphDialogTitle,
	MorphDialogTrigger,
} from "@/registry/components/morph-dialog/morph-dialog";

const photo = {
	src: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?auto=format&fit=crop&w=960&h=600&q=75",
	alt: "Snowy peaks rising through clouds",
};

export default function MorphDialogPreview(
	props: Omit<MorphDialogProps, "children">,
) {
	return (
		<MorphDialog {...props}>
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
			<MorphDialogContent className="w-[min(calc(100vw-2rem),24rem)]">
				<div className="p-2">
					<MorphDialogMedia
						{...photo}
						className="aspect-[2/1] w-full rounded-2xl"
					/>
				</div>
				<div className="px-5 pt-2 pb-5">
					<MorphDialogTitle className="text-xl leading-7">
						Above the cloud line
					</MorphDialogTitle>
					<MorphDialogSubtitle className="text-sm leading-5">
						A slow week in the Dolomites
					</MorphDialogSubtitle>
					<MorphDialogDescription className="mt-4 space-y-3 text-muted-foreground text-sm leading-relaxed">
						<p>
							Seven days hut to hut, starting in Val Gardena. Mornings begin
							above the fog, and the trail drops into it by noon.
						</p>
						<p>
							Pack light layers, a headlamp for the first hour, and cash for the
							rifugi. Pull the photo down to put the guide away.
						</p>
					</MorphDialogDescription>
				</div>
				<MorphDialogClose />
			</MorphDialogContent>
		</MorphDialog>
	);
}
