"use client";

import { type ComponentProps, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export interface AsciiWordmarkProps
	extends Omit<ComponentProps<"div">, "children"> {
	/** Word sampled into the particle field. */
	word?: string;
	/** Base color used by the ASCII glyph ramp. */
	inkColor?: string;
}

export function AsciiWordmark({
	word = "VAULT",
	inkColor = "#8278ff",
	className,
	"aria-label": ariaLabel,
	...props
}: AsciiWordmarkProps) {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const hostElement = hostRef.current;
		if (!hostElement) return;

		let disposed = false;
		let instance: {
			dispose: () => void;
			mount: () => boolean;
			start: () => void;
		} | null = null;

		async function mount(target: HTMLDivElement) {
			try {
				const { AsciiWordmarkRenderer } = await import("./renderer");
				if (disposed) return;

				instance = new AsciiWordmarkRenderer(target, { word, inkColor });
				if (instance.mount()) {
					instance.start();
				} else {
					instance.dispose();
					target.dataset.webgl = "unsupported";
				}
			} catch {
				instance?.dispose();
				target.dataset.webgl = "unsupported";
			}
		}

		void mount(hostElement);

		return () => {
			disposed = true;
			instance?.dispose();
		};
	}, [inkColor, word]);

	return (
		<div
			{...props}
			aria-label={ariaLabel ?? `${word} ASCII particle wordmark`}
			className={cn(
				"relative isolate block aspect-[16/5] min-h-48 w-full overflow-hidden",
				className,
			)}
			data-slot="ascii-wordmark"
			ref={hostRef}
			role="img"
		/>
	);
}

export default AsciiWordmark;
