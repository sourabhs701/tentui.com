"use client";

import Image from "next/image";
import { PeepingButton } from "@/components/peeping-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { SiteHeader } from "./header";

export { SiteHeader };

export const HERO_02_ASSETS = {
	background: "https://cdn.tentui.com/pixel-mountain-lake-hero-v2.png",
	dashboard: "https://cdn.tentui.com/saas-hero-dashboard.png",
} as const;

const SERIF =
	"'Iowan Old Style', 'Palatino Linotype', Georgia, Cambria, 'Times New Roman', serif";

/**
 * CSS-only entrance (tw-animate-css). It runs straight from the server-rendered
 * HTML, so content is never stuck invisible waiting on hydration, and it is
 * disabled entirely for people who prefer reduced motion.
 */
const ENTER =
	"animate-in fade-in fill-mode-both duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none";

export type Hero02Props = {
	backgroundImageSrc?: string;
	dashboardImageSrc?: string;
	ctaHref?: string;
	pricingHref?: string;
	className?: string;
};

export function Hero02({
	backgroundImageSrc = HERO_02_ASSETS.background,
	dashboardImageSrc = HERO_02_ASSETS.dashboard,
	ctaHref = "#",
	pricingHref = "#pricing",
	className,
}: Hero02Props = {}) {
	return (
		<>
			<SiteHeader ctaHref={ctaHref} />
			<section
				aria-labelledby="hero-02-title"
				className={cn(
					"relative w-full overflow-x-clip bg-background text-foreground",
					className,
				)}
			>
				<div className="mx-auto flex max-w-4xl flex-col items-center px-4 pt-12 text-center sm:px-6 sm:pt-20 lg:pt-24">
					<h1
						className={cn(
							ENTER,
							"slide-in-from-bottom-5 text-balance font-normal text-[2.75rem] text-foreground leading-[1.04] tracking-[-0.02em] delay-75 sm:text-6xl md:text-[5.25rem]",
						)}
						id="hero-02-title"
						style={{ fontFamily: SERIF }}
					>
						Turn website visitors
						<br className="hidden sm:block" /> into{" "}
						<em className="italic">Customers</em>
					</h1>

					<p
						className={cn(
							ENTER,
							"slide-in-from-bottom-4 mt-6 max-w-lg text-balance text-base text-muted-foreground leading-relaxed delay-200 sm:mt-7 sm:text-lg",
						)}
					>
						Customer support, sales &amp; automations in five minutes.
					</p>

					<div
						className={cn(
							ENTER,
							"slide-in-from-bottom-4 mt-8 flex w-full flex-row items-center justify-center gap-3 delay-300 sm:mt-9",
						)}
					>
						<Button
							className="h-12 min-w-36 px-6 text-base sm:min-w-40"
							nativeButton={false}
							render={<a href={ctaHref} />}
							size="lg"
						>
							Start free trial
						</Button>
						<PeepingButton
							className="h-12 min-w-36 text-base sm:min-w-40"
							coverClassName="px-6"
							onClick={() => window.location.assign(pricingHref)}
						>
							Pricing
						</PeepingButton>
					</div>

					<p
						className={cn(
							ENTER,
							"mt-5 text-muted-foreground text-sm delay-300",
						)}
					>
						15-day free trial. No credit card required.
					</p>
				</div>

				<div className="relative mx-auto mt-14 w-full max-w-[1600px] overflow-hidden bg-muted sm:mt-20 lg:mt-24">
					{/* Decorative backdrop. */}
					<Image
						alt=""
						aria-hidden="true"
						className="object-cover object-center [image-rendering:pixelated]"
						fill
						loading="eager"
						sizes="(min-width: 100rem) 100rem, 100vw"
						src={backgroundImageSrc}
						unoptimized
					/>

					<div className="relative flex justify-center px-3 py-8 sm:px-10 sm:py-16 lg:px-16 lg:py-24">
						<figure
							className={cn(
								ENTER,
								"slide-in-from-bottom-6 w-full max-w-6xl delay-500 duration-700",
							)}
						>
							<div className="overflow-hidden rounded-lg border bg-card p-1 shadow-2xl ring-1 ring-foreground/5 sm:rounded-xl sm:p-1.5">
								<Image
									alt="Acme Tickets dashboard overview showing ticket sources and usage"
									className="h-auto w-full rounded-md sm:rounded-lg"
									height={1684}
									priority
									sizes="(min-width: 80rem) 72rem, (min-width: 40rem) calc(100vw - 5rem), calc(100vw - 1.5rem)"
									src={dashboardImageSrc}
									unoptimized
									width={2940}
								/>
							</div>
							<figcaption className="mx-auto mt-4 w-fit rounded-full border bg-background/85 px-3 py-1 text-center text-foreground text-xs shadow-sm backdrop-blur-sm">
								This dashboard uses demo data.
							</figcaption>
						</figure>
					</div>
				</div>
			</section>
		</>
	);
}

export default Hero02;
