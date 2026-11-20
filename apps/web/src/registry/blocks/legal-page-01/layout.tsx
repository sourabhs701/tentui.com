import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

import PrivacyPolicyPage, { PRIVACY_CLAUSES } from "./privacy/page";

const LEGAL_PAGES = ["Privacy"] as const;

const CORNER_POSITIONS = {
	topLeft: "-top-2 -left-2",
	topRight: "-top-2 -right-2",
	bottomLeft: "-bottom-2 -left-2",
	bottomRight: "-right-2 -bottom-2",
} as const;

function CornerMark({ position }: { position: keyof typeof CORNER_POSITIONS }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute z-10 flex size-4 items-center justify-center text-border",
				CORNER_POSITIONS[position],
			)}
		>
			<span className="absolute h-px w-full bg-current" />
			<span className="absolute h-full w-px bg-current" />
		</span>
	);
}

function LegalNavigation() {
	return (
		<nav aria-label="Legal" className="py-8 md:sticky md:top-8 md:py-12">
			<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.32em]">
				Legal
			</p>
			<ul className="mt-4 flex flex-wrap gap-1 md:mt-6 md:flex-col md:flex-nowrap md:gap-0.5">
				{LEGAL_PAGES.map((item) => {
					const isActive = item === "Privacy";

					return (
						<li className="md:w-full" key={item}>
							<span
								aria-current={isActive ? "page" : undefined}
								className={cn(
									"relative flex items-center rounded-sm px-3 py-2 font-mono text-[13px] tracking-tight md:rounded-none md:py-1.5 md:pr-2 md:pl-4",
									isActive
										? "bg-primary/10 text-primary before:absolute before:inset-y-0 before:left-0 before:hidden before:w-px before:bg-primary md:before:block"
										: "text-muted-foreground",
								)}
							>
								{item}
							</span>
							{isActive ? (
								<ol className="mt-3 ml-4 hidden flex-col gap-0.5 md:flex">
									{PRIVACY_CLAUSES.map((clause) => (
										<li key={clause.id}>
											<a
												className="block py-1.5 text-muted-foreground text-xs leading-snug transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
												href={`#${clause.id}`}
											>
												{clause.title}
											</a>
										</li>
									))}
								</ol>
							) : null}
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

export interface LegalLayoutProps {
	children?: ReactNode;
}

export default function LegalLayout({
	children = <PrivacyPolicyPage />,
}: LegalLayoutProps) {
	return (
		<main className="min-h-svh bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8 lg:py-16">
			<div className="relative mx-auto w-full max-w-6xl border border-border border-dashed">
				<CornerMark position="topLeft" />
				<CornerMark position="topRight" />
				<CornerMark position="bottomLeft" />
				<CornerMark position="bottomRight" />

				<div className="grid grid-cols-1 md:grid-cols-[12rem_minmax(0,1fr)]">
					<aside className="border-border border-b border-dashed px-6 md:border-r md:border-b-0 md:px-5">
						<LegalNavigation />
					</aside>
					<div className="min-w-0 px-6 py-10 md:px-10 md:py-12 lg:px-14">
						{children}
					</div>
				</div>
			</div>
		</main>
	);
}
