"use client";

import {
	Code2Icon,
	FileTextIcon,
	MailIcon,
	MessageCircleIcon,
	SendIcon,
	Share2Icon,
	SparklesIcon,
} from "lucide-react";
import { useRef } from "react";

import {
	ShareSheet,
	ShareSheetAction,
	ShareSheetActions,
	ShareSheetContent,
	ShareSheetHeader,
	ShareSheetLink,
	ShareSheetTarget,
	ShareSheetTargets,
	ShareSheetTrigger,
} from "@/registry/components/share-sheet/share-sheet";

const SHARE_URL = "https://tentui.com/components/share-sheet";

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

/** `defaultOpen` defaults to true for docs & stills; motion captures pass false. */
function ShareSheetPreview({ defaultOpen = true }: { defaultOpen?: boolean }) {
	const stageRef = useRef<HTMLDivElement>(null);

	return (
		<div
			ref={stageRef}
			className="relative flex h-[360px] w-full max-w-[460px] flex-col items-center justify-start overflow-hidden pt-4"
		>
			<ShareSheet
				defaultOpen={defaultOpen}
				url={SHARE_URL}
				title="TentUI Share Sheet"
				placement="popover"
				side="bottom"
				align="center"
				sideOffset={10}
				modal={false}
			>
				<ShareSheetTrigger className="h-9 px-4 text-[13px]">
					<Share2Icon className="size-3.5" aria-hidden="true" />
					Share
				</ShareSheetTrigger>

				<ShareSheetContent
					container={stageRef}
					className="w-[min(332px,calc(100%-24px))] gap-2.5 p-3"
				>
					<ShareSheetHeader
						title="TentUI Share Sheet"
						subtitle="Component · Anyone with the link"
						thumbnail={<SparklesIcon className="size-4 text-foreground/80" />}
					/>

					<ShareSheetLink />

					<ShareSheetTargets>
						<ShareSheetTarget
							label="Messages"
							feedbackLabel="Sent"
							icon={<MessageCircleIcon />}
							accentClassName="bg-emerald-500/12 text-emerald-700 border-emerald-500/20 dark:bg-emerald-400/12 dark:text-emerald-300 dark:border-emerald-400/20"
						/>
						<ShareSheetTarget
							label="Slack"
							feedbackLabel="Shared"
							icon={<SlackGlyph />}
							accentClassName="bg-violet-500/12 text-violet-700 border-violet-500/20 dark:bg-violet-400/12 dark:text-violet-300 dark:border-violet-400/20"
						/>
						<ShareSheetTarget
							label="X"
							feedbackLabel="Opened"
							icon={<XGlyph />}
						/>
						<ShareSheetTarget
							label="Mail"
							feedbackLabel="Drafted"
							icon={<MailIcon />}
							accentClassName="bg-sky-500/12 text-sky-700 border-sky-500/20 dark:bg-sky-400/12 dark:text-sky-300 dark:border-sky-400/20"
						/>
						<ShareSheetTarget
							label="AirDrop"
							feedbackLabel="Ready"
							icon={<SendIcon />}
							accentClassName="bg-amber-500/12 text-amber-700 border-amber-500/20 dark:bg-amber-400/12 dark:text-amber-300 dark:border-amber-400/20"
						/>
					</ShareSheetTargets>

					<ShareSheetActions>
						<ShareSheetAction
							icon={<FileTextIcon />}
							feedbackLabel="Copied"
							shortcut="⌘M"
							className="min-h-[36px] py-1.5 text-[12.5px]"
							onSelect={({ title, url }) => {
								if (url && navigator.clipboard?.writeText) {
									void navigator.clipboard
										.writeText(`[${title ?? "Link"}](${url})`)
										.catch(() => {});
								}
							}}
						>
							Copy Markdown
						</ShareSheetAction>
						<ShareSheetAction
							icon={<Code2Icon />}
							feedbackLabel="Copied"
							className="min-h-[36px] py-1.5 text-[12.5px]"
							onSelect={({ url }) => {
								if (url && navigator.clipboard?.writeText) {
									void navigator.clipboard
										.writeText(`<iframe src="${url}" />`)
										.catch(() => {});
								}
							}}
						>
							Copy embed snippet
						</ShareSheetAction>
					</ShareSheetActions>
				</ShareSheetContent>
			</ShareSheet>
		</div>
	);
}

export default ShareSheetPreview;
