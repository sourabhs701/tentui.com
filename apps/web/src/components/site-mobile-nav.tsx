"use client";

import { cn } from "@tentui.com/ui/lib/utils";
import {
	AnimatePresence,
	LayoutGroup,
	MotionConfig,
	motion,
} from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import CommandMenu from "./command-menu";
import {
	headerCommandBlocks,
	headerCommandComponents,
} from "./site-header-data";
import type { SiteNavItem } from "./site-navigation";

const ease = [0.22, 1, 0.36, 1] as const;

function BurgerIcon({ open }: { open: boolean }) {
	const line = "absolute left-1 h-[2px] w-5 rounded-full bg-current";
	const transition = { duration: 0.3, ease };

	return (
		<span aria-hidden="true" className="relative block size-7">
			<motion.span
				className={line}
				initial={false}
				animate={open ? { top: 13, rotate: 45 } : { top: 7, rotate: 0 }}
				transition={transition}
			/>
			<motion.span
				className={line}
				style={{ top: 13 }}
				initial={false}
				animate={{ opacity: open ? 0 : 1, scaleX: open ? 0.4 : 1 }}
				transition={transition}
			/>
			<motion.span
				className={line}
				initial={false}
				animate={open ? { top: 13, rotate: -45 } : { top: 19, rotate: 0 }}
				transition={transition}
			/>
		</span>
	);
}

export function SiteMobileNav({
	items,
	className,
}: {
	items: readonly SiteNavItem[];
	className?: string;
}) {
	const pathname = usePathname();
	const [open, setOpen] = React.useState(false);
	const [lastPathname, setLastPathname] = React.useState(pathname);
	const [top, setTop] = React.useState(0);
	const buttonRef = React.useRef<HTMLButtonElement>(null);

	// Close the panel whenever the route changes.
	if (pathname !== lastPathname) {
		setLastPathname(pathname);
		setOpen(false);
	}

	React.useEffect(() => {
		if (!open) return;
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") setOpen(false);
		}
		const { overflow } = document.body.style;
		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", onKeyDown);
		return () => {
			document.body.style.overflow = overflow;
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	function toggle() {
		// The panel hangs from the header's bottom edge, wherever the sticky header sits.
		const header = buttonRef.current?.closest("header");
		if (header) setTop(header.getBoundingClientRect().bottom);
		setOpen((v) => !v);
	}

	return (
		<MotionConfig reducedMotion="user">
			{/* 44px hit area; the negative margin keeps the bars on the header's gutter. */}
			<button
				ref={buttonRef}
				type="button"
				aria-label={open ? "Close menu" : "Open menu"}
				aria-expanded={open}
				aria-controls="mobile-menu"
				onClick={toggle}
				className={cn(
					"-mr-2 flex size-11 cursor-pointer items-center justify-center rounded-full text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
					className,
				)}
			>
				<BurgerIcon open={open} />
			</button>

			<AnimatePresence>
				{open && (
					<motion.div
						id="mobile-menu"
						key="mobile-menu"
						initial={{ height: 0 }}
						animate={{ height: `calc(100dvh - ${top}px)` }}
						exit={{ height: 0, transition: { duration: 0.3, ease } }}
						transition={{ duration: 0.4, ease }}
						style={{ top }}
						className="fixed inset-x-0 z-50 overflow-hidden bg-background"
					>
						<motion.div
							initial={{ opacity: 0, filter: "blur(10px)", y: -10 }}
							animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
							exit={{ opacity: 0, filter: "blur(10px)", y: -10 }}
							transition={{ duration: 0.35, delay: 0.05, ease }}
							className="flex h-full flex-col gap-6 overflow-y-auto px-4 pt-4 pb-[env(safe-area-inset-bottom)]"
						>
							<div className="*:data-[slot=command-menu-trigger]:h-11 *:data-[slot=command-menu-trigger]:w-full *:data-[slot=command-menu-trigger]:justify-start *:data-[slot=command-menu-trigger]:rounded-full *:data-[slot=command-menu-trigger]:bg-muted *:data-[slot=command-menu-trigger]:px-4">
								<CommandMenu
									components={headerCommandComponents}
									blocks={headerCommandBlocks}
								/>
							</div>
							<MobileNavLinks items={items} onNavigate={() => setOpen(false)} />
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</MotionConfig>
	);
}

function MobileNavLinks({
	items,
	onNavigate,
}: {
	items: readonly SiteNavItem[];
	onNavigate: () => void;
}) {
	const pathname = usePathname();

	return (
		<nav aria-label="Mobile navigation">
			<LayoutGroup id="mobile-nav">
				<ul className="flex flex-col gap-1">
					{items.map(({ title, href }) => {
						const isActive =
							pathname === href ||
							(href !== "/" && pathname.startsWith(`${href}/`));

						return (
							<li key={href}>
								<Link
									href={href}
									aria-current={isActive ? "page" : undefined}
									onClick={onNavigate}
									className="relative isolate flex h-12 items-center rounded-full px-4 font-medium text-base text-muted-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:text-foreground"
								>
									{/* The pill slides between rows on navigation. */}
									{isActive && (
										<motion.span
											layoutId="mobile-nav-active-pill"
											aria-hidden="true"
											transition={{
												type: "spring",
												duration: 0.35,
												bounce: 0.12,
											}}
											className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-accent"
										/>
									)}
									{title}
								</Link>
							</li>
						);
					})}
				</ul>
			</LayoutGroup>
		</nav>
	);
}
