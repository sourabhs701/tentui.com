"use client";

import { Button } from "@tentui.com/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@tentui.com/ui/components/collapsible";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@tentui.com/ui/components/resizable";
import { Separator } from "@tentui.com/ui/components/separator";
import {
	Sidebar,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarProvider,
} from "@tentui.com/ui/components/sidebar";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@tentui.com/ui/components/tabs";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@tentui.com/ui/components/toggle-group";
import { CheckIcon, ChevronRightIcon, CopyIcon, XIcon } from "lucide-react";
import type React from "react";
import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import type { RegistryItem } from "shadcn/schema";
import {
	DesktopIcon,
	FolderIcon,
	FolderOpenIcon,
	FullScreenIcon,
	getIconForLanguageExtension,
	RefreshIcon,
	SmartPhoneIcon,
	TabletIcon,
	TerminalIcon,
} from "@/components/icons";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { trackEvent } from "@/lib/events";
import type {
	createFileTreeForRegistryItemFiles,
	FileTree,
} from "@/lib/registry";
import { cn } from "@/lib/utils";
import {
	CopyButton,
	CopyStateIcon,
} from "@/registry/components/copy-button/copy-button";
import { getRegistryItemNamespace } from "@/utils/registry";

type View = "preview" | "code";

type BlockViewerContext = {
	item: RegistryItem;

	setView: (view: View) => void;

	activeFile: string | null;
	setActiveFile: (file: string) => void;

	tree: ReturnType<typeof createFileTreeForRegistryItemFiles> | null;
	highlightedFiles:
		| (NonNullable<RegistryItem["files"]>[number] & {
				highlightedContent: string;
		  })[]
		| null;

	iframeKey?: number;
	setIframeKey?: React.Dispatch<React.SetStateAction<number>>;

	resizablePanelRef: React.RefObject<PanelImperativeHandle | null> | null;
};

const BlockViewerContext = createContext<BlockViewerContext | null>(null);

function useBlockViewer() {
	const context = useContext(BlockViewerContext);
	if (!context) {
		throw new Error(
			"useBlockViewer must be used within a BlockViewerProvider.",
		);
	}
	return context;
}

function BlockViewerProvider({
	item,
	tree,
	highlightedFiles,
	children,
}: Pick<BlockViewerContext, "item" | "tree" | "highlightedFiles"> & {
	children: React.ReactNode;
}) {
	const [view, setView] = useState<View>("preview");

	const [activeFile, setActiveFile] = useState<
		BlockViewerContext["activeFile"]
	>(highlightedFiles?.[0].target ?? null);

	const [iframeKey, setIframeKey] = useState(0);

	const resizablePanelRef = useRef<PanelImperativeHandle>(null);
	const previewHeight = item.meta?.iframeHeight;

	return (
		<BlockViewerContext.Provider
			value={{
				item,
				setView,
				activeFile,
				setActiveFile,
				tree,
				highlightedFiles,
				iframeKey,
				setIframeKey,
				resizablePanelRef,
			}}
		>
			<div
				id={item.name}
				className="flex min-w-0 scroll-mt-14 flex-col-reverse items-stretch gap-2 p-2 md:flex-col lg:pr-0"
				style={
					{
						"--height":
							typeof previewHeight === "number"
								? `${previewHeight}px`
								: typeof previewHeight === "string"
									? previewHeight
									: "768px",
					} as React.CSSProperties
				}
			>
				<Tabs
					value={view}
					onValueChange={(value) => {
						setView(value as View);
						trackEvent({
							name: "block_viewer_tab_change",
							properties: { block: item.name, tab: value },
						});
					}}
				>
					{children}
				</Tabs>
			</div>
		</BlockViewerContext.Provider>
	);
}

type BlockViewerProps = Pick<
	BlockViewerContext,
	"item" | "tree" | "highlightedFiles"
>;

export function BlockViewer({
	item,
	tree,
	highlightedFiles,
	...props
}: BlockViewerProps) {
	return (
		<BlockViewerProvider
			item={item}
			tree={tree}
			highlightedFiles={highlightedFiles}
			{...props}
		>
			<BlockViewerToolbar />
			<BlockViewerView />
			<BlockViewerCode />
			<BlockViewerMobile />
		</BlockViewerProvider>
	);
}

