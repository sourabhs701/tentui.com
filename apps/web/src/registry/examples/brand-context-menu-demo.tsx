"use client";

import Image from "next/image";

import { BrandContextMenu } from "@/registry/components/brand-context-menu";

export default function BrandContextMenuDemo() {
	return (
		<div className="flex min-h-72 w-full flex-col bg-background">
			<header className="border-b">
				<div className="mx-auto flex h-14 w-full max-w-4xl items-center px-4 sm:px-6">
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
								src="https://cdn.srb.codes/brand/mark-brand.svg"
								unoptimized
								width={89}
							/>
							<span className="font-semibold tracking-tight">TentUI</span>
						</button>
					</BrandContextMenu>

					<nav
						aria-label="Demo navigation"
						className="ml-auto hidden items-center gap-5 text-muted-foreground text-sm sm:flex"
					>
						<a
							className="transition-colors hover:text-foreground"
							href="#components"
						>
							Components
						</a>
						<a
							className="transition-colors hover:text-foreground"
							href="#blocks"
						>
							Blocks
						</a>
						<a className="transition-colors hover:text-foreground" href="#docs">
							Docs
						</a>
					</nav>
				</div>
			</header>

			<div className="flex flex-1 items-center justify-center px-6 py-12">
				<div className="flex max-w-sm flex-col items-center gap-2 text-center">
					<p className="font-medium">The brand kit is built into the header.</p>
					<p className="text-muted-foreground text-sm">
						Right-click or long-press the TentUI logo to open it.
					</p>
				</div>
			</div>
		</div>
	);
}
