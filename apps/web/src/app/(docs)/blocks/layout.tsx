import { BlocksNav } from "@/components/blocks/routes/blocks-nav";

export default function BlocksListLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div>
			<div className="h-px border-line border-t" />
			<BlocksNav />
			<div className="h-px border-line border-t" />

			{children}
		</div>
	);
}
