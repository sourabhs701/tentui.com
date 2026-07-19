"use client";

import "dialkit/styles.css";

import { Button } from "@tentui.com/ui/components/button";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@tentui.com/ui/components/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@tentui.com/ui/components/tooltip";
import { Code as CodeInline } from "@tentui.com/ui/components/typography";
import { RotateCcw, Settings2 } from "lucide-react";
import { useTheme } from "next-themes";
import React, { useMemo, useState } from "react";
import { trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import { Index } from "@/registry/__index__";
import { FullScreenIcon } from "../icons";
import { CodeCollapsibleWrapper } from "./code-collapsible-wrapper";

const DialRoot = React.lazy(() =>
	import("dialkit").then((module) => ({ default: module.DialRoot })),
);

const registryIndex = Index as unknown as Record<
	string,
	{ component?: React.ComponentType }
>;

export function ComponentPreview({
	className,
	name,
	customizeUrl,
	canReload = false,
	canConfigure = false,
	prose = false,
	codeCollapsible = false,
	remountOnThemeChange = false,
	children,
	...props
}: React.ComponentProps<"div"> & {
	name: string;
	customizeUrl?: string;
	canReload?: boolean;
	canConfigure?: boolean;
	prose?: boolean;
	codeCollapsible?: boolean;
	remountOnThemeChange?: boolean;
}) {
	const { resolvedTheme } = useTheme();

	const [reloadKey, setReloadKey] = useState(0);
	const [reloadRotation, setReloadRotation] = useState(0);
	const [isConfiguring, setIsConfiguring] = useState(false);

	const Codes = React.Children.toArray(children) as React.ReactElement[];
	const Code = Codes[0];
	const dialKitTheme =
		resolvedTheme === "dark" || resolvedTheme === "light"
			? resolvedTheme
			: "system";

	const Preview = useMemo(() => {
		const Component = registryIndex[name]?.component;

		if (!Component) {
			return (
				<p className="text-muted-foreground text-sm">
					Component <CodeInline>{name}</CodeInline> not found in registry.
				</p>
			);
		}

		return <Component />;
	}, [name]);

	return (
		<div
			className={cn(
				"inset-ring-1 inset-ring-border/64 my-[1.25em] rounded-xl bg-surface",
				prose === false && "not-prose",
				className,
			)}
			{...props}
		>
			<Tabs defaultValue="preview" className="gap-0">
				<div className="z-1 flex items-center justify-between px-4">
					<TabsList
						variant="line"
						className="inset-ring-0 h-10 rounded-none bg-transparent p-0 dark:bg-transparent [&_svg]:me-2 [&_svg]:size-4 [&_svg]:text-muted-foreground"
					>
						<TabsTrigger className="h-7 rounded-lg p-0 px-2" value="preview">
							Preview
						</TabsTrigger>
						<TabsTrigger className="h-7 rounded-lg p-0 px-2" value="code">
							Code
						</TabsTrigger>
					</TabsList>
					<Button
						className="border-none dark:hover:bg-muted"
						variant="ghost"
						size="icon-xs"
						nativeButton={false}
						render={
							<a
								href={`/preview/${name}`}
								target="_blank"
								rel="noopener"
								aria-label="Open in New Tab"
								onClick={() =>
									trackEvent({
										name: "block_viewer_open_preview",
										properties: { block: name },
									})
								}
							>
								<FullScreenIcon className="size-4" />
							</a>
						}
					/>
				</div>

				<TabsContent className="px-1 pb-1" value="preview">
					<div
						data-slot="preview"
						data-show-buttons={canReload || canConfigure || !!customizeUrl}
						className="relative rounded-[9px] border bg-background p-2 data-[show-buttons=true]:py-8.75"
					>
						{(canReload || canConfigure || customizeUrl) && (
							<div
								data-slot="buttons"
								className="absolute top-0.75 right-0.75 flex items-center"
							>
								{canReload && (
									<Tooltip>
										<TooltipTrigger
											render={
												<Button
													className="size-7 rounded-[5px] border-none"
													variant="ghost"
													size="icon-sm"
													aria-label="Reload preview"
													onClick={(event) => {
														setReloadKey((value) => value + 1);
														if (event.detail > 0) {
															setReloadRotation((value) => value + 180);
														}
													}}
												>
													<span
														aria-hidden="true"
														className="motion-reduce:transform-none! inline-flex transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
														style={{
															transform: `rotate(${reloadRotation}deg)`,
														}}
													>
														<RotateCcw />
													</span>
												</Button>
											}
										/>
										<TooltipContent>Reload preview</TooltipContent>
									</Tooltip>
								)}

								{canConfigure && (
									<Tooltip>
										<TooltipTrigger
											render={
												<Button
													className="size-7 rounded-[5px] border-none"
													variant="ghost"
													size="icon-sm"
													aria-label={
														isConfiguring
															? "Close preview configuration"
															: "Configure preview"
													}
													aria-pressed={isConfiguring}
													onClick={() => setIsConfiguring((value) => !value)}
												>
													<Settings2 />
												</Button>
											}
										/>
										<TooltipContent>
											{isConfiguring ? "Close configuration" : "Configure"}
										</TooltipContent>
									</Tooltip>
								)}

								{customizeUrl && (
									<Tooltip>
										<TooltipTrigger
											render={
												<Button
													className="size-7 rounded-[5px] border-none"
													variant="ghost"
													size="icon-sm"
													aria-label="Customize"
													nativeButton={false}
													render={
														<a
															href={customizeUrl}
															target="_blank"
															rel="noopener noreferrer"
														>
															<Settings2 />
														</a>
													}
												/>
											}
										/>
										<TooltipContent>Customize</TooltipContent>
									</Tooltip>
								)}
							</div>
						)}

						<div
							key={`${reloadKey}-${remountOnThemeChange ? (resolvedTheme ?? "system") : "static"}`}
							data-slot="component-preview"
							className="flex min-h-72 items-center justify-center font-sans"
						>
							<React.Suspense
								fallback={
									<div className="flex items-center justify-center text-muted-foreground text-sm">
										Loading…
									</div>
								}
							>
								{Preview}
							</React.Suspense>
						</div>
					</div>
				</TabsContent>

				<TabsContent
					value="code"
					className={cn(
						"**:data-rehype-pretty-code-figure:inset-ring-0 **:data-rehype-pretty-code-figure:m-0 **:data-rehype-pretty-code-figure:bg-transparent **:data-rehype-pretty-code-figure:pt-0",
						"**:data-[slot=copy-button]:top-1 **:data-[slot=copy-button]:opacity-100",
						"**:data-fade-overlay:top-px",
					)}
				>
					{codeCollapsible ? (
						<CodeCollapsibleWrapper className="my-0">
							{Code}
						</CodeCollapsibleWrapper>
					) : (
						Code
					)}
				</TabsContent>
			</Tabs>

			{isConfiguring && (
				<React.Suspense fallback={null}>
					<DialRoot
						defaultOpen
						onOpenChange={setIsConfiguring}
						productionEnabled
						theme={dialKitTheme}
					/>
				</React.Suspense>
			)}
		</div>
	);
}
