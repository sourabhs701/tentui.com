"use client";

import {
	MorphLightbox,
	type MorphLightboxItem,
	MorphLightboxTrigger,
} from "@/registry/components/morph-lightbox/morph-lightbox";

export const photos: MorphLightboxItem[] = [
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
		src: "https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=max&w=1600&q=75",
		thumbnailSrc:
			"https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=max&w=480&q=70",
		alt: "Turquoise lake between steep mountain slopes",
		width: 1600,
		height: 2400,
		caption: "Still water under the ridge",
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
		src: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?auto=format&fit=crop&w=1600&h=1600&q=75",
		thumbnailSrc:
			"https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?auto=format&fit=crop&w=480&h=480&q=70",
		alt: "Snowy peaks rising through clouds",
		width: 1600,
		height: 1600,
		caption: "Peaks above the cloud line",
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
		src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=max&w=1600&q=75",
		thumbnailSrc:
			"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=max&w=480&q=70",
		alt: "Soft waves rolling onto a sandy beach at sunrise",
		width: 1600,
		height: 1064,
		caption: "Low tide at sunrise",
	},
];

function MorphLightboxPreview({
	defaultOpen,
	defaultIndex,
}: {
	defaultOpen?: boolean;
	defaultIndex?: number;
}) {
	return (
		<MorphLightbox
			items={photos}
			defaultOpen={defaultOpen}
			defaultIndex={defaultIndex}
		>
			<div className="grid w-full max-w-[360px] grid-cols-3 gap-1.5">
				{photos.map((photo, index) => (
					<MorphLightboxTrigger key={photo.src} index={index} />
				))}
			</div>
		</MorphLightbox>
	);
}

export default MorphLightboxPreview;
