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
						className="size-11 touch-manipulation border-none transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:size-7"
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
