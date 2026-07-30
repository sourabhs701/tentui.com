"use client";

import { CopyIcon, CornerDownLeftIcon, SearchIcon } from "lucide-react";
import * as React from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { Button } from "@/components/ui/button";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export type SearchCommandItem = {
	/** Stable identity when items may be reordered. */
	id?: string;
	/** Primary searchable label. */
	title: string;
	/** Optional text included in search without being displayed. */
	description?: string;
	/** Overrides the value used by the command menu's filter. */
	value?: string;
	/** Additional terms that should match this item. */
	keywords?: readonly string[];
	icon?: React.ReactNode;
	/** Supporting metadata displayed at the end of the row. */
	meta?: React.ReactNode;
	/** Compact keyboard sequence displayed at the end of the row. */
	shortcut?: string;
	/** Overrides the footer action while this item is highlighted. */
	actionLabel?: string;
	disabled?: boolean;
	/** Runs immediately before the menu closes. */
	onBeforeSelect?: () => void;
	onSelect?: () => void;
};

export type SearchCommandGroup = {
	heading: string;
	items: readonly SearchCommandItem[];
	/** Footer action used by items in this group. */
	actionLabel?: string;
};

export type SearchCommandProps = {
	groups: readonly SearchCommandGroup[];
	/** Controlled dialog state. */
	open?: boolean;
	/** Initial dialog state when uncontrolled. */
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	onItemSelect?: (item: SearchCommandItem) => void;
	/** Enables the configured modifier shortcut and slash. */
	enabledHotkeys?: boolean;
	/** Character used with Command or Control to open the menu. */
	shortcutKey?: string;
	/** Overrides the modifier displayed in the trigger. */
	shortcutModifier?: "auto" | "command" | "control";
	triggerLabel?: string;
	triggerSlot?: string;
	placeholder?: string;
	emptyMessage?: React.ReactNode;
	title?: string;
	description?: string;
	footerIcon?: React.ReactNode;
	defaultActionLabel?: string;
	triggerClassName?: string;
	dialogClassName?: string;
	listClassName?: string;
};

