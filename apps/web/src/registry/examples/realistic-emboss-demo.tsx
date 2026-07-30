"use client";

import { useDialKit } from "dialkit";

import { RealisticEmboss } from "@/registry/components/realistic-emboss";

export default function RealisticEmbossDemo() {
	const params = useDialKit("Realistic Emboss", {
		text: {
			type: "text",
			default: "ATELIER",
			placeholder: "Type a word",
		},
		surface: {
			type: "color",
			default: "#cbb99f",
		},
		depth: [1.3, 0.2, 2, 0.01],
		size: [2.2, 1, 8, 0.1],
		soften: [0.45, 0, 4, 0.05],
		lightAngle: [315, 0, 360, 1],
		lightAltitude: [28, 0, 90, 1],
		grain: [0.7, 0, 1.4, 0.01],
	});

	return (
		<div className="w-full max-w-3xl px-4">
			<RealisticEmboss
				aria-label={`${params.text || "ATELIER"} embossed into a clay surface`}
				className="aspect-[3/2] w-full rounded-[2rem]"
				color={params.surface}
				contentScale={0.24}
				depth={params.depth}
				grain={params.grain}
				highlight={0.28}
				lightAltitude={params.lightAltitude}
				lightAngle={params.lightAngle}
				shadow={0.36}
				size={params.size}
				soften={params.soften}
				text={params.text || "ATELIER"}
			/>
		</div>
	);
}
