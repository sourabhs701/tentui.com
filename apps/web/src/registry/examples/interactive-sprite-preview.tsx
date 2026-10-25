"use client";

import { InteractiveSprite } from "@/registry/components/interactive-sprite";

function InteractiveSpritePreview() {
	return (
		<InteractiveSprite
			alt="TentUI mascot looking toward the pointer"
			className="size-48 select-none rounded-full ring-1 ring-border ring-offset-4 ring-offset-background [&>[aria-hidden]]:translate-y-3"
			src="https://cdn.tentui.com/images/components/interactive-sprite-kitten.png"
		/>
	);
}

export default InteractiveSpritePreview;
