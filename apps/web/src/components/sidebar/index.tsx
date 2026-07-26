"use client";

import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { useClickSound } from "@/hooks/soundcn/use-click-sound";
import { useMetalClickSound } from "@/hooks/soundcn/use-metal-click-sound";
import {
	ComponentSidebar,
	ComponentSidebarContent,
	type ComponentSidebarContentProps,
	type ComponentSidebarLinkProps,
} from "@/registry/components/component-sidebar";

const DEFAULT_SIDEBAR_OPEN = true;
const TICK_VOLUME = 0.09;

const sidebarOpenAtom = atomWithStorage(
	"tentui:sidebar-open:v1",
	DEFAULT_SIDEBAR_OPEN,
);

export function Sidebar({ children }: { children: React.ReactNode }) {
	const [isOpen, setIsOpen] = useAtom(sidebarOpenAtom);
	const [click] = useMetalClickSound();

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			click();
			setIsOpen(nextOpen);
		},
		[click, setIsOpen],
	);

	return (
		<ComponentSidebar
			className="[--component-sidebar-height:calc(100svh-var(--component-sidebar-top)-var(--fade-bottom-height))] [--component-sidebar-top:calc(var(--header-height)+(--spacing(2)))] max-lg:fixed max-lg:left-2 max-lg:z-50 max-lg:data-[open=false]:pointer-events-none"
			onOpenChange={handleOpenChange}
			open={isOpen}
		>
			{children}
		</ComponentSidebar>
	);
}

type SidebarContentProps = Omit<
	ComponentSidebarContentProps,
	"activeHref" | "onItemCrossCenter" | "renderLink"
>;

export function SidebarContent(props: SidebarContentProps) {
	const pathname = usePathname();
	const [playClick] = useClickSound();

	const playTick = useCallback(() => {
		playClick({ volume: TICK_VOLUME });
	}, [playClick]);

	return (
		<ComponentSidebarContent
			{...props}
			activeHref={pathname}
			onItemCrossCenter={playTick}
			renderLink={renderNextLink}
		/>
	);
}

function renderNextLink({ href, ...props }: ComponentSidebarLinkProps) {
	return <Link href={href as Route} {...props} />;
}