function BlockViewerToolbar() {
	const { setView, item, resizablePanelRef, setIframeKey } = useBlockViewer();

	const { state, copy } = useCopyToClipboard();

	return (
		<div className="flex w-full items-center gap-2 max-lg:hidden">
			<TabsList variant="line">
				<TabsTrigger className="px-3" value="preview">
					Preview
				</TabsTrigger>
				<TabsTrigger className="px-3" value="code">
					Code
				</TabsTrigger>
			</TabsList>

			<Separator
				orientation="vertical"
				className="mx-2 data-vertical:h-4 data-vertical:self-center"
			/>

			<a
				href={`#${item.name}`}
				className="link line-clamp-1 font-medium text-sm"
			>
				{item.description?.replace(/\.$/, "")}
			</a>

			<div className="ml-auto flex items-center gap-2">
				<div className="flex h-8 items-center gap-0.75 rounded-lg border p-0.75">
					<ToggleGroup
						className="gap-0.75 *:data-[slot=toggle-group-item]:h-6 *:data-[slot=toggle-group-item]:min-w-6 *:data-[slot=toggle-group-item]:rounded-sm! *:data-[slot=toggle-group-item]:px-0"
						defaultValue={["100%"]}
						onValueChange={([value]) => {
							setView("preview");
							resizablePanelRef?.current?.resize(value || "100%");
							trackEvent({
								name: "block_viewer_resize",
								properties: { block: item.name, size: value || "100%" },
							});
						}}
					>
						<ToggleGroupItem aria-label="Mobile" value="30%">
							<SmartPhoneIcon />
						</ToggleGroupItem>

						<ToggleGroupItem aria-label="Tablet" value="60%">
							<TabletIcon />
						</ToggleGroupItem>

						<ToggleGroupItem aria-label="Desktop" value="100%">
							<DesktopIcon />
						</ToggleGroupItem>
					</ToggleGroup>

					<Separator
						orientation="vertical"
						className="data-vertical:h-4 data-vertical:self-center"
					/>

					<Button
						className="border-none dark:hover:bg-muted"
						variant="ghost"
						size="icon-xs"
						nativeButton={false}
						render={
							<a
								href={`/preview/${item.name}`}
								target="_blank"
								rel="noopener"
								aria-label="Open in New Tab"
								onClick={() =>
									trackEvent({
										name: "block_viewer_open_preview",
										properties: { block: item.name },
									})
								}
							>
								<FullScreenIcon className="size-4" />
							</a>
						}
					/>

					<Separator
						orientation="vertical"
						className="data-vertical:h-4 data-vertical:self-center"
					/>

					<Button
						className="border-none dark:hover:bg-muted"
						variant="ghost"
						size="icon-xs"
						aria-label="Refresh Preview"
						onClick={() => {
							setView("preview");
							setIframeKey?.((v) => v + 1);
							trackEvent({
								name: "block_viewer_refresh_preview",
								properties: { block: item.name },
							});
						}}
					>
						<RefreshIcon className="size-4" />
					</Button>
				</div>

				<Separator
					orientation="vertical"
					className="mx-2 data-vertical:h-4 data-vertical:self-center"
				/>

				<Button
					className="w-fit gap-1.5 px-2 font-mono font-normal text-[0.8125rem] shadow-none active:scale-none [&_svg]:text-muted-foreground"
					variant="outline"
					size="sm"
					onClick={() => {
						const code = `npx shadcn@latest add ${getRegistryItemNamespace(item.name)}`;
						copy(code);
						trackEvent({
							name: "copy_npm_command",
							properties: { code },
						});
					}}
				>
					<CopyStateIcon
						state={state}
						idleIcon={<TerminalIcon />}
						doneIcon={<CheckIcon />}
					/>
					<span>
						<span className="text-muted-foreground">npx shadcn add</span>{" "}
						{getRegistryItemNamespace(item.name)}
					</span>
				</Button>
			</div>
		</div>
	);
}

