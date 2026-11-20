"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandContextMenu } from "@/components/brand-context-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SiteHeaderProps = {
	ctaHref?: string;
	className?: string;
};

export function SiteHeader({ ctaHref = "#", className }: SiteHeaderProps = {}) {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 16);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<header
			className={cn(
				"sticky top-0 z-50 flex justify-center px-3 py-3 sm:px-4",
				className,
			)}
		>
			<nav
				aria-label="Main"
				className={cn(
					"mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-xl border py-2 pr-2 pl-3 transition-[background-color,border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none sm:pr-2.5 sm:pl-4",
					scrolled
						? "border-border bg-background/80 shadow-lg backdrop-blur-md"
						: "border-transparent bg-transparent shadow-none",
				)}
			>
				<BrandContextMenu>
					<Link
						aria-label="Tkit.ai home"
						className="flex shrink-0 items-center rounded-md outline-none transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
						href="#"
					>
						<Image
							alt=""
							className="h-9 w-auto sm:h-11"
							height={166}
							priority
							src="https://cdn.tentui.com/tkit-logo.svg"
							unoptimized
							width={455}
						/>
					</Link>
				</BrandContextMenu>

				<Button
					className="h-9 px-3.5 sm:h-10 sm:px-4"
					nativeButton={false}
					render={<a href={ctaHref} />}
					size="lg"
				>
					Start free trial
				</Button>
			</nav>
		</header>
	);
}

export default SiteHeader;
