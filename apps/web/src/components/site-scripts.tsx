"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

// Queue stub from the official tkit snippet: calls made before the loader runs
// are pushed to tkit.q, which the loader drains on startup.
const tkitQueueStub =
	"window.tkit=window.tkit||function(){(window.tkit.q=window.tkit.q||[]).push(arguments)};";

export function SiteScripts() {
	const pathname = usePathname();

	// Keep previews and media captures free of analytics and the chat widget.
	// Both load once the page is idle so they don't compete with first paint.
	if (pathname.startsWith("/preview/") || pathname.startsWith("/capture/")) {
		return null;
	}

	return (
		<>
			<Script
				data-website-id="3386bacf-e7d1-4a4e-8b1a-5e8da0d89194"
				src="https://co.srb.codes/script.js"
				strategy="lazyOnload"
			/>
			<Script id="tkit-queue" strategy="afterInteractive">
				{tkitQueueStub}
			</Script>
			<Script
				src="https://widget.tkit.ai/loader.js"
				data-widget-id="BZc0bJ1oNSqU"
				strategy="lazyOnload"
			/>
		</>
	);
}
