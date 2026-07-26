"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

export function SiteScripts() {
	const pathname = usePathname();

	if (pathname.startsWith("/preview/")) return null;

	return (
		<>
			<Script
				data-website-id="3386bacf-e7d1-4a4e-8b1a-5e8da0d89194"
				src="https://co.srb.codes/script.js"
				strategy="afterInteractive"
			/>
			<Script
				data-project-id="a0yPCWkO"
				src="https://cdn.tkit.ai/widget.js"
				strategy="afterInteractive"
			/>
		</>
	);
}
