"use client";

import { GlassLensZoom } from "@/registry/components/glass-lens-zoom/glass-lens-zoom";

export default function GlassLensZoomPreview() {
	return (
		<div className="w-full max-w-[440px]">
			<GlassLensZoom
				src="https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1200&h=900&q=85"
				zoomSrc="https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=2000&h=1500&q=90"
				alt="Red poppies blooming in a meadow under soft light"
				defaultPosition={{ x: 0.48, y: 0.48 }}
				defaultZoom={2.3}
				lensSize={152}
			/>
		</div>
	);
}
