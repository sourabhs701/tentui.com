"use client";

import {
	ArrowUpDownIcon,
	CopyIcon,
	FolderPlusIcon,
	HeartIcon,
	ScanLineIcon,
	Share2Icon,
	Trash2Icon,
	UploadIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import {
	LiquidGlassMenu,
	LiquidGlassMenuCheckboxItem,
	LiquidGlassMenuContent,
	LiquidGlassMenuGroup,
	LiquidGlassMenuItem,
	LiquidGlassMenuLabel,
	LiquidGlassMenuRadioGroup,
	LiquidGlassMenuRadioItem,
	LiquidGlassMenuSeparator,
	LiquidGlassMenuTrigger,
} from "@/registry/components/liquid-glass-menu/liquid-glass-menu";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

/**
 * A calm dusk over hills: soft color for the blur to pick up, and a few clean
 * ridges for the rim of the glass to bend.
 */
function Artwork() {
	const id = "liquid-glass-menu-demo";
	return (
		<svg
			aria-hidden
			viewBox="0 0 320 256"
			preserveAspectRatio="xMidYMid slice"
			className="absolute inset-0 size-full"
		>
			<defs>
				<linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#b9cfe6" />
					<stop offset="0.55" stopColor="#e8dcd8" />
					<stop offset="1" stopColor="#f5d3bf" />
				</linearGradient>
				<radialGradient id={`${id}-sun`} cx="0.5" cy="0.5" r="0.5">
					<stop offset="0" stopColor="#fff7ec" stopOpacity="0.95" />
					<stop offset="0.25" stopColor="#ffe9d4" stopOpacity="0.7" />
					<stop offset="1" stopColor="#ffe9d4" stopOpacity="0" />
				</radialGradient>
				<linearGradient id={`${id}-near`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#5d7f80" />
					<stop offset="1" stopColor="#3d5a5e" />
				</linearGradient>
			</defs>
			<rect width="320" height="256" fill={`url(#${id}-sky)`} />
			<circle cx="226" cy="118" r="78" fill={`url(#${id}-sun)`} />
			<circle cx="226" cy="118" r="15" fill="#fff6ea" />
			<path
				d="M0 150 C 40 128 76 122 112 136 S 180 116 222 128 S 290 120 320 132 V256 H0 Z"
				fill="#a8bccd"
			/>
			<path
				d="M0 176 C 48 156 92 158 138 170 S 222 150 262 160 S 306 156 320 162 V256 H0 Z"
				fill="#87a3ab"
			/>
			<path
				d="M0 206 C 56 186 118 190 168 200 S 262 184 320 192 V256 H0 Z"
				fill={`url(#${id}-near)`}
			/>
		</svg>
	);
}

function OverAnImage() {
	return (
		<div className="relative h-64 w-full max-w-[320px] overflow-hidden rounded-3xl">
			<Artwork />
			<div className="absolute right-3 bottom-3">
				<LiquidGlassMenu>
					<LiquidGlassMenuTrigger aria-label="Photo actions" />
					<LiquidGlassMenuContent side="top" align="end">
						<LiquidGlassMenuItem icon={<Share2Icon />}>
							Share
						</LiquidGlassMenuItem>
						<LiquidGlassMenuItem icon={<CopyIcon />}>
							Duplicate
						</LiquidGlassMenuItem>
						<LiquidGlassMenuItem icon={<HeartIcon />}>
							Favorite
						</LiquidGlassMenuItem>
						<LiquidGlassMenuItem icon={<Trash2Icon />}>
							Delete
						</LiquidGlassMenuItem>
					</LiquidGlassMenuContent>
				</LiquidGlassMenu>
			</div>
		</div>
	);
}

const SORTS = {
	newest: "Newest",
	oldest: "Oldest",
	name: "Name",
} as const;

function SortMenu() {
	const [sort, setSort] = useState<keyof typeof SORTS>("newest");
	const [showHidden, setShowHidden] = useState(false);

	return (
		<div className="flex w-full max-w-[320px] items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 shadow-xs">
			<div className="min-w-0">
				<p className="font-medium text-sm">Files</p>
				<p className="truncate text-muted-foreground text-xs">
					{SORTS[sort]} first{showHidden ? ", hidden shown" : ""}
				</p>
			</div>
			<LiquidGlassMenu>
				<LiquidGlassMenuTrigger
					render={
						<button
							type="button"
							className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-background px-3.5 font-medium text-sm shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-accent"
						/>
					}
				>
					<ArrowUpDownIcon className="size-3.5" />
					Sort
				</LiquidGlassMenuTrigger>
				<LiquidGlassMenuContent align="end">
					<LiquidGlassMenuGroup>
						<LiquidGlassMenuLabel>Sort by</LiquidGlassMenuLabel>
						<LiquidGlassMenuRadioGroup
							value={sort}
							onValueChange={(value) => setSort(value as keyof typeof SORTS)}
						>
							<LiquidGlassMenuRadioItem value="newest" shortcut="⌘1">
								Newest
							</LiquidGlassMenuRadioItem>
							<LiquidGlassMenuRadioItem value="oldest" shortcut="⌘2">
								Oldest
							</LiquidGlassMenuRadioItem>
							<LiquidGlassMenuRadioItem value="name" shortcut="⌘3">
								Name
							</LiquidGlassMenuRadioItem>
						</LiquidGlassMenuRadioGroup>
					</LiquidGlassMenuGroup>
					<LiquidGlassMenuSeparator />
					<LiquidGlassMenuCheckboxItem
						checked={showHidden}
						onCheckedChange={setShowHidden}
						shortcut="⇧⌘H"
					>
						Show hidden
					</LiquidGlassMenuCheckboxItem>
				</LiquidGlassMenuContent>
			</LiquidGlassMenu>
		</div>
	);
}

function PlainMenu() {
	return (
		<LiquidGlassMenu morph={false} sound={false}>
			<LiquidGlassMenuTrigger aria-label="New" />
			<LiquidGlassMenuContent side="top" align="center">
				<LiquidGlassMenuItem icon={<FolderPlusIcon />}>
					New folder
				</LiquidGlassMenuItem>
				<LiquidGlassMenuItem icon={<UploadIcon />}>Upload</LiquidGlassMenuItem>
				<LiquidGlassMenuItem icon={<ScanLineIcon />}>Scan</LiquidGlassMenuItem>
			</LiquidGlassMenuContent>
		</LiquidGlassMenu>
	);
}

function LiquidGlassMenuDemo() {
	return (
		<div className="flex w-full max-w-md flex-col items-center gap-10 py-4">
			<Section title="Over an image">
				<OverAnImage />
			</Section>
			<Section title="Groups, shortcuts, radio">
				<SortMenu />
			</Section>
			<Section title="No morph, sound off">
				<PlainMenu />
			</Section>
		</div>
	);
}

export default LiquidGlassMenuDemo;
