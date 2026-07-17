"use client";

import { Tabs, TabsList, TabsTrigger } from "@tentui.com/ui/components/tabs";
import { cn } from "@/lib/utils";

export function CodeTabs({
	className,
	...props
}: React.ComponentProps<typeof Tabs>) {
	return (
		<Tabs
			defaultValue="cli"
			className={cn("my-5 gap-0", className)}
			{...props}
		/>
	);
}

export function TabsListInstallType() {
	return (
		<TabsList variant="line" className="mb-3">
			<TabsTrigger value="cli">Command</TabsTrigger>
			<TabsTrigger value="manual">Manual</TabsTrigger>
		</TabsList>
	);
}