function BlockViewerView() {
	const { resizablePanelRef } = useBlockViewer();

	return (
		<TabsContent
			className="flex h-(--height) flex-none max-lg:hidden"
			value="preview"
			keepMounted
		>
			<div className="relative w-full">
				<div className="absolute inset-0 right-2 rounded-xl bg-[radial-gradient(var(--pattern-foreground)_1px,transparent_0)] bg-black/0.75 bg-center bg-size-[10px_10px] [--pattern-foreground:var(--color-zinc-950)]/5 dark:bg-white/0.75 dark:[--pattern-foreground:var(--color-white)]/5" />

				<ResizablePanelGroup orientation="horizontal">
					<ResizablePanel
						panelRef={resizablePanelRef}
						className="relative overflow-hidden rounded-xl after:pointer-events-none after:absolute after:inset-0 after:inset-ring-1 after:inset-ring-foreground/10 after:rounded-xl"
						minSize="30%"
						defaultSize="100%"
					>
						<BlockViewerIframe />
					</ResizablePanel>

					<ResizableHandle
						className={cn(
							"relative w-2 -translate-x-4 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0",
							"after:absolute after:top-1/2 after:left-0.5 after:h-12 after:w-1.5 after:translate-x-0 after:-translate-y-1/2 after:rounded-full after:bg-foreground/10 after:transition-all",
							"data-[separator=active]:after:scale-y-125 data-[separator=active]:after:bg-foreground/30 data-[separator=hover]:after:bg-foreground/20",
						)}
						disableDoubleClick
					/>

					<ResizablePanel minSize="0%" defaultSize="0%" />
				</ResizablePanelGroup>
			</div>
		</TabsContent>
	);
}

function BlockViewerIframe({ className }: { className?: string }) {
	const { iframeKey, item } = useBlockViewer();

	return (
		<iframe
			key={iframeKey}
			className={cn("no-scrollbar w-full bg-background", className)}
			src={`/preview/${item.name}`}
			title={`${item.title ?? item.name} preview`}
			loading="lazy"
			height={item.meta?.iframeHeight ?? 768}
		/>
	);
}

function BlockViewerCode() {
	const { highlightedFiles, activeFile } = useBlockViewer();

	const file = useMemo(() => {
		return highlightedFiles?.find((file) => file.target === activeFile);
	}, [highlightedFiles, activeFile]);

	if (!file) {
		return null;
	}

	const language = file.path.split(".").pop() ?? "tsx";

	return (
		<TabsContent
			className="mr-2 flex h-(--height) max-h-(--height) flex-none gap-2 overflow-hidden text-code-foreground max-lg:hidden"
			value="code"
			keepMounted
		>
			<div className="w-72">
				<BlockViewerFileTree />
			</div>

			<figure
				className="my-0 flex min-w-0 flex-1 flex-col overflow-hidden"
				data-rehype-pretty-code-figure=""
			>
				<figcaption
					data-rehype-pretty-code-title
					data-language={language}
					className="h-10 shrink-0"
				>
					{getIconForLanguageExtension(language)}
					<span className="truncate">{file.target}</span>
					<BlockCopyCodeButton />
				</figcaption>

				<div
					key={file?.path}
					className="[&_pre]:no-scrollbar [&_pre]:scroll-fade h-full overflow-hidden rounded-[9px] border bg-code [&_pre]:h-full [&_pre]:overflow-y-auto"
					dangerouslySetInnerHTML={{ __html: file?.highlightedContent ?? "" }}
				/>
			</figure>
		</TabsContent>
	);
}

