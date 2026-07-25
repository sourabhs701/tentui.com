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
			<a
				href="#main-content"
				className="sr-only z-100 rounded-md bg-background px-3 py-2 font-medium text-sm shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-2 focus:ring-ring"
			>
				Skip to content
			</a>
			<SiteHeader />
			<main id="main-content" className="min-w-0">
				{children}
			</main>
			<SiteBottomNav />
			<Footer />
		</div>
	);
}
