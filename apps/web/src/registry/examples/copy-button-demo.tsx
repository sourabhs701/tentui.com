"use client";

import { CopyButton } from "@/registry/components/copy-button/copy-button";

function CopyButtonDemo() {
	return (
		<CopyButton size="default" variant="outline" text="npm install tentui">
			Copy command
		</CopyButton>
	);
}

export default CopyButtonDemo;
