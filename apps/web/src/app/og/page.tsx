import { cn } from "@tentui.com/ui/lib/utils";
import { TentUiMark } from "@/components/tentui-mark";
import { SITE_INFO } from "@/config/site";

const CODE_LINES = ["w-[72%]", "w-[88%]", "w-[56%]"] as const;

export default function OgImage() {
	return (
		<div className="flex h-screen w-screen items-center justify-center">
			<main className="relative h-[1080px] w-[1920px] shrink-0 overflow-hidden bg-blue-500 font-sans text-white">
				<div
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute inset-0",
						"bg-[linear-gradient(to_right,var(--color-blue-400)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-blue-400)_1px,transparent_1px)]",
						"bg-size-[200px_200px] opacity-[50%]",
					)}
				/>
				<div
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute inset-0",
						"bg-[linear-gradient(to_right,var(--color-blue-400)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-blue-400)_1px,transparent_1px)]",
						"bg-size-[50px_50px] opacity-[25%]",
					)}
				/>

				<header className="absolute top-[112px] right-[128px] left-[128px] z-20 flex items-end justify-between">
					<div className="flex items-end gap-3 text-white/90">
						<TentUiMark className="size-16" />
						<span className="text-[58px] leading-none tracking-[-0.08em]">
							{SITE_INFO.name}
						</span>
					</div>
				</header>

				<section className="absolute bottom-[126px] left-[128px] z-20 w-[1080px]">
					<div className="mb-12 flex gap-3 text-[36px] leading-none tracking-[-0.04em]">
						<span className="rounded-[9px] bg-white/25 px-3 py-2 font-medium">
							Open-source
						</span>
						<span className="rounded-[9px] bg-white/15 px-3 py-2 text-white/75">
							Components
						</span>
						<span className="rounded-[9px] bg-white/15 px-3 py-2 text-white/75">
							Blocks
						</span>
					</div>

					<h1 className="font-medium text-[200px] leading-[0.86] tracking-[-0.075em]">
						Ship Faster
					</h1>
				</section>

				<ComponentComposition />
			</main>
		</div>
	);
}

function ComponentComposition() {
	return (
		<div
			aria-hidden="true"
			className="absolute top-[246px] right-[110px] z-20 h-[610px] w-[600px]"
		>
			<div className="absolute top-0 right-0 h-[470px] w-[520px] rotate-[2deg] rounded-[38px] border-2 border-white/55 bg-white/10 p-5 shadow-[20px_22px_0_rgba(255,255,255,0.18)]">
				<div className="flex h-full flex-col overflow-hidden rounded-[25px] border border-white/30 bg-blue-500/45">
					<div className="flex h-16 items-center justify-between border-white/30 border-b px-6">
						<div className="flex gap-2.5">
							<span className="size-3 rounded-full bg-white" />
							<span className="size-3 rounded-full bg-white/40" />
							<span className="size-3 rounded-full bg-white/40" />
						</div>
						<div className="h-3 w-24 rounded-full bg-white/30" />
					</div>

					<div className="grid flex-1 grid-cols-3 gap-5 p-6">
						<div className="rounded-[18px] border border-white/25 bg-white/10" />
						<div className="rounded-[18px] border border-white/25 bg-white/20" />
						<div className="rounded-[18px] border border-white/25 bg-white/10" />
					</div>
				</div>
			</div>

			<div className="absolute top-[100px] left-0 w-[350px] -rotate-[3deg] rounded-[30px] border-2 border-white bg-white p-8 text-blue-500 shadow-[12px_14px_0_rgba(255,255,255,0.3)]">
				<div className="flex items-start justify-between">
					<div className="flex size-16 items-center justify-center rounded-[18px] bg-blue-500 text-white">
						<TentUiMark className="h-auto w-10" />
					</div>
					<span className="rounded-full border border-blue-400 px-4 py-2 font-mono text-[13px] uppercase tracking-[0.12em]">
						Live
					</span>
				</div>

				<p className="mt-12 font-medium text-[43px] leading-[1.02] tracking-[-0.055em]">
					Designed to feel
					<br />
					hand-crafted.
				</p>

				<div className="mt-9 flex items-center gap-3">
					<div className="h-3 flex-1 rounded-full bg-blue-400/35">
						<div className="h-full w-[68%] rounded-full bg-blue-500" />
					</div>
					<span className="font-mono text-[13px]">68%</span>
				</div>
			</div>

			<div className="absolute right-0 bottom-0 w-[350px] rotate-[1.5deg] rounded-[28px] border-2 border-white/80 bg-blue-500 p-7 shadow-[11px_13px_0_rgba(255,255,255,0.22)]">
				<div className="flex items-center justify-between">
					<p className="font-medium font-mono text-[13px] text-white/70 uppercase tracking-[0.12em]">
						Component.tsx
					</p>
					<div className="flex size-10 items-center justify-center rounded-xl bg-white text-blue-500">
						<span className="font-bold font-mono text-[20px]">+</span>
					</div>
				</div>

				<div className="mt-7 flex flex-col gap-4">
					{CODE_LINES.map((width, index) => (
						<div key={width} className="flex items-center gap-4">
							<span className="font-mono text-[12px] text-white/55">
								0{index + 1}
							</span>
							<span className={cn("h-3 rounded-full bg-white/35", width)} />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
