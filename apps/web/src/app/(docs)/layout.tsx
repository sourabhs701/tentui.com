import { SiteBottomNav } from "@/components/site-bottom-nav";
import { SiteHeader } from "@/components/site-header";

export default function BlocksRootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="group/layout relative isolate grid min-h-svh min-w-0 grid-rows-[auto_1fr] overflow-x-clip">
			<SiteHeader />
			<main
				className="container mx-auto overflow-x-clip"
				data-slot="layout-wide"
			>
				{children}
			</main>
			<SiteBottomNav />
		</div>
	);
}
