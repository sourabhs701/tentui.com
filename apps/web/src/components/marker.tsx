import { cn } from "@/lib/utils";

type MarkerPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const positionClasses: Record<MarkerPosition, string> = {
	"top-left": "top-[-2.5px] left-[-3.5px]",
	"top-right": "top-[-2.5px] right-[-3.5px]",
	"bottom-left": "bottom-[-2.5px] left-[-3.5px]",
	"bottom-right": "bottom-[-2.5px] right-[-3.5px]",
};

function Marker({
	position = "top-left",
	className,
}: {
	position?: MarkerPosition;
	className?: string;
}) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"absolute z-2 flex size-1.5 rotate-45 border border-line bg-background",
				positionClasses[position],
				className,
			)}
		/>
	);
}

export default Marker;
