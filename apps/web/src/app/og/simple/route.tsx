import { ImageResponse } from "next/og";

import { clampParam } from "../params";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const title = clampParam(searchParams.get("title"), 160, "TentUI");
	const description = clampParam(searchParams.get("description"), 320);

	return new ImageResponse(
		<div
			style={{
				alignItems: "stretch",
				background: "#09090b",
				color: "#fafafa",
				display: "flex",
				flexDirection: "column",
				height: "100%",
				justifyContent: "space-between",
				padding: "48px",
				position: "relative",
				width: "100%",
			}}
		>
			<div
				style={{
					border: "1px solid #27272a",
					display: "flex",
					inset: "48px",
					position: "absolute",
				}}
			/>

			<div
				style={{
					alignItems: "center",
					display: "flex",
					fontFamily: "ui-monospace, monospace",
					fontSize: 24,
					fontWeight: 600,
					gap: 12,
					padding: "24px",
				}}
			>
				<div
					style={{
						alignItems: "center",
						background: "#fafafa",
						borderRadius: 8,
						color: "#09090b",
						display: "flex",
						fontSize: 18,
						height: 36,
						justifyContent: "center",
						width: 36,
					}}
				>
					T
				</div>
				tentui.com
			</div>

			<div
				style={{
					borderTop: "1px solid #27272a",
					display: "flex",
					flexDirection: "column",
					margin: "0 1px 1px",
					padding: "38px 24px 24px",
				}}
			>
				<div
					style={{
						display: "flex",
						fontFamily: "ui-sans-serif, system-ui, sans-serif",
						fontSize: title.length > 64 ? 50 : 64,
						fontWeight: 700,
						letterSpacing: "-0.04em",
						lineHeight: 1,
					}}
				>
					{title}
				</div>
				{description ? (
					<div
						style={{
							color: "#a1a1aa",
							display: "flex",
							fontFamily: "ui-monospace, monospace",
							fontSize: 26,
							lineHeight: 1.3,
							marginTop: 24,
						}}
					>
						{description}
					</div>
				) : null}
			</div>
		</div>,
		{
			width: 1200,
			height: 630,
			headers: {
				"Cache-Control": "public, max-age=3600, s-maxage=31536000, immutable",
			},
		},
	);
}
