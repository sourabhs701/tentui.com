"use client";

import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	ComponentSidebar,
	ComponentSidebarContent,
	type ComponentSidebarContentProps,
	ComponentSidebarIcon,
	type ComponentSidebarLinkProps,
} from "@/registry/components/component-sidebar";

const DEFAULT_SIDEBAR_OPEN = true;

// Desktop only. The mobile drawer keeps its own state, so a sidebar left open
// on desktop never comes back as an overlay on a phone.
const sidebarOpenAtom = atomWithStorage(
	"tentui:sidebar-open:v1",
	DEFAULT_SIDEBAR_OPEN,
);

// Tailwind's `lg` breakpoint, where the docked sidebar takes over.
const DESKTOP_QUERY = "(min-width: 64rem)";

export function Sidebar({ children }: { children: React.ReactNode }) {
	return (
		<>
			<DesktopSidebar>{children}</DesktopSidebar>
			<MobileSidebar>{children}</MobileSidebar>
		</>
	);
}

function DesktopSidebar({ children }: { children: React.ReactNode }) {
	const [isOpen, setIsOpen] = useAtom(sidebarOpenAtom);

	return (
		<ComponentSidebar
			className="[--component-sidebar-height:calc(100svh-var(--component-sidebar-top)-var(--fade-bottom-height))] [--component-sidebar-top:calc(var(--header-height)+(--spacing(2)))] *:data-sidebar-open:size-8 max-lg:hidden"
			onOpenChange={setIsOpen}
			open={isOpen}
		>
			{children}
		</ComponentSidebar>
	);
}

function MobileSidebar({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const [open, setOpen] = React.useState(false);
	const [lastPathname, setLastPathname] = React.useState(pathname);

	// Close the drawer whenever the route changes.
	if (pathname !== lastPathname) {
		setLastPathname(pathname);
		setOpen(false);
	}

	// Close it if the viewport grows into the docked layout.
	React.useEffect(() => {
		if (!open) return;
		const query = window.matchMedia(DESKTOP_QUERY);
		const onChange = () => {
			if (query.matches) setOpen(false);
		};
		onChange();
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, [open]);

	return (
		<Sheet onOpenChange={setOpen} open={open}>
			{/* Sits in the gap the pages leave at the top-left on mobile and scrolls
			    with the page, so it never covers content while closed. */}
			<SheetTrigger
				render={
					<Button
						aria-label="Open sidebar"
						className="absolute top-0 left-0 z-10 lg:hidden"
						size="icon-sm"
						variant="outline"
					/>
				}
			>
				<ComponentSidebarIcon aria-hidden="true" open={false} />
			</SheetTrigger>

			<SheetContent
				className="gap-0 bg-background p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] data-[side=left]:w-[min(20rem,85vw)] lg:hidden"
				data-slot="mobile-sidebar-drawer"
				showCloseButton={false}
				side="left"
			>
				<div className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-3">
					<SheetClose
						render={
							<Button
								aria-label="Close sidebar"
								size="icon-sm"
								variant="ghost"
							/>
						}
					>
						<ComponentSidebarIcon aria-hidden="true" open />
					</SheetClose>
					<SheetTitle className="font-semibold text-[12px] text-foreground/70 uppercase tracking-widest">
						Browse
					</SheetTitle>
				</div>

				{/* Links close the drawer themselves too, so tapping the current page
				    or an external link also dismisses it. */}
				<div
					className="no-scrollbar min-h-0 grow overflow-y-auto overflow-x-clip overscroll-contain"
					onClick={(event) => {
						if ((event.target as Element).closest("a")) setOpen(false);
					}}
				>
					{children}
				</div>
			</SheetContent>
		</Sheet>
	);
}

type SidebarContentProps = Omit<
	ComponentSidebarContentProps,
	"activeHref" | "onItemCrossCenter" | "renderLink"
>;

export function SidebarContent(props: SidebarContentProps) {
	const pathname = usePathname();

	return (
		<ComponentSidebarContent
			{...props}
			activeHref={pathname}
			renderLink={renderNextLink}
		/>
	);
}

function renderNextLink({ href, ...props }: ComponentSidebarLinkProps) {
	return <Link href={href as Route} {...props} />;
}
