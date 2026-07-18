import { cn } from "@/lib/utils";

import Marker from "./marker";

function SectionGrain() {
	return (
		<div
			aria-hidden="true"
			className="film-grain pointer-events-none absolute inset-0 -z-10 opacity-[0.06] dark:opacity-[0.03]"
		/>
	);
}

function GutterGrain() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 -z-10 hidden lg:block"
		>
			<span className="film-grain absolute inset-y-0 left-0 w-[calc((100%-72rem)/2)] opacity-[0.12] dark:opacity-[0.06]" />
			<span className="film-grain absolute inset-y-0 right-0 w-[calc((100%-72rem)/2)] opacity-[0.12] dark:opacity-[0.06]" />
		</div>
	);
}

function Section({
	children,
	className,
	borderClassName = "border-border",
	line = true,
}: {
	children: React.ReactNode;
	className?: string;
	borderClassName?: string;
	line?: boolean;
}) {
	return (
		<section
			className={cn(
				"relative isolate mx-auto w-full px-2 lg:w-[calc(100%-4rem)]",
				"lg:border-x lg:border-dashed",
				borderClassName,
				line && "screen-line-top screen-line-bottom",
			)}
		>
			<GutterGrain />
			<Marker position="top-left" className="hidden lg:block" />
			<Marker position="top-right" className="hidden lg:block" />
			<Marker position="bottom-left" className="hidden lg:block" />
			<Marker position="bottom-right" className="hidden lg:block" />
			<div
				className={cn(
					"relative mx-auto w-full max-w-6xl",
					"border-x border-dashed",
					borderClassName,
				)}
			>
				<SectionGrain />
				<div className={cn("relative", className)}>{children}</div>
				<Marker position="top-left" />
				<Marker position="top-right" />
				<Marker position="bottom-left" />
				<Marker position="bottom-right" />
			</div>
		</section>
	);
}

export default Section;
