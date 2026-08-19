"use client";

import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	ComponentSidebar,
	ComponentSidebarContent,
	type ComponentSidebarContentProps,
	type ComponentSidebarLinkProps,
} from "@/registry/components/component-sidebar";

const DEFAULT_SIDEBAR_OPEN = true;

const sidebarOpenAtom = atomWithStorage(
	"tentui:sidebar-open:v1",
	DEFAULT_SIDEBAR_OPEN,
);

export function Sidebar({ children }: { children: React.ReactNode }) {
	const [isOpen, setIsOpen] = useAtom(sidebarOpenAtom);

	return (
		<ComponentSidebar
			className="[--component-sidebar-height:calc(100svh-var(--component-sidebar-top)-var(--fade-bottom-height))] [--component-sidebar-top:calc(var(--header-height)+(--spacing(2)))] max-lg:fixed max-lg:left-2 max-lg:z-50 max-lg:data-[open=false]:pointer-events-none"
			onOpenChange={setIsOpen}
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
