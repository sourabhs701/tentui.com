import type { ReactNode } from "react";

export default function CaptureLayout({ children }: { children: ReactNode }) {
	return (
		<>
			<style>{`
				nextjs-portal,
				.tsqd-parent-container {
					display: none !important;
				}

				[data-component-capture]:not([data-capture-motion]) *,
				[data-component-capture]:not([data-capture-motion]) *::before,
				[data-component-capture]:not([data-capture-motion]) *::after {
					animation-delay: 0s !important;
					animation-duration: 0s !important;
					caret-color: transparent !important;
					transition-delay: 0s !important;
					transition-duration: 0s !important;
				}
			`}</style>
			{children}
		</>
	);
}
