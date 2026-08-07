"use client";

import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import type { ComponentCaptureTheme } from "@/lib/component-capture";
import { cn } from "@/lib/utils";

function afterTwoFrames() {
	return new Promise<void>((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
}

async function waitForImages(root: HTMLElement) {
	const images = Array.from(root.querySelectorAll("img"));
	await Promise.all(
		images.map(async (image) => {
			if (!image.complete) {
				await new Promise<void>((resolve) => {
					image.addEventListener("load", () => resolve(), { once: true });
					image.addEventListener("error", () => resolve(), { once: true });
				});
			}

			await image.decode().catch(() => undefined);
		}),
	);
}

async function waitForFiniteAnimations(root: HTMLElement) {
	const animations = root
		.getAnimations({ subtree: true })
		.filter((animation) =>
			Number.isFinite(animation.effect?.getComputedTiming().endTime),
		);

	await Promise.all(
		animations.map((animation) => animation.finished.catch(() => undefined)),
	);
}

export function ComponentCaptureStage({
	children,
	className,
	minHeight,
	name,
	theme,
	width,
}: {
	children: ReactNode;
	className?: string;
	minHeight: number;
	name: string;
	theme: ComponentCaptureTheme;
	width: number;
}) {
	const stageRef = useRef<HTMLDivElement>(null);
	const [ready, setReady] = useState(false);

	useLayoutEffect(() => {
		const root = document.documentElement;
		root.classList.remove("light", "dark");
		root.classList.add(theme);
		root.style.colorScheme = theme;
		localStorage.setItem("theme", theme);
	}, [theme]);

	useEffect(() => {
		let cancelled = false;
		setReady(false);

		async function markReady() {
			const stage = stageRef.current;
			if (!stage) return;

			await document.fonts.ready;
			await waitForImages(stage);
			await afterTwoFrames();
			await waitForFiniteAnimations(stage);
			await afterTwoFrames();

			if (!cancelled) setReady(true);
		}

		void markReady();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div
			ref={stageRef}
			data-component-capture={name}
			data-capture-ready={ready ? "true" : "false"}
			data-capture-theme={theme}
			className={cn(
				"style-preview box-border flex items-center justify-center overflow-hidden bg-background text-foreground",
				className,
			)}
			style={{ minHeight, width }}
		>
			{children}
		</div>
	);
}
