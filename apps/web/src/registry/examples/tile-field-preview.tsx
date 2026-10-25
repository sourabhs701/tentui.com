"use client";

import { TileField } from "@/registry/components/tile-field/tile-field";

function TileFieldPreview() {
	return (
		<div className="flex min-h-72 w-full items-center bg-background px-16">
			<TileField
				aria-label="Tile field preview"
				className="min-h-72"
				color="#6366f1"
				word="Localhost"
			/>
		</div>
	);
}

export default TileFieldPreview;
