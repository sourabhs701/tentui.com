import { BlocksNav } from "@/components/blocks/routes/blocks-nav";

export default function BlocksListLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div>
			<BlocksNav />
			{children}
		</div>
	);
}
