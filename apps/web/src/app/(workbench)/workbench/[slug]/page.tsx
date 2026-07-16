import { ArrowLeftIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { experiments, getExperiment } from "@/workbench/experiments";

export function generateStaticParams() {
	if (process.env.NODE_ENV !== "development") {
		return [];
	}

	return experiments.map((experiment) => ({ slug: experiment.slug }));
}

export default async function WorkbenchExperimentPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const experiment = getExperiment(slug);

	if (!experiment) {
		notFound();
	}

	const Component = experiment.component;

	return (
		<div className="flex min-h-full flex-col">
			<div className="flex items-center gap-3 border-b px-4 py-2 text-sm">
				<Link
					href={"/workbench" as Route}
					className="text-muted-foreground transition-colors hover:text-foreground"
				>
					<ArrowLeftIcon />
				</Link>
				<span className="text-muted-foreground/40">/</span>
				<span className="font-medium">{experiment.title}</span>
			</div>
			<div
				className={cn(
					"min-h-0 flex-1",
					!experiment.fullBleed &&
						"flex items-start justify-center p-6 md:p-10",
				)}
			>
				{experiment.fullBleed ? (
					<Component />
				) : (
					<div className="w-full max-w-5xl overflow-hidden rounded-xl border bg-background shadow-sm">
						<Component />
					</div>
				)}
			</div>
		</div>
	);
}