function BlockViewerFileTree() {
	const { tree } = useBlockViewer();

	if (!tree) {
		return null;
	}

	return (
		<SidebarProvider className="flex min-h-full flex-col [--sidebar:var(--surface)] dark:[--sidebar-accent:var(--muted)]/50">
			<Sidebar
				collapsible="none"
				className="inset-ring-1 inset-ring-border/64 w-full flex-1 rounded-xl p-1 pt-0"
			>
				<SidebarGroupLabel className="h-10 rounded-none px-4 text-sm">
					Files
				</SidebarGroupLabel>

				<SidebarGroup className="flex-1 rounded-[9px] border bg-background px-0">
					<SidebarGroupContent>
						<SidebarMenu className="translate-x-0 gap-px">
							{tree.map((file, index) => (
								<Tree key={index} item={file} index={1} />
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</Sidebar>
		</SidebarProvider>
	);
}

function Tree({ item, index }: { item: FileTree; index: number }) {
	const { activeFile, setActiveFile } = useBlockViewer();

	if (!item.children) {
		const language = item.name.split(".").pop() ?? "tsx";
		return (
			<SidebarMenuItem>
				<SidebarMenuButton
					data-index={index}
					className="whitespace-nowrap rounded-none pl-(--index) data-active:font-normal [&_svg]:text-muted-foreground"
					style={
						{
							"--index": `${index * (index === 2 ? 1.2 : 1.3)}rem`,
						} as React.CSSProperties
					}
					isActive={item.path === activeFile}
					onClick={() => item.path && setActiveFile(item.path)}
				>
					<ChevronRightIcon className="invisible" />
					{getIconForLanguageExtension(language)}
					{item.name}
				</SidebarMenuButton>
			</SidebarMenuItem>
		);
	}

	return (
		<SidebarMenuItem>
			<Collapsible
				className="group/collapsible flex flex-col gap-px data-open:[&>button>svg:first-child]:rotate-90"
				defaultOpen
			>
				<CollapsibleTrigger
					render={
						<SidebarMenuButton
							className={cn(
								"whitespace-nowrap rounded-none pl-(--index) [&_svg]:text-muted-foreground",
								"aria-[expanded=false]:*:data-[slot=folder]:block aria-expanded:*:data-[slot=folder-open]:block",
							)}
							style={
								{
									"--index": `${index * (index === 1 ? 1 : 1.2)}rem`,
								} as React.CSSProperties
							}
						/>
					}
				>
					<ChevronRightIcon className="transition-transform" />
					<FolderIcon data-slot="folder" className="hidden" />
					<FolderOpenIcon data-slot="folder-open" className="hidden" />
					{item.name}
				</CollapsibleTrigger>

				<CollapsibleContent>
					<SidebarMenuSub className="m-0 w-full translate-x-0 gap-px border-none p-0">
						{item.children.map((subItem, key) => (
							<Tree key={key} item={subItem} index={index + 1} />
						))}
					</SidebarMenuSub>
				</CollapsibleContent>
			</Collapsible>
		</SidebarMenuItem>
	);
}

function BlockCopyCodeButton() {
	const { item, activeFile } = useBlockViewer();

	const file = useMemo(() => {
		return item.files?.find((file) => file.target === activeFile);
	}, [item.files, activeFile]);

	const content = file?.content;

	if (!content) {
		return null;
	}

	return (
		<CopyButton
			className="absolute top-1.5 right-1.5 size-7 rounded-md border-none text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-inherit"
			variant="ghost"
			size="icon-xs"
			text={content}
			idleIcon={<CopyIcon />}
			doneIcon={<CheckIcon />}
			errorIcon={<XIcon />}
			onCopySuccess={() => {
				trackEvent({
					name: "copy_block_code",
					properties: {
						name: item.name,
						file: file.path,
					},
				});
			}}
		/>
	);
}

function BlockViewerMobile() {
	const { item } = useBlockViewer();

	return (
		<div className="flex flex-col gap-2 lg:hidden">
			<div className="flex items-center gap-2 px-2">
				<div className="line-clamp-2 text-balance font-medium text-sm">
					{item.description?.replace(/\.$/, "")}
				</div>

				<div className="ml-auto shrink-0 font-mono text-muted-foreground text-sm">
					{getRegistryItemNamespace(item.name)}
				</div>
			</div>

			<div className="screen-line-top h-px" />

			<div className="relative overflow-hidden rounded-xl border">
				<BlockViewerIframe />
			</div>
		</div>
	);
}
