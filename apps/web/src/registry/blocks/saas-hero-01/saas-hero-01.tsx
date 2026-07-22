"use client";

import {
	MotionConfig,
	motion,
	useReducedMotion,
	useScroll,
	useTransform,
} from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { SyntheticEvent } from "react";
import { Button } from "@/components/ui/button";
import { PeepingButton } from "@/registry/components/peeping-button";

import { SiteHeader } from "./header";

export { SiteHeader };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export const SAAS_HERO_ASSETS = {
	background: {
		local: "/pixel-mountain-lake-hero-v2.png",
		hosted: "https://tentui.com/pixel-mountain-lake-hero-v2.png",
	},
	dashboard: {
		local: "/sass-hero-dashboard.png",
		hosted: "https://tentui.com/sass-hero-dashboard.png",
	},
} as const;

const SERIF =
	"'Iowan Old Style', 'Palatino Linotype', Georgia, Cambria, 'Times New Roman', serif";

export type HeroProps = {
	backgroundImageSrc?: string;
	dashboardImageSrc?: string;
};

function loadHostedFallback(
	event: SyntheticEvent<HTMLImageElement>,
	fallbackSrc?: string,
) {
	if (!fallbackSrc || event.currentTarget.src === fallbackSrc) return;
	event.currentTarget.src = fallbackSrc;
}

export function Hero({
	backgroundImageSrc = SAAS_HERO_ASSETS.background.local,
	dashboardImageSrc = SAAS_HERO_ASSETS.dashboard.local,
}: HeroProps = {}) {
	const router = useRouter();

	const { scrollY } = useScroll();
	const shouldReduceMotion = useReducedMotion();
	const imageClipPath = useTransform(
		scrollY,
		[0, 600],
		["inset(0 4% 0 4%)", "inset(0 0% 0 0%)"],
	);

	return (
		<MotionConfig reducedMotion="user">
			<SiteHeader />
			<section className="relative w-full text-foreground">
				{/* Hero body */}
				<div className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-16 text-center sm:pt-24">
					<motion.h1
						animate={{ opacity: 1, transform: "translateY(0px)" }}
						className="mt-8 font-normal text-[3.5rem] text-foreground leading-[1.04] tracking-[-0.02em] md:text-[5.25rem]"
						initial={{ opacity: 0, transform: "translateY(22px)" }}
						style={{ fontFamily: SERIF }}
						transition={{ duration: 0.55, delay: 0.08, ease: EASE_OUT }}
					>
						Turn website visitors
						<br className="hidden sm:block" /> into{" "}
						<em className="italic">Customers</em>
					</motion.h1>

					<motion.p
						animate={{ opacity: 1, transform: "translateY(0px)" }}
						className="mt-7 max-w-lg text-balance text-[1.05rem] text-muted-foreground leading-relaxed sm:text-lg"
						initial={{ opacity: 0, transform: "translateY(16px)" }}
						transition={{ duration: 0.5, delay: 0.2, ease: EASE_OUT }}
					>
						Customer support, sales & automations in five minutes.
					</motion.p>

					<motion.div
						animate={{ opacity: 1, transform: "translateY(0px)" }}
						className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
						initial={{ opacity: 0, transform: "translateY(16px)" }}
						transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT }}
					>
						<Button
							aria-label="Start free trial"
							className="min-w-40"
							onClick={() => router.push("#")}
							size="lg"
						>
							Start free trial
						</Button>
						<PeepingButton
							aria-label="Pricing"
							className="min-h-[51px] min-w-[160px]"
							coverClassName="px-6 py-4"
							onClick={() => router.push("#")}
						>
							Pricing
						</PeepingButton>
					</motion.div>

					<p className="mt-5 text-muted-foreground text-sm">
						15-day free trial. No credit card required.
					</p>
				</div>

				<motion.div
					className="relative mx-auto mt-16 w-full max-w-[1600px] overflow-hidden bg-background sm:mt-24"
					style={shouldReduceMotion ? undefined : { clipPath: imageClipPath }}
				>
					{/* Decorative product backdrop. */}
					<Image
						alt=""
						aria-hidden="true"
						className="object-cover object-center [image-rendering:pixelated]"
						fill
						onError={(event) =>
							loadHostedFallback(
								event,
								backgroundImageSrc === SAAS_HERO_ASSETS.background.local
									? SAAS_HERO_ASSETS.background.hosted
									: undefined,
							)
						}
						priority
						sizes="(min-width: 100rem) 100rem, 100vw"
						src={backgroundImageSrc}
						unoptimized
					/>

					{/* Product screenshot with an intrinsic aspect ratio, so it cannot collapse. */}
					<div className="relative flex justify-center px-4 py-10 sm:px-10 sm:py-16 lg:px-16 lg:py-24">
						<figure className="w-full max-w-6xl">
							<div className="overflow-hidden rounded-lg border border-border/70 bg-background shadow-2xl ring-1 ring-background/50">
								<Image
									alt="Acme Tickets dashboard overview showing ticket sources and usage"
									className="h-auto w-full"
									height={1684}
									onError={(event) =>
										loadHostedFallback(
											event,
											dashboardImageSrc === SAAS_HERO_ASSETS.dashboard.local
												? SAAS_HERO_ASSETS.dashboard.hosted
												: undefined,
										)
									}
									priority
									sizes="(min-width: 80rem) 72rem, (min-width: 40rem) calc(100vw - 5rem), calc(100vw - 2rem)"
									src={dashboardImageSrc}
									unoptimized
									width={2940}
								/>
							</div>
							<figcaption className="mx-auto mt-4 w-fit rounded-full border border-border/70 bg-background/80 px-3 py-1 text-center text-foreground text-xs shadow-sm backdrop-blur-sm">
								This dashboard uses demo data.
							</figcaption>
						</figure>
					</div>
				</motion.div>
			</section>
		</MotionConfig>
	);
}

export default Hero;
