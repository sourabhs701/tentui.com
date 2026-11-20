"use client";

import { VariableFontHover } from "@/registry/components/variable-font-hover/variable-font-hover";

function VariableFontHoverPreview() {
	return (
		<div className="flex w-full flex-col items-center gap-3 px-4 text-center">
			<VariableFontHover
				as="h2"
				size="xl"
				tabIndex={0}
				weightRange={[350, 850]}
				className="mx-auto w-fit max-w-full text-balance"
			>
				Type with weight
			</VariableFontHover>
			<p className="text-muted-foreground text-xs">
				<span className="pointer-coarse:hidden">
					Move across the type or focus with Tab
				</span>
				<span className="pointer-coarse:inline hidden">
					Drag across the type
				</span>
			</p>
		</div>
	);
}

export default VariableFontHoverPreview;
