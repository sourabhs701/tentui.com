"use client";

import { DownloadIcon, TypeIcon } from "lucide-react";
import type { ReactElement } from "react";
import { toast } from "sonner";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";

export type BrandAsset = {
	name: string;
	path: string;
	filename: string;
};

export const BRAND_MARK_ASSET = {
	name: "Mark",
	path: "/brand/mark-brand.svg",
	filename: "tentui-mark.svg",
} as const satisfies BrandAsset;

export const BRAND_LOGOTYPE_ASSET = {
	name: "Logotype",
	path: "/brand/LogoType.svg",
	filename: "tentui-logotype.svg",
} as const satisfies BrandAsset;

export const BRAND_ASSETS = [
	{
		name: "Logo",
		path: "/brand/Logo.svg",
		filename: "tentui-logo.svg",
	},
	BRAND_LOGOTYPE_ASSET,
	BRAND_MARK_ASSET,
	{
		name: "Mark for light backgrounds",
		path: "/brand/mark-light.svg",
		filename: "tentui-mark-light.svg",
	},
	{
		name: "Mark for dark backgrounds",
		path: "/brand/Mark-dark.svg",
		filename: "tentui-mark-dark.svg",
	},
] as const satisfies readonly BrandAsset[];

export type BrandContextMenuProps = {
	children: ReactElement;
	markAsset?: BrandAsset;
	logotypeAsset?: BrandAsset;
	brandAssetsZipPath?: string;
};

async function fetchAsset(asset: BrandAsset) {
	const response = await fetch(asset.path);

	if (!response.ok) {
		throw new Error(`Could not load ${asset.name.toLowerCase()}.`);
	}

	return response;
}

async function copyAsset(asset: BrandAsset) {
	try {
		const response = await fetchAsset(asset);
		await navigator.clipboard.writeText(await response.text());
		toast.success(`${asset.name} copied`, {
			description: "SVG copied to clipboard.",
		});
	} catch {
		toast.error("Copy failed", {
			description: `Could not copy the ${asset.name.toLowerCase()}.`,
		});
	}
}

function BrandMarkIcon() {
	return (
		<svg
			aria-hidden="true"
			fill="none"
			viewBox="0 0 89 76"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path d="M5.933 76H0V63.62h5.933V76Z" fill="currentColor" />
			<path
				clipRule="evenodd"
				d="M65.267 6.534H71.2v6.19h5.933v6.19h5.934v6.362h5.768V56.57h-5.768v7.05h-5.934V44.362H71.2v18.914h-5.933V76h-5.934V44.362H53.4v18.914h-5.933V76h-5.934V63.276H35.6V44.362h-5.933V76h-5.934V63.276H17.8V44.362h-5.933V63.62H5.933v-7.05H.165V25.276h5.768v-6.362h5.934v-6.19H17.8v-6.19h5.933V0h41.534v6.534ZM17.8 25.448h5.933v-6.534H17.8v6.534Zm47.467 0H71.2v-6.534h-5.933v6.534Z"
				fill="currentColor"
				fillRule="evenodd"
			/>
			<path d="M89 76h-5.933V63.62H89V76Z" fill="currentColor" />
		</svg>
	);
}

export function BrandContextMenu({
	children,
	markAsset = BRAND_MARK_ASSET,
	logotypeAsset = BRAND_LOGOTYPE_ASSET,
	brandAssetsZipPath = "/brand/tentui-brand-assets.zip",
}: BrandContextMenuProps) {
	return (
		<ContextMenu>
			<ContextMenuTrigger render={children} />
			<ContextMenuContent className="w-60 rounded-xl p-1.5">
				<ContextMenuGroup>
					<ContextMenuItem
						className="h-9 rounded-lg px-2.5"
						onClick={() => void copyAsset(markAsset)}
					>
						<BrandMarkIcon />
						Copy Mark as SVG
					</ContextMenuItem>
					<ContextMenuItem
						className="h-9 rounded-lg px-2.5"
						onClick={() => void copyAsset(logotypeAsset)}
					>
						<TypeIcon />
						Copy Logotype as SVG
					</ContextMenuItem>
				</ContextMenuGroup>
				<ContextMenuSeparator />
				<ContextMenuGroup>
					<ContextMenuItem
						render={
							<a download href={brandAssetsZipPath}>
								<DownloadIcon />
								Download Brand Assets
							</a>
						}
						className="h-9 rounded-lg px-2.5"
					/>
				</ContextMenuGroup>
			</ContextMenuContent>
		</ContextMenu>
	);
}

export default BrandContextMenu;
