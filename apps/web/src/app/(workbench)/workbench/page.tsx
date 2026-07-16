import type { Route } from "next";
import Link from "next/link";

import { experiments } from "@/workbench/experiments";

export default function WorkbenchIndexPage() {
	return (
		<div className="mx-auto w-full max-w-3xl px-4 py-10">
			<div className="mb-8 space-y-2">
				<h1 className="font-medium text-2xl tracking-tight">Experiments</h1>
			</div>

			{experiments.length === 0 ? (
				<div className="rounded-lg border border-dashed px-6 py-12 text-center text-muted-foreground text-sm">
					No experiments yet. Register one in{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
						experiments.tsx
					</code>
					.
				</div>
			) : (
				<ul className="divide-y rounded-lg border">
					{experiments.map((experiment) => (
						<li key={experiment.slug}>
							<Link
								href={`/workbench/${experiment.slug}` as Route}
								className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/50"
							>
								<span className="font-medium text-sm">{experiment.title}</span>
								{experiment.description ? (
									<span className="text-muted-foreground text-xs leading-5">
										{experiment.description}
									</span>
								) : null}
								<span className="font-mono text-[11px] text-muted-foreground/80">
									/workbench/{experiment.slug}
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
