"use client";

import { Button } from "@tentui.com/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@tentui.com/ui/components/dropdown-menu";
import { EllipsisIcon, LinkIcon, ShareIcon } from "lucide-react";
import { toast } from "sonner";
import { LinkedInIcon, XIcon } from "@/components/icons";
import { TOOLBAR_HIT_AREA, TOOLBAR_PRESS } from "@/lib/toolbar-button";
import { cn } from "@/lib/utils";
import { copyText } from "@/utils/copy";

export function DocShareMenu({ title, url }: { title: string; url: string }) {
	const absoluteUrl = url.startsWith("http")
		? url
		: typeof window !== "undefined"
			? new URL(url, window.location.origin).toString()
			: url;

	const urlEncoded = encodeURIComponent(absoluteUrl);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						className={cn(TOOLBAR_PRESS, TOOLBAR_HIT_AREA)}
						variant="secondary"
						size="icon-sm"
						aria-label="Share page"
					>
						<ShareIcon />
					</Button>
				}
			/>

			<DropdownMenuContent
				className="w-fit"
				align="start"
				alignOffset={-6}
				finalFocus={false}
			>
				<DropdownMenuItem
					onClick={() => {
						copyText(absoluteUrl);
						toast.success("Link copied");
					}}
				>
					<LinkIcon />
					Copy link
				</DropdownMenuItem>

				<DropdownMenuItem
					render={
						<a
							href={`https://x.com/intent/tweet?url=${urlEncoded}`}
							target="_blank"
							rel="noopener"
						>
							<XIcon />
							Share on X
						</a>
					}
				/>

				<DropdownMenuItem
					render={
						<a
							href={`https://www.linkedin.com/sharing/share-offsite?url=${urlEncoded}`}
							target="_blank"
							rel="noopener"
						>
							<LinkedInIcon />
							Share on LinkedIn
						</a>
					}
				/>

				{typeof navigator !== "undefined" && "share" in navigator && (
					<DropdownMenuItem
						closeOnClick={false}
						onClick={() => {
							navigator.share({ title, url: absoluteUrl }).catch(() => {});
						}}
					>
						<EllipsisIcon />
						Other app
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
