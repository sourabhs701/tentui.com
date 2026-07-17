import { Separator } from "@tentui.com/ui/components/separator";
import dynamic from "next/dynamic";
import Link from "next/link";

import { MAIN_NAV } from "@/config/site";

const CommandMenu = dynamic(() => import("@/components/command-menu"));
const BrandContextMenu = dynamic(
	() => import("@/components/brand-context-menu"),
);

import { NavItemGitHub } from "./nav-item-github";
import {
	headerCommandBlocks,
	headerCommandComponents,
} from "./site-header-data";
import { SiteNavigation } from "./site-navigation";
import { TentUiMark } from "./tentui-mark";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
	return (
		<header className="sticky top-0 z-50 mt-2 max-w-screen overflow-x-clip bg-background px-2">
			<div className="screen-line-top screen-line-bottom mx-auto flex h-(--header-height) items-center gap-2 border-line px-2 group-has-data-[slot=layout-wide]/layout:container after:z-1 after:bg-border sm:gap-4 md:max-w-3xl">
				<BrandContextMenu>
					<Link href="/" aria-label="TentUI home">
						<TentUiMark className="size-6 w-auto shrink-0 text-foreground" />
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
		</header>
	);
}
