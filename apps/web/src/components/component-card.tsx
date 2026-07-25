import { motion } from "motion/react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { RegistryItem } from "shadcn/schema";

const themes = ["light", "dark"] as const;

// ─── Component Card ────────────────────────────────────────────────────────
export function ComponentCard({
	component,
	index,
}: {
	component: RegistryItem;
	index: number;
}) {
	const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
	const [isHovered, setIsHovered] = useState(false);
	const imageBase =
		typeof component.meta?.image === "string"
			? encodeURI(component.meta.image)
			: undefined;
	const videoBase =
		typeof component.meta?.video === "string"
			? encodeURI(component.meta.video)
			: undefined;

	const startPreview = () => {
		setIsHovered(true);
		for (const video of videoRefs.current) {
			if (video) void video.play().catch(() => {});
		}
	};

	const stopPreview = () => {
		setIsHovered(false);
		for (const video of videoRefs.current) {
			if (!video) continue;
			video.pause();
			video.currentTime = 0;
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: 0.3,
				delay: 0.02 * index,
				ease: "easeOut",
			}}
		>
			<Link
				href={`/components/${component.name}` as Route}
				onMouseEnter={startPreview}
				onMouseLeave={stopPreview}
				onFocus={startPreview}
				onBlur={stopPreview}
				className="group relative flex flex-col overflow-hidden rounded-xl border bg-muted shadow-card transition-all duration-300"
			>
				{/* ── Expandable hover info (upper side) ── */}
				<motion.div
					initial={false}
					animate={{
						height: isHovered ? 32 : 0,
						opacity: isHovered ? 1 : 0,
					}}
					transition={{
						duration: 0.5,
						ease: [0.22, 1, 0.36, 1],
					}}
					className="overflow-hidden"
				>
					<div className="px-4 pt-3 pb-1">
						<div className="flex items-center justify-between">
							<span className="text-xs text-zinc-400">
								{component.title ?? component.name}
							</span>
							<span className="flex items-center gap-1 font-medium text-xs text-zinc-500 dark:text-zinc-400">
								View component
								<svg
									width="12"
									height="12"
									viewBox="0 0 12 12"
									fill="none"
									className="transition-transform duration-200 group-hover:translate-x-0.5"
								>
									<path
										d="M5 2L9 6L5 10"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</span>
						</div>
					</div>
				</motion.div>

				{/* ── Preview area (Floating) ── */}
				<div className="p-0">
					<motion.div
						initial={false}
						animate={{ height: isHovered ? 228 : 260 }}
						transition={{
							duration: 0.5,
							ease: [0.22, 1, 0.36, 1],
						}}
						className="relative w-full overflow-hidden rounded-xl bg-background shadow-surface-inset transition-colors"
					>
						{videoBase &&
							themes.map((theme, index) => (
								<video
									key={theme}
									ref={(video) => {
										videoRefs.current[index] = video;
									}}
									src={`${videoBase}-${theme}.mp4`}
									poster={imageBase ? `${imageBase}-${theme}.webp` : undefined}
									muted
									loop
									playsInline
									preload="metadata"
									className={`absolute inset-0 size-full object-cover ${theme === "light" ? "block dark:hidden" : "hidden dark:block"}`}
								/>
							))}

						{imageBase &&
							themes.map((theme) => (
								<Image
									key={theme}
									src={`${imageBase}-${theme}.webp`}
									alt={`${component.title ?? component.name} ${theme} preview`}
									fill
									sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
									className={`absolute inset-0 size-full object-cover transition-all duration-300 group-hover:scale-105 ${videoBase ? "group-hover:opacity-0" : ""} ${theme === "light" ? "block dark:hidden" : "hidden dark:block"}`}
									unoptimized
								/>
							))}
						{!videoBase && !imageBase && (
							<div className="flex items-center justify-center p-4">
								<p className="text-muted-foreground text-sm">
									{component.title ?? component.name}
								</p>
							</div>
						)}
					</motion.div>
				</div>
			</Link>
		</motion.div>
	);
}
