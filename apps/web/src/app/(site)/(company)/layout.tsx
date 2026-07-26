import Section from "@/components/section";

import { CompanySidebar } from "./_components/company-sidebar";

export default function CompanyLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<Section
			line={false}
			className="grid grid-cols-1 md:grid-cols-5 md:divide-x md:divide-dashed md:divide-border"
		>
			<aside className="border-border border-b border-dashed md:col-span-1 md:border-b-0">
				<CompanySidebar />
			</aside>

			<div className="min-w-0 px-6 py-10 md:col-span-4 md:px-10 md:py-14 lg:px-14">
				{children}
			</div>
		</Section>
	);
}
