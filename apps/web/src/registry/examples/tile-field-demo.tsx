"use client";

import { useDialKit } from "dialkit";

import { TileField } from "@/registry/components/tile-field/tile-field";

export default function TileFieldDemo() {
	const params = useDialKit("Tile Field", {
		text: {
			type: "text",
			default: "Localhost",
			placeholder: "Enter text",
		},
		color: {
			type: "color",
			default: "#6366f1",
		},
	});

	return (
		<div className="relative min-h-80 w-full overflow-hidden rounded-xl bg-background">
			<TileField
				aria-label={params.text || "Tile field preview"}
				className="absolute inset-0 min-h-full"
				color={params.color}
				word={params.text}
			/>
			<p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-muted-foreground text-xs">
				Move your pointer to push the tiles
			</p>
		</div>
	);
}
