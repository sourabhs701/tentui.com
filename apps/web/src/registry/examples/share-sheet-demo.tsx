"use client";

import {
	Code2Icon,
	FileTextIcon,
	GlobeIcon,
	HashIcon,
	LayersIcon,
	MailIcon,
	MessageCircleIcon,
	QrCodeIcon,
	SendIcon,
	Share2Icon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
	ShareSheet,
	ShareSheetAction,
	ShareSheetActions,
	ShareSheetContent,
	ShareSheetFooter,
	ShareSheetHeader,
	ShareSheetLink,
	type ShareSheetPlacement,
	ShareSheetTarget,
	ShareSheetTargets,
	ShareSheetTrigger,
	type ShareSheetVariant,
} from "@/registry/components/share-sheet/share-sheet";

const BASE_URL = "https://tentui.com/components/share-sheet";
const VARIANTS: Array<{ value: ShareSheetVariant; label: string }> = [
	{ value: "surface", label: "Surface" },
	{ value: "glass", label: "Glass" },
	{ value: "minimal", label: "Minimal" },
];
const PLACEMENTS: Array<{ value: ShareSheetPlacement; label: string }> = [
	{ value: "auto", label: "Auto" },
	{ value: "popover", label: "Popover" },
	{ value: "sheet", label: "Sheet" },
];

function XGlyph() {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	);
}

function SlackGlyph() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect width="3" height="8" x="13" y="2" rx="1.5" />
			<path d="M19 8.5V10h1.5A1.5 1.5 0 1 0 19 8.5" />
			<rect width="3" height="8" x="8" y="14" rx="1.5" />
			<path d="M5 15.5V14H3.5A1.5 1.5 0 1 0 5 15.5" />
			<rect width="8" height="3" x="14" y="13" rx="1.5" />
			<path d="M15.5 19H14v1.5a1.5 1.5 0 1 0 1.5-1.5" />
			<rect width="8" height="3" x="2" y="8" rx="1.5" />
			<path d="M8.5 5H10V3.5A1.5 1.5 0 1 0 8.5 5" />
		</svg>
	);
}

