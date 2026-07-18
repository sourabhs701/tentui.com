"use client";

import { cn } from "@tentui.com/ui/lib/utils";
import { DownloadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { copyText } from "@/utils/copy";

import { getTentUiMarkSVG, TentUiMark } from "./tentui-mark";

type MenuPosition = {
	x: number;
	y: number;
};

export function BrandContextMenu({ children }: { children: React.ReactNode }) {
	const [position, setPosition] = useState<MenuPosition | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const copyButtonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!position) return;

		const closeMenu = (event: PointerEvent) => {
			if (!menuRef.current?.contains(event.target as Node)) {
				setPosition(null);
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setPosition(null);
		};

		const focusMenu = requestAnimationFrame(() =>
			copyButtonRef.current?.focus(),
		);

		document.addEventListener("pointerdown", closeMenu);
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			cancelAnimationFrame(focusMenu);
			document.removeEventListener("pointerdown", closeMenu);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [position]);

	const copyMark = async () => {
		setPosition(null);

		const copied = await copyText(getTentUiMarkSVG());
		if (copied) {
			toast.success("TentUI mark copied as SVG");
			return;
		}

		toast.error("Unable to copy the TentUI mark");
	};

	const downloadMark = () => {
		setPosition(null);

		const downloadUrl = URL.createObjectURL(
			new Blob([getTentUiMarkSVG()], { type: "image/svg+xml" }),
		);
		const downloadLink = document.createElement("a");
		downloadLink.href = downloadUrl;
		downloadLink.download = "tentui-mark.svg";
		downloadLink.click();
		URL.revokeObjectURL(downloadUrl);
	};

	return (
		<>
			<span
				className="select-none"
				onContextMenu={(event) => {
					event.preventDefault();
					setPosition({
						x: Math.max(8, Math.min(event.clientX, window.innerWidth - 192)),
						y: Math.max(8, Math.min(event.clientY, window.innerHeight - 96)),
					});
				}}
			>
				{children}
			</span>

			{position && (
				<div
					ref={menuRef}
					role="menu"
					className={cn(
						"fixed z-50 min-w-44 rounded-xl bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10",
						"fade-in-0 zoom-in-95 animate-in duration-100",
					)}
					style={{ left: position.x, top: position.y }}
				>
					<button
						ref={copyButtonRef}
						type="button"
						role="menuitem"
						onClick={() => void copyMark()}
						className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-hidden hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
					>
						<TentUiMark className="size-4" />
						Copy mark as SVG
					</button>

					<button
						type="button"
						role="menuitem"
						onClick={downloadMark}
						className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-hidden hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
					>
						<DownloadIcon className="size-4" />
						Download mark as SVG
					</button>
				</div>
			)}
		</>
	);
}

export default BrandContextMenu;