export function SearchCommand({
	defaultActionLabel = "Open",
	defaultOpen = false,
	description = "Search for a command to run...",
	dialogClassName,
	emptyMessage = "No results found.",
	enabledHotkeys = false,
	footerIcon,
	groups,
	listClassName,
	onItemSelect,
	onOpenChange,
	open,
	placeholder = "Type a command or search…",
	shortcutKey = "k",
	shortcutModifier = "auto",
	title = "Command Palette",
	triggerClassName,
	triggerLabel = "Search…",
	triggerSlot = "command-menu-trigger",
}: SearchCommandProps) {
	const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
	const [selectedActionLabel, setSelectedActionLabel] =
		React.useState(defaultActionLabel);
	const isOpen = open ?? internalOpen;
	const normalizedShortcutKey = shortcutKey.trim().toLowerCase();
	const displayedShortcutKey = normalizedShortcutKey.toUpperCase();
	const ariaKeyShortcuts =
		shortcutModifier === "command"
			? `Meta+${displayedShortcutKey} /`
			: shortcutModifier === "control"
				? `Control+${displayedShortcutKey} /`
				: `Meta+${displayedShortcutKey} Control+${displayedShortcutKey} /`;

	const setOpen = React.useCallback(
		(nextOpen: boolean) => {
			if (open === undefined) setInternalOpen(nextOpen);
			onOpenChange?.(nextOpen);
		},
		[onOpenChange, open],
	);

	useHotkeys(
		`mod+${normalizedShortcutKey}, slash`,
		(event) => {
			event.preventDefault();
			setOpen(!isOpen);
		},
		{ enabled: enabledHotkeys },
	);

	function handleItemSelect(item: SearchCommandItem) {
		item.onBeforeSelect?.();
		setOpen(false);
		item.onSelect?.();
		onItemSelect?.(item);
	}

	return (
		<>
			<Button
				aria-expanded={isOpen}
				aria-haspopup="dialog"
				aria-keyshortcuts={ariaKeyShortcuts}
				aria-label={triggerLabel}
				className={cn(
					"select-none gap-1.5 border-none px-1.5 text-muted-foreground will-change-[scale]",
					triggerClassName,
				)}
				data-slot={triggerSlot}
				onClick={() => setOpen(true)}
				size="sm"
				variant="ghost"
			>
				<SearchIcon />
				<span className="font-medium font-sans text-sm/4 sm:hidden">
					{triggerLabel}
				</span>
				{shortcutModifier !== "control" ? (
					<KbdGroup
						className={cn(
							"hidden gap-0.75",
							shortcutModifier === "command"
								? "sm:flex"
								: "sm:in-[.os-macos_&]:flex",
						)}
					>
						<Kbd className="w-5 min-w-auto">⌘</Kbd>
						<Kbd className="w-5 min-w-auto">{displayedShortcutKey}</Kbd>
					</KbdGroup>
				) : null}
				{shortcutModifier !== "command" ? (
					<KbdGroup
						className={cn(
							"hidden gap-0.75",
							shortcutModifier === "control"
								? "sm:flex"
								: "sm:not-[.os-macos_&]:flex",
						)}
					>
						<Kbd>Ctrl</Kbd>
						<Kbd className="w-5 min-w-auto">{displayedShortcutKey}</Kbd>
					</KbdGroup>
				) : null}
			</Button>

			<CommandDialog
				className={dialogClassName}
				description={description}
				onOpenChange={setOpen}
				open={isOpen}
				title={title}
			>
				<SearchCommandInput placeholder={placeholder} />

				<div className="rounded-xl bg-background ring-1 ring-border">
					<CommandList className={cn("scroll-fade min-h-80", listClassName)}>
						<CommandEmpty>{emptyMessage}</CommandEmpty>
						{groups.map((group) => (
							<CommandGroup heading={group.heading} key={group.heading}>
								{group.items.map((item, index) => {
									const actionLabel =
										item.actionLabel ?? group.actionLabel ?? defaultActionLabel;
									const keywords = [
										...(item.keywords ?? []),
										...(item.description ? [item.description] : []),
									];
									return (
										<SearchCommandMenuItem
											disabled={item.disabled}
											key={item.id ?? `${item.value ?? item.title}-${index}`}
											keywords={keywords.length > 0 ? keywords : undefined}
											onHighlight={() => setSelectedActionLabel(actionLabel)}
											onSelect={() => handleItemSelect(item)}
											value={item.value}
										>
											{item.icon ?? <CopyIcon />}
											<p className="line-clamp-1">{item.title}</p>
											{item.meta ? (
												<span className="ml-auto font-mono font-normal text-muted-foreground text-xs tabular-nums max-sm:hidden">
													{item.meta}
												</span>
											) : null}
											{item.shortcut ? (
												<CommandShortcut className="font-mono tracking-[0.2em] max-sm:hidden">
													{item.shortcut}
												</CommandShortcut>
											) : null}
										</SearchCommandMenuItem>
									);
								})}
							</CommandGroup>
						))}
					</CommandList>
				</div>

				<div className="flex h-10" />
				<div className="absolute inset-x-0 bottom-0 flex h-10 items-center justify-between gap-2 rounded-b-2xl px-4 font-medium text-xs">
					<span className="size-4 shrink-0">
						{footerIcon ?? <SearchIcon className="size-full" />}
					</span>
					<div className="flex items-center gap-2 max-sm:hidden">
						<span>{selectedActionLabel}</span>
						<Kbd>
							<CornerDownLeftIcon />
						</Kbd>
					</div>
				</div>
			</CommandDialog>
		</>
	);
}

function SearchCommandInput({ placeholder }: { placeholder: string }) {
	const [searchValue, setSearchValue] = React.useState("");

	return (
		<CommandInput
			placeholder={placeholder}
			value={searchValue}
			onValueChange={setSearchValue}
		/>
	);
}

function SearchCommandMenuItem({
	children,
	onHighlight,
	...props
}: React.ComponentProps<typeof CommandItem> & {
	onHighlight?: () => void;
}) {
	const ref = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		const commandItem = ref.current;
		if (!commandItem) return;

		const observer = new MutationObserver(() => {
			if (commandItem.dataset.selected === "true") onHighlight?.();
		});
		observer.observe(commandItem, {
			attributes: true,
			attributeFilter: ["data-selected"],
		});

		return () => observer.disconnect();
	}, [onHighlight]);

	return (
		<CommandItem ref={ref} {...props}>
			{children}
		</CommandItem>
	);
}

export default SearchCommand;
