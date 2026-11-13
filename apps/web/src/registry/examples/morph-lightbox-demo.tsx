"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import {
	MorphLightbox,
	type MorphLightboxItem,
	MorphLightboxTrigger,
} from "@/registry/components/morph-lightbox/morph-lightbox";

const photos: MorphLightboxItem[] = [
	{
		src: "https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=max&w=1600&q=75",
		thumbnailSrc:
			"https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=max&w=480&q=70",
		alt: "Turquoise lake between steep mountain slopes",
		width: 1600,
		height: 2400,
		caption: "Still water under the ridge",
	},
	{
		src: "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?auto=format&fit=max&w=1600&q=75",
		thumbnailSrc:
			"https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?auto=format&fit=max&w=480&q=70",
		alt: "Pine forest fading into morning fog",
		width: 1600,
		height: 1067,
		caption: "Morning fog over the pines",
	},
	{
		src: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?auto=format&fit=crop&w=1600&h=1600&q=75",
		thumbnailSrc:
			"https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?auto=format&fit=crop&w=480&h=480&q=70",
		alt: "Snowy peaks rising through clouds",
		width: 1600,
		height: 1600,
		caption: "Peaks above the cloud line",
	},
	{
		src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=max&w=1600&q=75",
		thumbnailSrc:
			"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=max&w=640&q=70",
		alt: "Soft waves rolling onto a sandy beach at sunrise",
		width: 1600,
		height: 1064,
		caption: "Low tide at sunrise",
	},
	{
		src: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=max&w=1600&q=75",
		thumbnailSrc:
			"https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=max&w=480&q=70",
		alt: "Red poppies in a field under a pale sky",
		width: 1600,
		height: 1060,
		caption: "Poppies at the edge of the field",
	},
	{
		src: "https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?auto=format&fit=max&w=1600&q=75",
		thumbnailSrc:
			"https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?auto=format&fit=max&w=480&q=70",
		alt: "A lone tree standing in a lake at dusk",
		width: 1600,
		height: 1067,
		caption: "A lone tree at dusk",
	},
	{
		src: "https://images.unsplash.com/photo-1433086966358-54859d0ed716?auto=format&fit=max&w=1600&q=75",
		thumbnailSrc:
			"https://images.unsplash.com/photo-1433086966358-54859d0ed716?auto=format&fit=max&w=480&q=70",
		alt: "A tall waterfall dropping into a green gorge",
		width: 1600,
		height: 2400,
		caption: "The falls after rain",
	},
	{
		src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=max&w=1600&q=75",
		thumbnailSrc:
			"https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=max&w=800&q=70",
		alt: "Mountain range above a sea of clouds",
		width: 1600,
		height: 1067,
		caption: "Above the clouds, 6:40 am",
	},
];

/** One tall tile and one wide tile; the rest fill a 3 × 3 grid. */
const gallery = photos.slice(0, 7);
const tileClassName: Record<number, string> = {
	0: "row-span-2",
	3: "col-span-2",
};
const article = photos.slice(7);
const controlled = photos.slice(0, 4);

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="grid gap-3">
			<h3 className="font-medium text-muted-foreground text-sm">{title}</h3>
			{children}
		</section>
	);
}

function MorphLightboxDemo() {
	const [open, setOpen] = useState(false);
	const [index, setIndex] = useState(0);

	return (
		<div className="grid w-full max-w-md gap-10 py-4">
			<Section title="Gallery">
				<MorphLightbox items={gallery}>
					<div className="grid auto-rows-[88px] grid-cols-3 gap-1.5 sm:auto-rows-[120px]">
						{gallery.map((photo, photoIndex) => (
							<MorphLightboxTrigger
								key={photo.src}
								index={photoIndex}
								className={cn("aspect-auto h-full", tileClassName[photoIndex])}
							/>
						))}
					</div>
				</MorphLightbox>
			</Section>

			<Section title="Inline article image">
				<MorphLightbox items={article}>
					<div className="grid gap-3 text-sm leading-relaxed">
						<p>
							We left the hut before five and reached the ridge as the valley
							filled with cloud.
						</p>
						<MorphLightboxTrigger
							index={0}
							className="aspect-[16/9] rounded-lg"
						/>
						<p className="text-muted-foreground">
							Tap the photo to see it whole.
						</p>
					</div>
				</MorphLightbox>
			</Section>

			<Section title="Controlled">
				<MorphLightbox
					items={controlled}
					open={open}
					onOpenChange={setOpen}
					index={index}
					onIndexChange={setIndex}
					sound={false}
				>
					<div className="grid gap-3">
						<div className="grid grid-cols-4 gap-1.5">
							{controlled.map((photo, photoIndex) => (
								<MorphLightboxTrigger
									key={photo.src}
									index={photoIndex}
									className="rounded-lg"
								/>
							))}
						</div>
						<div className="flex items-center justify-between gap-3">
							<button
								type="button"
								onClick={() => {
									setIndex(2);
									setOpen(true);
								}}
								className="h-9 cursor-pointer rounded-full bg-foreground px-4 font-medium text-background text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
							>
								Open third photo
							</button>
							<span className="text-muted-foreground text-sm tabular-nums">
								Photo {index + 1} of {controlled.length}
							</span>
						</div>
					</div>
				</MorphLightbox>
			</Section>
		</div>
	);
}

export default MorphLightboxDemo;
