import { BlocksNav } from "@/components/blocks/routes/blocks-nav";

export default function BlocksListLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			<div className="h-px border-line border-t" />
			<BlocksNav />
			<div className="h-px border-line border-t" />
			<div className="screen-line-top screen-line-bottom">
				<div className="stripe-divider" />
			</div>

			{children}
		</>
	);
}
