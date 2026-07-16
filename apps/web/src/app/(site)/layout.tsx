import Header from "@/components/header";

export default function SiteLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="grid min-h-svh min-w-0 grid-rows-[auto_1fr] overflow-x-clip">
			<Header />
			{children}
		</div>
	);
}
