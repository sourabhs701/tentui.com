"use client";

import {
	CarFrontIcon,
	CarIcon,
	ChevronRightIcon,
	CreditCardIcon,
	MapPinIcon,
	SearchIcon,
	TicketIcon,
	ZapIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SnapSheet } from "@/registry/components/snap-sheet/snap-sheet";

const rides = [
	{
		id: "go",
		name: "Go",
		detail: "2 min · 4 seats",
		price: "$9.40",
		icon: CarIcon,
	},
	{
		id: "comfort",
		name: "Comfort",
		detail: "4 min · Newer cars",
		price: "$14.20",
		icon: CarFrontIcon,
	},
	{
		id: "electric",
		name: "Electric",
		detail: "6 min · Zero emissions",
		price: "$15.80",
		icon: ZapIcon,
	},
];

function MapBackdrop() {
	return (
		<svg
			aria-hidden
			viewBox="0 0 300 560"
			preserveAspectRatio="xMidYMid slice"
			className="absolute inset-0 size-full"
		>
			<g
				fill="none"
				strokeLinecap="round"
				className="stroke-white/80 dark:stroke-white/10"
			>
				<path d="M-20 120 C 80 100, 160 180, 320 150" strokeWidth="14" />
				<path d="M60 -20 C 70 140, 40 300, 90 580" strokeWidth="10" />
				<path d="M-20 360 C 100 330, 200 400, 320 340" strokeWidth="12" />
				<path d="M210 -20 C 190 160, 260 300, 230 580" strokeWidth="8" />
				<path d="M-20 250 L 320 270" strokeWidth="6" />
			</g>
			<path
				d="M90 470 C 110 380, 70 320, 130 270 S 220 190, 224 120"
				fill="none"
				strokeWidth="4"
				strokeLinecap="round"
				strokeDasharray="1 8"
				className="stroke-sky-500"
			/>
		</svg>
	);
}

function SnapSheetDemo() {
	const screenRef = useRef<HTMLDivElement>(null);
	const [selected, setSelected] = useState("comfort");
	const selectedRide = rides.find((ride) => ride.id === selected) ?? rides[0];

	return (
		<div className="rounded-[46px] bg-zinc-900 p-2 shadow-xl ring-1 ring-black/10 dark:bg-zinc-800 dark:ring-white/10">
			<div
				ref={screenRef}
				className="relative h-[540px] w-[290px] overflow-clip rounded-[38px] bg-black"
			>
				<SnapSheet
					defaultOpen
					defaultSnap={1}
					snapPoints={["148px", 0.5, 1]}
					modal={false}
					scaleBackground
				>
					<div
						data-sheet-wrapper
						className="absolute inset-0 overflow-hidden bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 dark:from-slate-900 dark:via-slate-800 dark:to-zinc-900"
					>
						<MapBackdrop />
						<span className="absolute top-[108px] left-[214px] grid size-5 place-items-center rounded-full bg-sky-500 ring-4 ring-sky-500/25">
							<span className="size-2 rounded-full bg-white" />
						</span>
						<MapPinIcon
							aria-hidden
							className="absolute top-[452px] left-[78px] size-6 fill-rose-500 text-white"
						/>
						<div className="absolute inset-x-4 top-12 flex h-11 items-center gap-2 rounded-full bg-background/90 px-4 text-muted-foreground text-sm shadow-sm backdrop-blur">
							<SearchIcon className="size-4" />
							Where to?
						</div>
						<SnapSheet.Trigger className="absolute inset-x-4 bottom-6 h-12 cursor-pointer rounded-full bg-foreground font-medium text-background text-sm shadow-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
							Find a ride
						</SnapSheet.Trigger>
					</div>

					<SnapSheet.Content container={screenRef} className="max-w-none">
						<SnapSheet.Handle className="mt-1.5" />
						<div className="flex items-start justify-between gap-3 px-5 pt-1 pb-3">
							<div>
								<SnapSheet.Title>3 rides nearby</SnapSheet.Title>
								<SnapSheet.Description>
									Pickup at Market St in 2 min
								</SnapSheet.Description>
							</div>
							<SnapSheet.Close />
						</div>

						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6">
							<div
								role="radiogroup"
								aria-label="Ride options"
								className="grid gap-1"
							>
								{rides.map((ride) => {
									const Icon = ride.icon;
									const active = ride.id === selected;
									return (
										<button
											key={ride.id}
											type="button"
											role="radio"
											aria-checked={active}
											onClick={() => setSelected(ride.id)}
											className={cn(
												"flex cursor-pointer items-center gap-3 rounded-2xl border border-transparent p-2.5 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
												active ? "border-border bg-muted" : "hover:bg-muted/60",
											)}
										>
											<span className="grid size-11 place-items-center rounded-xl bg-background ring-1 ring-border">
												<Icon className="size-5" />
											</span>
											<span className="min-w-0 flex-1">
												<span className="block font-medium text-sm">
													{ride.name}
												</span>
												<span className="block text-muted-foreground text-xs">
													{ride.detail}
												</span>
											</span>
											<span className="font-medium text-sm tabular-nums">
												{ride.price}
											</span>
										</button>
									);
								})}
							</div>

							<p className="mt-5 mb-2 px-2 font-medium text-muted-foreground text-xs">
								Payment
							</p>
							<div className="grid divide-y overflow-hidden rounded-2xl border">
								<div className="flex items-center gap-3 p-3 text-sm">
									<CreditCardIcon className="size-4 text-muted-foreground" />
									<span className="flex-1">Personal card ···· 4242</span>
									<ChevronRightIcon className="size-4 text-muted-foreground" />
								</div>
								<div className="flex items-center gap-3 p-3 text-sm">
									<TicketIcon className="size-4 text-muted-foreground" />
									<span className="flex-1">Add a promo code</span>
									<ChevronRightIcon className="size-4 text-muted-foreground" />
								</div>
							</div>

							<p className="mt-5 mb-2 px-2 font-medium text-muted-foreground text-xs">
								Trip
							</p>
							<div className="grid gap-2 rounded-2xl border p-3 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Distance</span>
									<span className="tabular-nums">4.2 mi</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Arrival</span>
									<span className="tabular-nums">6:42 PM</span>
								</div>
							</div>

							<button
								type="button"
								className="mt-5 h-12 w-full cursor-pointer rounded-full bg-foreground font-medium text-background text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
							>
								Confirm {selectedRide.name} · {selectedRide.price}
							</button>
						</div>
					</SnapSheet.Content>
				</SnapSheet>
			</div>
		</div>
	);
}

export default SnapSheetDemo;
