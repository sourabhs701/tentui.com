import { AnimatedArrow } from "@/registry/components/animated-arrow";

export default function AnimatedArrowDemo() {
	return (
		<div className="flex w-full items-center justify-center px-4">
			<button
				type="button"
				className="group/animated-arrow inline-flex max-w-full items-center gap-2 rounded-full border bg-muted py-1 pr-1 pl-3 text-sm shadow-md shadow-zinc-950/5 transition-[transform,background-color,border-color] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-background active:scale-[0.98] dark:border-t-white/5 dark:shadow-zinc-950 dark:hover:border-t-border"
			>
				<span className="min-w-0 truncate text-muted-foreground">
					🎉 Announcing our <span className="font-bold">$8.3M</span>
					<span className="hidden sm:inline"> seed funding round</span>
				</span>
				<span className="block h-4 w-px shrink-0 bg-border" />
				<AnimatedArrow className="-rotate-45 rounded-full bg-linear-to-b from-blue-400 to-blue-500 text-white group-hover/animated-arrow:from-blue-500 group-hover/animated-arrow:to-blue-600" />
			</button>
		</div>
	);
}
