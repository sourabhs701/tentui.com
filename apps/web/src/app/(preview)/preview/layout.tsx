import type { Metadata } from "next";

import { previewRobots } from "./preview-robots";

export const metadata: Metadata = {
	robots: previewRobots,
};

export default function PreviewLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
