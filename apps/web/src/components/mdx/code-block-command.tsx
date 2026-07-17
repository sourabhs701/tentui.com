"use client";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@tentui.com/ui/components/tabs";
import { useMemo } from "react";
import type { PackageManager } from "@/hooks/use-package-manager";
import { usePackageManager } from "@/hooks/use-package-manager";
import type { NpmCommands } from "@/types/unist";
import { CopyButton } from "../copy-button";
import { IconSwap, IconSwapItem } from "../icon-swap";
import { getIconForPackageManager } from "../icons";

export function CodeBlockCommand({
	__pnpm__,
	__yarn__,
	__npm__,
	__bun__,
}: NpmCommands) {
	const [packageManager, setPackageManager] = usePackageManager();

	const tabs = useMemo(() => {
		return {
			pnpm: __pnpm__,
			yarn: __yarn__,
			npm: __npm__,
			bun: __bun__,
		};
	}, [__pnpm__, __yarn__, __npm__, __bun__]);

	return (
		<div data-slot="code-block-command" className="relative">
			<Tabs
				className="gap-0"
				value={packageManager}
				onValueChange={(value) => {
					setPackageManager(value as PackageManager);
				}}
			>
				<div className="px-3">
					<TabsList
						variant="line"
						className="inset-ring-0 h-10 rounded-none bg-transparent p-0 dark:bg-transparent [&_svg]:size-4 [&_svg]:text-muted-foreground"
					>
						<IconSwap>
							<IconSwapItem className="mr-2" key={packageManager}>
								{getIconForPackageManager(packageManager)}
							</IconSwapItem>
						</IconSwap>

						{Object.entries(tabs).map(([key]) => {
							return (
								<TabsTrigger
									key={key}
									className="h-7 rounded-lg p-0 px-2 font-mono"
									value={key}
								>
									{key}
								</TabsTrigger>
							);
						})}
					</TabsList>
				</div>

				{Object.entries(tabs).map(([key, value]) => {
					return (
						<TabsContent key={key} value={key}>
							<div className="rounded-[9px] border bg-background">
								<pre className="overflow-x-auto overscroll-x-contain leading-5">
									<code
										data-slot="code-block"
										data-language="bash"
										data-line=""
										className="font-mono text-muted-foreground text-sm/none"
									>
										{value}
									</code>
								</pre>
							</div>
						</TabsContent>
					);
				})}
			</Tabs>

			<CopyButton
				className="absolute top-1.5 right-0.5 z-10 size-7 rounded-md border-none text-muted-foreground [&_svg:not([class*='size-'])]:size-4"
				variant="ghost"
				size="icon-xs"
				text={tabs[packageManager] || ""}
			/>
		</div>
	);
}
