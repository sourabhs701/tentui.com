"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandContextMenu } from "@/components/brand-context-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader() {
	const router = useRouter();
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 16);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);
	return (
		<header className="sticky top-0 z-50 flex justify-center px-4 py-3">
			<div
				className={cn(
					"mx-auto flex w-full max-w-6xl items-center justify-between rounded-md border px-5 py-2.5",
					scrolled
						? "border-border bg-background/80 shadow-lg backdrop-blur-md"
						: "border-transparent bg-transparent shadow-none backdrop-blur-none",
				)}
			>
				<BrandContextMenu>
					<Link
						href="#"
						aria-label="Go to home page"
						className="flex items-center transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
					>
						<Image
							alt="Tkit.ai"
							className="h-12 w-auto"
							height={166}
							priority
							src="/tkit-logo.svg"
							width={455}
						/>
					</Link>
				</BrandContextMenu>

				<div className="flex items-center gap-1.5">
					<Button size="lg" onClick={() => router.push("#")}>
						Start free trial
					</Button>
				</div>
			</div>
		</header>
	);
}

export default SiteHeader;
