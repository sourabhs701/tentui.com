export default function BlocksRootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<main className="container mx-auto overflow-x-clip px-2">{children}</main>
	);
}
