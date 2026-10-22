"use client";

import { Button } from "@tentui.com/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@tentui.com/ui/components/tooltip";
import { ImageIcon } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
	HEADER_SPONSOR,
	type HeaderSponsor as HeaderSponsorBrand,
	sponsorHref,
} from "@/config/sponsor";
import { cn } from "@/lib/utils";

export function HeaderSponsor() {
	return (
		<div className="flex items-center gap-1.5">
			<OpenSponsorSlot />
			{HEADER_SPONSOR ? <SponsoredMark sponsor={HEADER_SPONSOR} /> : null}
		</div>
	);
}

function SponsoredMark({ sponsor }: { sponsor: HeaderSponsorBrand }) {
	const label = `Sponsored by ${sponsor.name}`;

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						nativeButton={false}
						variant="outline"
						size="icon-sm"
						className="border-border bg-background p-1 hover:bg-muted"
						render={
							<a
								href={sponsorHref(sponsor.href)}
								target="_blank"
								rel="sponsored noopener noreferrer"
								aria-label={label}
							>
								<Image
									src={sponsor.logoSrc}
									alt=""
									width={24}
									height={24}
									unoptimized
									draggable={false}
									className={cn(
										"size-full object-contain",
										sponsor.logoDarkSrc && "dark:hidden",
									)}
								/>
								{sponsor.logoDarkSrc ? (
									<Image
										src={sponsor.logoDarkSrc}
										alt=""
										width={24}
										height={24}
										unoptimized
										draggable={false}
										className="hidden size-full object-contain dark:block"
									/>
								) : null}
							</a>
						}
					/>
				}
			/>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function OpenSponsorSlot() {
	const pathname = usePathname();
	const current = pathname === "/sponsor";

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						nativeButton={false}
						variant="outline"
						size="icon-sm"
						className={cn(
							"border-dashed text-muted-foreground",
							current && "border-foreground/40 bg-muted text-foreground",
						)}
						render={
							<Link
								href={"/sponsor" as Route}
								aria-label="Sponsor TentUI"
								aria-current={current ? "page" : undefined}
							>
								<ImageIcon className="size-[18px]" />
							</Link>
						}
					/>
				}
			/>
			<TooltipContent>Sponsor TentUI</TooltipContent>
		</Tooltip>
	);
}
