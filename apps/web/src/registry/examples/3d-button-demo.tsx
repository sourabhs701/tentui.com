import { ArrowRightIcon, PlusIcon } from "lucide-react";

import { ThreeDButton } from "@/registry/components/3d-button";

export function ThreeDButtonDemo() {
	return (
		<div className="flex w-full flex-col gap-10 p-6 sm:p-10">
			<section className="flex flex-col gap-4">
				<h2 className="font-medium text-muted-foreground text-sm">Variants</h2>
				<div className="flex flex-wrap items-center gap-4">
					<ThreeDButton>Default</ThreeDButton>
					<ThreeDButton variant="secondary">Secondary</ThreeDButton>
					<ThreeDButton variant="destructive">Destructive</ThreeDButton>
				</div>
			</section>

			<section className="flex flex-col gap-4">
				<h2 className="font-medium text-muted-foreground text-sm">Sizes</h2>
				<div className="flex flex-wrap items-center gap-4">
					<ThreeDButton size="sm">Small</ThreeDButton>
					<ThreeDButton variant="secondary">Default</ThreeDButton>
					<ThreeDButton size="lg" variant="destructive">
						Large
					</ThreeDButton>
				</div>
			</section>

			<section className="flex flex-col gap-4">
				<h2 className="font-medium text-muted-foreground text-sm">Icons</h2>
				<div className="flex flex-wrap items-center gap-4">
					<ThreeDButton size="icon" aria-label="Add item">
						<PlusIcon />
					</ThreeDButton>
					<ThreeDButton size="icon" variant="secondary" aria-label="Continue">
						<ArrowRightIcon />
					</ThreeDButton>
				</div>
			</section>

			<section className="flex flex-col gap-4">
				<h2 className="font-medium text-muted-foreground text-sm">Disabled</h2>
				<div className="flex flex-wrap items-center gap-4">
					<ThreeDButton disabled>Default</ThreeDButton>
					<ThreeDButton disabled variant="secondary">
						Secondary
					</ThreeDButton>
					<ThreeDButton disabled variant="destructive">
						Destructive
					</ThreeDButton>
				</div>
			</section>
		</div>
	);
}

export default ThreeDButtonDemo;
