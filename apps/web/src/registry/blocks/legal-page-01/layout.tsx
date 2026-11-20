"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	type MouseEvent,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";

import PrivacyPolicyPage from "./privacy/page";

const LEGAL_PAGES = [{ title: "Privacy", href: "/privacy" }] as const;

/** Distance from the top of the viewport at which a heading becomes "active". */
const ACTIVE_OFFSET = 128;

const CORNER_POSITIONS = {
	topLeft: "-top-2 -left-2",
	topRight: "-top-2 -right-2",
	bottomLeft: "-bottom-2 -left-2",
	bottomRight: "-right-2 -bottom-2",
} as const;

interface TocItem {
	id: string;
	title: string;
}

function CornerMark({ position }: { position: keyof typeof CORNER_POSITIONS }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute z-10 flex size-4 items-center justify-center text-border",
				CORNER_POSITIONS[position],
			)}
		>
			<span className="absolute h-px w-full bg-current" />
			<span className="absolute h-full w-px bg-current" />
		</span>
	);
}

/**
 * Builds the table of contents from headings rendered inside `contentRef`
 * (any element with an `id` and a `data-toc` label) and tracks which one is
 * currently in view.
 */
function useTableOfContents(contentRef: RefObject<HTMLElement | null>) {
	const pathname = usePathname();
	const [items, setItems] = useState<TocItem[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const scrollLock = useRef<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-scan headings whenever the route changes.
	useEffect(() => {
		const headings =
			contentRef.current?.querySelectorAll<HTMLElement>("[data-toc][id]") ?? [];
		setItems(
			Array.from(headings, (heading) => ({
				id: heading.id,
				title: heading.dataset.toc || heading.textContent || heading.id,
			})),
		);
	}, [contentRef, pathname]);

	useEffect(() => {
		if (items.length === 0) return;

		let frame = 0;
		const update = () => {
			frame = 0;
			if (scrollLock.current) return;

			const root = document.documentElement;
			const atBottom =
				window.innerHeight + window.scrollY >= root.scrollHeight - 2;
			let current = items[0].id;

			if (atBottom) {
				current = items[items.length - 1].id;
			} else {
				for (const item of items) {
					const element = document.getElementById(item.id);
					if (element && element.getBoundingClientRect().top <= ACTIVE_OFFSET) {
						current = item.id;
					}
				}
			}
			setActiveId(current);
		};
		const onScroll = () => {
			if (!frame) frame = window.requestAnimationFrame(update);
		};

		update();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);
		return () => {
			if (frame) window.cancelAnimationFrame(frame);
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
		};
	}, [items]);

	const scrollTo = useCallback((id: string) => {
		const target = document.getElementById(id);
		if (!target) return false;

		const reduceMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		// Hold the highlight on the clicked item while the smooth scroll runs.
		scrollLock.current = id;
		setActiveId(id);
		const release = () => {
			scrollLock.current = null;
			window.removeEventListener("scrollend", release);
		};
		window.addEventListener("scrollend", release, { once: true });
		window.setTimeout(release, reduceMotion ? 50 : 1000);

		target.scrollIntoView({
			behavior: reduceMotion ? "auto" : "smooth",
			block: "start",
		});
		if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
		target.focus({ preventScroll: true });
		window.history.replaceState(null, "", `#${id}`);
		return true;
	}, []);

	return { items, activeId, scrollTo };
}

interface TocLinksProps {
	items: TocItem[];
	activeId: string | null;
	onNavigate: (event: MouseEvent<HTMLAnchorElement>, id: string) => void;
	className?: string;
}

function TocLinks({ items, activeId, onNavigate, className }: TocLinksProps) {
	return (
		<ol className={cn("flex flex-col border-border border-l", className)}>
			{items.map((item) => {
				const isActive = item.id === activeId;

				return (
					<li key={item.id}>
						<a
							aria-current={isActive ? "location" : undefined}
							className={cn(
								"-ml-px block rounded-r-sm border-l py-1.5 pr-2 pl-3 text-xs leading-snug outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none",
								isActive
									? "border-foreground font-medium text-foreground"
									: "border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
							)}
							href={`#${item.id}`}
							onClick={(event) => onNavigate(event, item.id)}
						>
							{item.title}
						</a>
					</li>
				);
			})}
		</ol>
	);
}

function useActivePage() {
	const pathname = usePathname() ?? "";
	return (
		LEGAL_PAGES.find((page) => pathname.endsWith(page.href))?.href ??
		LEGAL_PAGES[0].href
	);
}

