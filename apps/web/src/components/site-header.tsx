import { Separator } from "@tentui.com/ui/components/separator";
import dynamic from "next/dynamic";
import Link from "next/link";

import { MAIN_NAV } from "@/config/site";

const CommandMenu = dynamic(() => import("@/components/command-menu"));
const BrandContextMenu = dynamic(
	() => import("@/components/brand-context-menu"),
);

import { cn } from "@/lib/utils";
import Marker from "./marker";
import { NavItemGitHub } from "./nav-item-github";
import {
	headerCommandBlocks,
	headerCommandComponents,
} from "./site-header-data";
import { SiteNavigation } from "./site-navigation";
import { TentUiMark } from "./tentui-mark";
import { ThemeToggle } from "./theme-toggle";

type SiteHeaderProps = {
	showGutters?: boolean;
};

export function SiteHeader({ showGutters = true }: SiteHeaderProps) {
	return (
		<header className="sticky top-0 z-50 mt-2 max-w-screen overflow-x-clip bg-background">
			<div
				className={cn(
					"relative isolate mx-auto w-full px-2",
					showGutters &&
						"border-border lg:w-[calc(100%-4rem)] lg:border-x lg:border-dashed",
				)}
			>
				{showGutters && (
					<>
						<HeaderGutterGrain />
						<Marker position="bottom-left" className="hidden lg:block" />
						<Marker position="bottom-right" className="hidden lg:block" />
						<Marker position="top-left" className="hidden lg:block" />
						<Marker position="top-right" className="hidden lg:block" />
					</>
				)}
				<div
					className={cn(
						"relative mx-auto max-w-6xl group-has-data-[slot=layout-wide]/layout:container",
						"border-border border-x border-dashed",
					)}
				>
					<HeaderSectionGrain />
					<div className="screen-line-top screen-line-bottom mx-auto flex h-(--header-height) items-center gap-2 border-line px-2 group-has-data-[slot=layout-wide]/layout:container after:z-1 after:bg-border group-has-data-[slot=layout-6xl]/layout:max-w-6xl sm:gap-4">
						<BrandContextMenu>
							<Link href="/" aria-label="TentUI home">
								<TentUiMark className="size-6 w-auto shrink-0 text-primary" />
							</Link>
						</BrandContextMenu>

						<SiteNavigation items={MAIN_NAV} className="max-sm:hidden" />
						<div className="flex-1" />

						<div className="flex items-center max-sm:*:data-[slot=command-menu-trigger]:hidden">
							<Separator
								orientation="vertical"
								className="mr-2 hidden data-vertical:h-5 data-vertical:self-center sm:block"
							/>
							<CommandMenu
								components={headerCommandComponents}
								blocks={headerCommandBlocks}
								enabledHotkeys
							/>
							<Separator
								orientation="vertical"
								className="mx-2 hidden data-vertical:h-5 data-vertical:self-center sm:block"
							/>
							<NavItemGitHub />
							<Separator
								orientation="vertical"
								className="mx-2 data-vertical:h-5 data-vertical:self-center"
							/>
							<ThemeToggle />
						</div>
					</div>
					<Marker position="bottom-left" />
					<Marker position="bottom-right" />
					<Marker position="top-left" />
					<Marker position="top-right" />
				</div>
			</div>
		</header>
	);
}

function HeaderSectionGrain() {
	return (
		<div
			aria-hidden="true"
			className="film-grain pointer-events-none absolute inset-0 -z-10 opacity-[0.12] dark:opacity-[0.06]"
		/>
	);
}

function HeaderGutterGrain() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 -z-10 hidden lg:block"
		>
			<span className="film-grain absolute inset-y-0 left-0 w-[calc((100%-72rem)/2)] opacity-[0.06] dark:opacity-[0.03]" />
			<span className="film-grain absolute inset-y-0 right-0 w-[calc((100%-72rem)/2)] opacity-[0.06] dark:opacity-[0.03]" />
		</div>
	);
}
