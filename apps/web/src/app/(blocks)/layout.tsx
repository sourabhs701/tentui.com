import Header from "@/components/header";

export default function BlocksRootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="grid min-h-svh min-w-0 grid-rows-[auto_1fr] overflow-x-clip bg-background text-foreground">
			<Header />
			<main className="min-h-0 overflow-x-clip">
				<div
					data-slot="blocks-layout"
					className="container mx-auto min-h-full border-line border-x"
				>
					{children}
				</div>
			</main>
		</div>
	);
}
