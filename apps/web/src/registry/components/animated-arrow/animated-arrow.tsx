import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type AnimatedArrowProps = {
	className?: string;
};

export function AnimatedArrow({ className }: AnimatedArrowProps) {
	return (
		<div
			data-slot="animated-arrow"
			className={cn("size-6 overflow-hidden", className)}
		>
			<div
				data-slot="animated-arrow-track"
				className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover/animated-arrow:translate-x-0"
			>
				<span className="flex size-6">
					<ArrowRight className="m-auto size-3" />
				</span>
				<span className="flex size-6">
					<ArrowRight className="m-auto size-3" />
				</span>
			</div>
		</div>
	);
}

export default AnimatedArrow;
