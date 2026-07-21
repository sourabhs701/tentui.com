import Image from "next/image";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Cta01() {
	return (
		<section className="relative w-full bg-background font-sans text-foreground">
			<div className="relative mx-auto w-full max-w-6xl">
				<div className="flex flex-col gap-6 px-5 pt-12 pb-8 sm:px-6 md:px-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10 lg:px-0">
					<div className="flex flex-col gap-2 lg:max-w-md xl:max-w-lg">
						<h2 className="text-balance font-normal text-[clamp(1.75rem,4.5vw,2.5rem)] leading-[1.15] tracking-[-0.02em]">
							Don&apos;t let your customers leave without a Tkit.
						</h2>
						<p className="max-w-sm text-base text-muted-foreground">
							Turn your website visitors into clients in minutes. No coding
							required.
						</p>
					</div>

					<div className="flex flex-col items-center gap-2 lg:mt-1">
						<a
							className={cn(
								buttonVariants({ size: "lg" }),
								"h-[51px] min-w-40 touch-manipulation px-6 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:translate-y-0 active:scale-[0.97]",
							)}
							href="/login"
						>
							Start free trial
						</a>
						<p className="text-muted-foreground text-sm">
							No credit card required.
						</p>
					</div>
				</div>

				<div className="overflow-hidden outline outline-border -outline-offset-1">
					<Image
						alt="Illustrated cloudy landscape with a boy looking toward distant mountains"
						className="h-[220px] w-full object-cover object-bottom sm:h-[280px] md:h-[320px] lg:h-[360px]"
						height={941}
						sizes="(min-width: 72rem) 72rem, 100vw"
						src="/cta-01-landscape.svg"
						unoptimized
						width={1672}
					/>
				</div>
			</div>
		</section>
	);
}
