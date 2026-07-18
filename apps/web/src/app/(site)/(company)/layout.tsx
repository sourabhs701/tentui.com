import Marker from "@/components/marker";

import { CompanySidebar } from "./_components/company-sidebar";

export default function CompanyLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<section className="relative isolate mx-auto w-full border-border px-2 lg:w-[calc(100%-4rem)] lg:border-x lg:border-dashed">
			<Marker position="top-left" className="hidden lg:block" />
			<Marker position="top-right" className="hidden lg:block" />
			<Marker position="bottom-left" className="hidden lg:block" />
			<Marker position="bottom-right" className="hidden lg:block" />

			<div className="relative mx-auto w-full max-w-6xl border-border border-x border-dashed">
				<Marker position="top-left" />
				<Marker position="top-right" />
				<Marker position="bottom-left" />
				<Marker position="bottom-right" />

				<div className="grid grid-cols-1 md:grid-cols-5 md:divide-x md:divide-dashed md:divide-border">
					<aside className="border-border border-b border-dashed px-6 md:col-span-1 md:border-b-0 md:px-4">
						<CompanySidebar />
					</aside>

					<div className="min-w-0 px-6 py-10 md:col-span-4 md:px-10 md:py-14 lg:px-14">
						{children}
					</div>
				</div>
			</div>
		</section>
	);
}
