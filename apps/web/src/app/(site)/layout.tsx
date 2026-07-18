import Footer from "@/components/footer";
import { SiteBottomNav } from "@/components/site-bottom-nav";
import { SiteHeader } from "@/components/site-header";

export default function SiteLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div
			className="grid min-h-svh min-w-0 grid-rows-[auto_1fr] overflow-x-clip"
			data-slot="layout-6xl"
		>
			<SiteHeader />
			{children}
			<SiteBottomNav />
			<Footer />
		</div>
	);
}
