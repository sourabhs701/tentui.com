"use client";

import { useCallback, useEffect, useState } from "react";

import {
	ComponentSidebar,
	ComponentSidebarContent,
	type ComponentSidebarLinkProps,
} from "@/registry/components/component-sidebar";
import {
	ScribbledText,
	type ScribbledTextVariant,
} from "@/registry/components/scribbled-text";
import {
	PrimaryButton,
	SecondaryButton,
	ThreeDButton,
	ThreeDDestructiveButton,
} from "@/registry/components/tailwindcss-buttons";

// Capture-only scenes for components whose docs demo doesn't fit a 4:3 frame.
// They render the real registry components, just framed for media.

export function TailwindcssButtonsScene() {
	return (
		<div className="grid grid-cols-2 place-items-center gap-x-10 gap-y-14 [zoom:1.15]">
			<PrimaryButton />
			<SecondaryButton />
			<ThreeDButton />
			<ThreeDDestructiveButton />
		</div>
	);
}

const SCRIBBLE_VARIANTS: ScribbledTextVariant[] = [
	"wavyUnderline",
	"circle",
	"highlight",
	"crossOut",
];

export function ScribbledTextScene() {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		const interval = window.setInterval(
			() => setIndex((current) => (current + 1) % SCRIBBLE_VARIANTS.length),
			2000,
		);
		return () => window.clearInterval(interval);
	}, []);

	const variant = SCRIBBLE_VARIANTS[index];

	return (
		<p className="whitespace-nowrap px-6 text-center font-medium text-[2.6rem] text-foreground tracking-tight">
			Make it{" "}
			<ScribbledText
				key={variant}
				variant={variant}
				scribbleClassName={
					variant === "highlight" ? undefined : "text-violet-400"
				}
			>
				memorable
			</ScribbledText>
		</p>
	);
}

const SIDEBAR_GROUPS = [
	{
		title: "Getting started",
		items: [
			{ title: "Overview", href: "/overview" },
			{ title: "Installation", href: "/installation" },
			{ title: "Changelog", href: "/changelog", isNew: true },
		],
		newCount: 1,
	},
	{
		title: "Components",
		items: [
			{ title: "Button", href: "/button", isUpdated: true },
			{ title: "Dialog", href: "/dialog" },
			{ title: "Tooltip", href: "/tooltip" },
		],
	},
];

export function ComponentSidebarScene() {
	const [activeHref, setActiveHref] = useState("/overview");
	const activeTitle =
		SIDEBAR_GROUPS.flatMap((group) => group.items).find(
			(item) => item.href === activeHref,
		)?.title ?? "Overview";

	const renderLink = useCallback(
		({ href, onClick, ...props }: ComponentSidebarLinkProps) => (
			<a
				href={href}
				onClick={(event) => {
					onClick?.(event);
					if (event.defaultPrevented) return;
					event.preventDefault();
					setActiveHref(href);
				}}
				{...props}
			/>
		),
		[],
	);

	return (
		<div className="flex size-full items-start gap-6 p-5">
			<ComponentSidebar
				className="relative top-auto shrink-0 [--component-sidebar-height:20rem]"
				shortcutKey={false}
			>
				<ComponentSidebarContent
					activeHref={activeHref}
					groups={SIDEBAR_GROUPS}
					renderLink={renderLink}
				/>
			</ComponentSidebar>
			<div className="flex min-w-0 flex-1 flex-col gap-3 pt-10">
				<p className="font-semibold text-xl tracking-tight">{activeTitle}</p>
				<div className="h-2 w-full rounded-full bg-muted" />
				<div className="h-2 w-5/6 rounded-full bg-muted" />
				<div className="h-2 w-2/3 rounded-full bg-muted" />
				<div className="mt-3 h-24 w-full rounded-xl border bg-muted/50" />
			</div>
		</div>
	);
}
