import { Separator } from "@tentui.com/ui/components/separator";

import { MOBILE_NAV } from "@/config/site";

import CommandMenu from "./command-menu";
import {
	headerCommandBlocks,
	headerCommandComponents,
} from "./site-header-data";
import { SiteMobileNav } from "./site-mobile-nav";

export function SiteBottomNav() {
	return (
		<div className="fixed! bottom-[calc(--spacing(2)+env(safe-area-inset-bottom,0))] left-1/2 z-50 flex w-fit -translate-x-1/2 items-center rounded-xl bg-popover py-1 pr-1 pl-2.5 shadow-md ring-1 ring-foreground/10 sm:hidden">
			<CommandMenu
				components={headerCommandComponents}
				blocks={headerCommandBlocks}
			/>
			<Separator
				orientation="vertical"
				className="mr-1 ml-2.5 data-vertical:h-6 data-vertical:self-center"
			/>
			<SiteMobileNav items={MOBILE_NAV} />
		</div>
	);
}