function ShareSheetDemo() {
	const [variant, setVariant] = useState<ShareSheetVariant>("surface");
	const [placement, setPlacement] = useState<ShareSheetPlacement>("auto");
	const [includeAnchor, setIncludeAnchor] = useState(false);
	const [lastEvent, setLastEvent] = useState("Click Share to open the sheet");

	const shareUrl = includeAnchor ? `${BASE_URL}#api-reference` : BASE_URL;

	return (
		<div className="flex w-full max-w-md flex-col items-center gap-5 px-2 py-4">
			{/* Compact surface & placement toggles */}
			<div className="flex flex-wrap items-center justify-center gap-2">
				<div
					role="group"
					aria-label="Surface variant"
					className="inline-flex items-center rounded-full border border-border/80 bg-muted/40 p-0.5"
				>
					{VARIANTS.map((item) => (
						<button
							key={item.value}
							type="button"
							onClick={() => setVariant(item.value)}
							aria-pressed={variant === item.value}
							className={cn(
								"cursor-pointer rounded-full px-2.5 py-1 font-medium text-[11.5px] outline-none transition-[background-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-ring/60",
								variant === item.value
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{item.label}
						</button>
					))}
				</div>

				<div
					role="group"
					aria-label="Placement mode"
					className="inline-flex items-center rounded-full border border-border/80 bg-muted/40 p-0.5"
				>
					{PLACEMENTS.map((item) => (
						<button
							key={item.value}
							type="button"
							onClick={() => setPlacement(item.value)}
							aria-pressed={placement === item.value}
							className={cn(
								"cursor-pointer rounded-full px-2.5 py-1 font-medium text-[11.5px] outline-none transition-[background-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-ring/60",
								placement === item.value
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{item.label}
						</button>
					))}
				</div>
			</div>

			{/* Sample resource card hosting the trigger */}
			<div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-3.5 shadow-xs">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/60 text-foreground">
						<LayersIcon className="size-4.5" aria-hidden="true" />
					</div>
					<div className="min-w-0">
						<p className="truncate font-semibold text-foreground text-sm tracking-[-0.015em]">
							Design System v4
						</p>
						<p className="truncate text-muted-foreground text-xs">
							Updated 12m ago · 48 tokens
						</p>
					</div>
				</div>

				<ShareSheet
					url={shareUrl}
					title="Design System v4"
					text="Explore the latest tokens and interactive components."
					variant={variant}
					placement={placement}
					side="bottom"
					align="end"
				>
					<ShareSheetTrigger className="h-8.5 shrink-0 px-3.5 text-[13px]">
						<Share2Icon className="size-3.5" aria-hidden="true" />
						Share
					</ShareSheetTrigger>

					<ShareSheetContent>
						<ShareSheetHeader
							title="Design System v4"
							subtitle={
								includeAnchor
									? "Section · #api-reference"
									: "Design system · 48 tokens"
							}
							thumbnail={<LayersIcon className="size-4" />}
							badge={
								<span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 font-medium text-[10px] text-emerald-700 leading-none dark:text-emerald-300">
									Public
								</span>
							}
						/>

						<ShareSheetLink
							onCopy={(copiedUrl) =>
								setLastEvent(`Copied ${copiedUrl.replace(/^https?:\/\//, "")}`)
							}
						/>

						<ShareSheetTargets>
							<ShareSheetTarget
								label="Messages"
								feedbackLabel="Sent"
								icon={<MessageCircleIcon />}
								accentClassName="bg-emerald-500/12 text-emerald-700 border-emerald-500/20 dark:bg-emerald-400/12 dark:text-emerald-300 dark:border-emerald-400/20"
								onSelect={() => setLastEvent("Shared via Messages")}
							/>
							<ShareSheetTarget
								label="Slack"
								feedbackLabel="Shared"
								icon={<SlackGlyph />}
								accentClassName="bg-violet-500/12 text-violet-700 border-violet-500/20 dark:bg-violet-400/12 dark:text-violet-300 dark:border-violet-400/20"
								onSelect={() => setLastEvent("Shared to Slack channel")}
							/>
							<ShareSheetTarget
								label="X"
								feedbackLabel="Ready"
								icon={<XGlyph />}
								onSelect={() => setLastEvent("Prepared post for X")}
							/>
							<ShareSheetTarget
								label="Mail"
								feedbackLabel="Drafted"
								icon={<MailIcon />}
								accentClassName="bg-sky-500/12 text-sky-700 border-sky-500/20 dark:bg-sky-400/12 dark:text-sky-300 dark:border-sky-400/20"
								onSelect={() => setLastEvent("Opened email draft")}
							/>
							<ShareSheetTarget
								label="AirDrop"
								feedbackLabel="Ready"
								icon={<SendIcon />}
								accentClassName="bg-amber-500/12 text-amber-700 border-amber-500/20 dark:bg-amber-400/12 dark:text-amber-300 dark:border-amber-400/20"
								onSelect={() => setLastEvent("AirDrop discovery ready")}
							/>
							<ShareSheetTarget
								label="QR Code"
								feedbackLabel="Copied"
								icon={<QrCodeIcon />}
								onSelect={() => setLastEvent("Copied QR link")}
							/>
						</ShareSheetTargets>

						<ShareSheetActions>
							<ShareSheetAction
								icon={<FileTextIcon />}
								feedbackLabel="Copied"
								shortcut="⌘M"
								onSelect={({ title, url }) => {
									if (url && navigator.clipboard?.writeText) {
										void navigator.clipboard
											.writeText(`[${title ?? "Link"}](${url})`)
											.catch(() => {});
									}
									setLastEvent("Copied Markdown link");
								}}
							>
								Copy Markdown
							</ShareSheetAction>
							<ShareSheetAction
								icon={<HashIcon />}
								active={includeAnchor}
								description={includeAnchor ? "#api-reference" : "Off"}
								onSelect={() => {
									setIncludeAnchor((prev) => {
										const next = !prev;
										setLastEvent(
											next
												? "Included section anchor in link"
												: "Removed section anchor",
										);
										return next;
									});
								}}
							>
								Include section anchor
							</ShareSheetAction>
							<ShareSheetAction
								icon={<Code2Icon />}
								feedbackLabel="Copied"
								onSelect={({ url }) => {
									if (url && navigator.clipboard?.writeText) {
										void navigator.clipboard
											.writeText(`<iframe src="${url}" />`)
											.catch(() => {});
									}
									setLastEvent("Copied embed snippet");
								}}
							>
								Copy embed snippet
							</ShareSheetAction>
						</ShareSheetActions>

						<ShareSheetFooter>
							<span className="inline-flex items-center gap-1.5">
								<GlobeIcon className="size-3" aria-hidden="true" />
								Anyone with the link can view
							</span>
							<span className="font-mono text-[10.5px] opacity-75">
								{placement === "auto" ? "Adaptive" : placement}
							</span>
						</ShareSheetFooter>
					</ShareSheetContent>
				</ShareSheet>
			</div>

			{/* Quiet live feedback line */}
			<p
				aria-live="polite"
				className="h-4 text-center text-muted-foreground text-xs"
			>
				{lastEvent}
			</p>
		</div>
	);
}

export default ShareSheetDemo;
