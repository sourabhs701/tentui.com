"use client";

import Image from "next/image";

import { BrandContextMenu } from "@/registry/components/brand-context-menu";

function BrandContextMenuPreview() {
	return (
		<BrandContextMenu>
			<button
				type="button"
				className="flex touch-manipulation items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label="Open TentUI brand asset menu"
			>
				<Image
					alt=""
					className="h-6 w-auto"
					height={76}
					src="https://cdn.tentui.com/brand/Logo.svg"
					unoptimized
					width={89}
				/>
				<span className="font-semibold tracking-tight">TentUI</span>
			</button>
		</BrandContextMenu>
	);
}

export default BrandContextMenuPreview;
