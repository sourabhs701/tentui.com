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

/** Bold color and hard edges, so the blur and the bend show through the glass. */
function Artwork() {
	return (
		<svg
			aria-hidden
			viewBox="0 0 320 200"
			preserveAspectRatio="xMidYMid slice"
			className="absolute inset-0 size-full"
		>
			<defs>
				<linearGradient
					id="liquid-glass-menu-demo-sky"
					x1="0"
					y1="0"
					x2="1"
					y2="1"
				>
					<stop offset="0" stopColor="#ff8a5b" />
					<stop offset="0.5" stopColor="#ff4f8b" />
					<stop offset="1" stopColor="#6c4dff" />
				</linearGradient>
			</defs>
			<rect width="320" height="200" fill="url(#liquid-glass-menu-demo-sky)" />
			<circle cx="236" cy="58" r="34" fill="#ffe27a" />
			{[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
				<rect
					key={index}
					x={-20 + index * 46}
					y={118}
					width={22}
					height={120}
					rx={4}
					fill={index % 2 ? "#1b1464" : "#00c2a8"}
					transform={`rotate(-14 ${index * 46} 118)`}
				/>
			))}
		</svg>
	);
}

function OverAnImage() {
	return (
		<div className="relative h-52 w-full max-w-[320px] overflow-hidden rounded-3xl">
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