function LegalNavigation({ toc }: { toc: ReactNode }) {
	const activeHref = useActivePage();

	return (
		<nav
			aria-label="Legal"
			className="py-8 md:sticky md:top-0 md:max-h-svh md:overflow-y-auto md:py-12"
		>
			<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.32em]">
				Legal
			</p>
			<ul className="mt-4 flex flex-wrap gap-1 md:mt-6 md:flex-col md:flex-nowrap md:gap-0.5">
				{LEGAL_PAGES.map((page) => {
					const isActive = page.href === activeHref;
					const itemClassName =
						"relative flex items-center rounded-sm px-3 py-2 font-mono text-[13px] tracking-tight md:rounded-none md:py-1.5 md:pr-2 md:pl-4";

					return (
						<li className="md:w-full" key={page.href}>
							{isActive ? (
								<span
									aria-current="page"
									className={cn(
										itemClassName,
										"bg-primary/10 text-primary before:absolute before:inset-y-0 before:left-0 before:hidden before:w-px before:bg-primary md:before:block",
									)}
								>
									{page.title}
								</span>
							) : (
								<Link
									className={cn(
										itemClassName,
										"text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
									)}
									href={page.href}
								>
									{page.title}
								</Link>
							)}
							{isActive ? toc : null}
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

function MobileToc({
	items,
	activeId,
	onNavigate,
}: Omit<TocLinksProps, "className">) {
	const detailsRef = useRef<HTMLDetailsElement>(null);
	const activeTitle =
		items.find((item) => item.id === activeId)?.title ?? items[0]?.title;

	if (items.length === 0) return null;

	return (
		<nav
			aria-label="On this page"
			className="sticky top-0 z-20 border-border border-b border-dashed bg-background md:hidden"
		>
			<details
				className="group"
				onKeyDown={(event) => {
					if (event.key === "Escape" && detailsRef.current?.open) {
						detailsRef.current.open = false;
						detailsRef.current.querySelector("summary")?.focus();
					}
				}}
				ref={detailsRef}
			>
				<summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
					<span className="shrink-0 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.24em]">
						On this page
					</span>
					<span className="min-w-0 flex-1 truncate text-foreground text-xs">
						{activeTitle}
					</span>
					<svg
						aria-hidden="true"
						className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
						fill="none"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						viewBox="0 0 24 24"
					>
						<path d="m6 9 6 6 6-6" />
					</svg>
				</summary>
				<div className="max-h-[60svh] overflow-y-auto px-6 pt-1 pb-4">
					<TocLinks
						activeId={activeId}
						items={items}
						onNavigate={(event, id) => {
							if (detailsRef.current) detailsRef.current.open = false;
							onNavigate(event, id);
						}}
					/>
				</div>
			</details>
		</nav>
	);
}

export interface LegalLayoutProps {
	children?: ReactNode;
}

export default function LegalLayout({
	children = <PrivacyPolicyPage />,
}: LegalLayoutProps) {
	const contentRef = useRef<HTMLDivElement>(null);
	const { items, activeId, scrollTo } = useTableOfContents(contentRef);

	const handleNavigate = useCallback(
		(event: MouseEvent<HTMLAnchorElement>, id: string) => {
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}
			if (scrollTo(id)) event.preventDefault();
		},
		[scrollTo],
	);

	return (
		<main className="min-h-svh bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8 lg:py-16">
			<div className="relative mx-auto w-full max-w-6xl border border-border border-dashed">
				<CornerMark position="topLeft" />
				<CornerMark position="topRight" />
				<CornerMark position="bottomLeft" />
				<CornerMark position="bottomRight" />

				<div className="grid grid-cols-1 md:grid-cols-[13rem_minmax(0,1fr)]">
					<aside className="border-border border-b border-dashed px-6 md:border-r md:border-b-0 md:px-5">
						<LegalNavigation
							toc={
								items.length > 0 ? (
									<div className="mt-6 hidden md:block">
										<p className="mb-3 pl-4 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.24em]">
											On this page
										</p>
										<TocLinks
											activeId={activeId}
											className="ml-4"
											items={items}
											onNavigate={handleNavigate}
										/>
									</div>
								) : null
							}
						/>
					</aside>
					<MobileToc
						activeId={activeId}
						items={items}
						onNavigate={handleNavigate}
					/>
					<div
						className="min-w-0 px-6 py-10 md:px-10 md:py-12 lg:px-14"
						ref={contentRef}
					>
						{children}
					</div>
				</div>
			</div>
		</main>
	);
}
