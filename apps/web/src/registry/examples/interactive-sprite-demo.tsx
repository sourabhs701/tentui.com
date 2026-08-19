"use client";

import { useDialKit } from "dialkit";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { InteractiveSprite } from "@/registry/components/interactive-sprite";

const DEFAULT_SPRITE_SRC =
	"https://cdn.tentui.com/images/components/interactive-sprite-kitten.png";

export default function InteractiveSpriteDemo() {
	const uploadInputRef = useRef<HTMLInputElement>(null);
	const [spriteSrc, setSpriteSrc] = useState(DEFAULT_SPRITE_SRC);
	const params = useDialKit(
		"Interactive Sprite",
		{
			deadZone: [24, 0, 96, 1],
			idleDelay: [300, 250, 3000, 50],
			uploadSpriteSheet: { type: "action", label: "Upload sprite sheet" },
		},
		{
			onAction: (action) => {
				if (action === "uploadSpriteSheet") uploadInputRef.current?.click();
			},
		},
	);

	useEffect(() => {
		if (spriteSrc === DEFAULT_SPRITE_SRC) return;
		return () => URL.revokeObjectURL(spriteSrc);
	}, [spriteSrc]);

	function handleSpriteUpload(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (file) setSpriteSrc(URL.createObjectURL(file));
	}

	return (
		<div className="flex min-h-96 w-full flex-col items-center justify-center gap-5 overflow-hidden rounded-xl p-8">
			<InteractiveSprite
				alt="TentUI mascot looking toward the pointer"
				className="size-48 select-none rounded-full ring-1 ring-border ring-offset-4 ring-offset-background [&>[aria-hidden]]:translate-y-3"
				deadZone={params.deadZone}
				idleDelay={params.idleDelay}
				src={spriteSrc}
			/>
			<p className="text-center text-muted-foreground text-xs">
				Move your pointer around the character, then let it rest.
			</p>
			<input
				ref={uploadInputRef}
				accept="image/*"
				hidden
				onChange={handleSpriteUpload}
				type="file"
			/>
		</div>
	);
}
