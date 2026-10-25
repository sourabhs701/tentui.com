"use client";

import { Archive, Pin, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
	ComponentSidebar,
	ComponentSidebarContent,
	type ComponentSidebarLinkProps,
} from "@/registry/components/component-sidebar";
import { NumberStepper } from "@/registry/components/number-stepper/number-stepper";
import {
	ScribbledText,
	type ScribbledTextVariant,
} from "@/registry/components/scribbled-text";
import { SnapSheet } from "@/registry/components/snap-sheet/snap-sheet";
import {
	type SwipeAction,
	SwipeActions,
	SwipeList,
} from "@/registry/components/swipe-actions/swipe-actions";
import {
	PrimaryButton,
	SecondaryButton,
	ThreeDButton,
	ThreeDDestructiveButton,
} from "@/registry/components/tailwindcss-buttons";
import { TickRuler } from "@/registry/components/tick-ruler/tick-ruler";

// Capture-only scenes for components whose docs demo doesn't fit a 4:3 frame,
// or is too busy for a card. They render the real registry components, just
// framed for media.

export function NumberStepperScene() {
	return (
		<NumberStepper
			label="Quantity"
			variant="pill"
			size="lg"
			defaultValue={3}
			min={1}
			max={12}
		/>
	);
}

export function TickRulerScene() {
	return (
		<div className="w-[360px]">
			<TickRuler
				label="Duration"
				defaultValue={25}
				min={0}
				max={90}
				majorEvery={5}
				labelEvery={15}
				unit="min"
			/>
		</div>
	);
}

const SWIPE_ROWS = [
	{ id: "one", title: "Swipe left or right", bar: "w-32" },
	{ id: "two", title: "Full swipe to delete", bar: "w-40" },
	{ id: "three", title: "Tap to close", bar: "w-24" },
];

export function SwipeActionsScene() {
	const [rows, setRows] = useState(SWIPE_ROWS);
	const remove = (id: string) =>
		setRows((current) => current.filter((row) => row.id !== id));

	return (
		<SwipeList label="Messages" variant="inset" className="w-[280px]">
			{rows.map((row) => {
				const pin: SwipeAction = {
					id: "pin",
					label: "Pin",
					icon: <Pin />,
					tone: "amber",
					onAction: () => {},
				};
				const archive: SwipeAction = {
					id: "archive",
					label: "Archive",
					icon: <Archive />,
					tone: "blue",
					destructive: true,
					onAction: () => remove(row.id),
				};
				const del: SwipeAction = {
					id: "delete",
					label: "Delete",
					icon: <Trash2 />,
					tone: "destructive",
					destructive: true,
					onAction: () => remove(row.id),
				};

				return (
					<SwipeActions
						key={row.id}
						label={row.title}
						leading={[pin]}
						trailing={[archive, del]}
						showHandle={false}
					>
						<div className="flex items-center gap-3 px-4 py-3.5">
							<span
								aria-hidden
								className="size-9 shrink-0 rounded-full bg-muted"
							/>
							<div className="grid min-w-0 flex-1 gap-1.5">
								<p className="truncate font-medium text-sm">{row.title}</p>
								<span className={`h-1.5 rounded-full bg-muted ${row.bar}`} />
							</div>
						</div>
					</SwipeActions>
				);
			})}
		</SwipeList>
	);
}

export function SnapSheetScene() {
	const screenRef = useRef<HTMLDivElement>(null);

	return (
		<div
			ref={screenRef}
			className="relative h-[280px] w-[270px] overflow-clip rounded-[32px] border bg-muted/40"
		>
			<SnapSheet
				defaultOpen
				defaultSnap={1}
				snapPoints={["96px", 0.55, 1]}
				modal={false}
				scaleBackground
			>
				<div
					data-sheet-wrapper
					className="absolute inset-0 grid content-start gap-3 bg-muted/40 p-6"
				>
					<span className="h-2.5 w-24 rounded-full bg-muted-foreground/20" />
					<span className="h-2 w-40 rounded-full bg-muted-foreground/15" />
					<span className="mt-2 h-20 rounded-2xl bg-muted-foreground/10" />
					<SnapSheet.Trigger className="absolute inset-x-6 bottom-6 h-11 cursor-pointer rounded-full bg-foreground font-medium text-background text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
						Open sheet
					</SnapSheet.Trigger>
				</div>

				<SnapSheet.Content container={screenRef} className="max-w-none">
					<SnapSheet.Handle className="mt-1.5" />
					<div className="px-5 pt-1 pb-6">
						<SnapSheet.Title>Snap sheet</SnapSheet.Title>
						<SnapSheet.Description>
							Drag between snap points
						</SnapSheet.Description>
						<div className="mt-5 grid gap-2.5">
							<span className="h-2 w-full rounded-full bg-muted" />
							<span className="h-2 w-5/6 rounded-full bg-muted" />
							<span className="h-2 w-2/3 rounded-full bg-muted" />
						</div>
					</div>
				</SnapSheet.Content>
			</SnapSheet>
		</div>
	);
}

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
