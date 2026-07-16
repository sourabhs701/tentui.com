export default function GradientHero01() {
	return (
		<section className="relative min-h-screen overflow-hidden bg-background font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-foreground">
			<div
				className="absolute inset-x-[-18%] bottom-[-34%] h-[78%] rounded-[100%] blur-3xl"
				style={{
					background:
						"radial-gradient(ellipse at center, rgba(56, 189, 248, 0.58) 0%, rgba(59, 130, 246, 0.34) 34%, rgba(99, 102, 241, 0.2) 58%, transparent 78%)",
				}}
			/>
			<div
				className="absolute inset-x-0 bottom-0 h-[68%]"
				style={{
					background:
						"linear-gradient(to top, rgba(37, 99, 235, 0.42), rgba(14, 165, 233, 0.2) 42%, transparent 78%)",
				}}
			/>
			<div
				className="absolute inset-0"
				style={{
					background:
						"radial-gradient(circle at 50% 55%, color-mix(in oklab, var(--background) 18%, transparent) 0%, transparent 34%, color-mix(in oklab, var(--background) 90%, transparent) 78%)",
				}}
			/>
			<div
				className="absolute inset-0"
				style={{
					background:
						"linear-gradient(to bottom, var(--background) 0%, color-mix(in oklab, var(--background) 68%, transparent) 38%, color-mix(in oklab, var(--background) 12%, transparent) 100%)",
				}}
			/>

			<div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-24 text-center">
				<h1 className="mt-8 max-w-5xl text-balance font-medium text-5xl leading-[0.96] tracking-normal md:text-6xl lg:text-7xl">
					Launch pages that feel finished from the first pass
				</h1>

				<p className="mt-6 max-w-2xl text-pretty text-base text-muted-foreground leading-7 md:text-lg">
					Simple sections with considered spacing, quiet motion, and production
					ready code you can paste into real product work.
				</p>

				<div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
					<a
						className="inline-flex h-11 w-36 items-center justify-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground text-sm shadow-[0_1px_0_rgba(255,255,255,0.24)_inset,0_18px_60px_rgba(0,0,0,0.12)] transition hover:opacity-90"
						href="/blocks"
					>
						Explore Blocks
					</a>
					<a
						className="inline-flex h-11 w-36 items-center justify-center rounded-lg border border-border bg-background/45 px-5 font-semibold text-foreground/80 text-sm shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] backdrop-blur transition hover:bg-foreground/5 hover:text-foreground"
						href="https://github.com/sourabhs701/tentui.com"
					>
						View Source
					</a>
				</div>
			</div>
		</section>
	);
}
