import { ImageResponse } from "next/og";

import { getTentUiMarkSVG } from "@/components/tentui-mark";
import { SITE_INFO } from "@/config/site";
import { loadOgFonts } from "../fonts";
import { clampParam } from "../params";

const WIDTH = 1200;
const HEIGHT = 630;
const PADDING_X = 80;

// Tailwind blue-500, the same token as the site-wide OG image.
const BLUE = "#2b7fff";

// Words that read as cut off when an excerpt stops on them.
const DANGLING_WORDS =
	/(?:\s+(?:a|an|and|as|by|for|from|in|into|of|on|or|that|the|to|with))+$/i;

// Two lines of the 28px description at its 940px measure.
const MAX_DESCRIPTION = 125;

function markDataUri(color: string, opacity = 1) {
	const svg = getTentUiMarkSVG()
		.replaceAll("currentColor", color)
		.replace("<svg ", `<svg opacity="${opacity}" `);
	return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Shortens to `max` characters, preferring the end of a clause (a comma or
 * dash) and falling back to a word boundary, so it never stops mid-word.
 */
function trimToWords(value: string, max: number) {
	if (value.length <= max) return value;
	const cut = value.slice(0, max);
	const clause = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf(" – "));
	const space = cut.lastIndexOf(" ");
	const end = clause >= max * 0.55 ? clause : space > 0 ? space : max;
	const excerpt = cut
		.slice(0, end)
		.replace(DANGLING_WORDS, "")
		.replace(/[\s,.;:–-]+$/, "");
	return `${excerpt}…`;
}

/** First sentence when it reads well on its own, otherwise a word-trimmed excerpt. */
function summarize(description: string) {
	const firstSentence = description.match(/^.+?[.!?](?=\s|$)/)?.[0];
	if (
		firstSentence &&
		firstSentence.length >= 60 &&
		firstSentence.length <= MAX_DESCRIPTION
	)
		return firstSentence;
	return trimToWords(description, MAX_DESCRIPTION);
}

function titleSize(title: string) {
	if (title.length <= 16) return 104;
	if (title.length <= 24) return 88;
	if (title.length <= 34) return 72;
	return 60;
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const title = clampParam(searchParams.get("title"), 60, SITE_INFO.name);
	const description = summarize(
		clampParam(searchParams.get("description"), 400),
	);
	const fonts = await loadOgFonts(
		`${SITE_INFO.name}${title}${description}ComponentshadcnuiReact…`,
	);

	return new ImageResponse(
		<div
			style={{
				background: BLUE,
				color: "#ffffff",
				display: "flex",
				flexDirection: "column",
				fontFamily: "Inter",
				height: "100%",
				position: "relative",
				width: "100%",
			}}
		>
			{/* Oversized mark as a quiet watermark, bleeding off the top-right. */}
			{/* biome-ignore lint/performance/noImgElement: Satori renders plain img only. */}
			<img
				alt=""
				src={markDataUri("#ffffff", 0.08)}
				width={420}
				height={358}
				style={{ position: "absolute", right: -36, top: -28 }}
			/>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100%",
					justifyContent: "space-between",
					padding: `64px ${PADDING_X}px 68px`,
					width: "100%",
				}}
			>
				<header
					style={{
						alignItems: "center",
						display: "flex",
						justifyContent: "space-between",
						width: "100%",
					}}
				>
					<div style={{ alignItems: "flex-end", display: "flex", gap: 14 }}>
						{/* biome-ignore lint/performance/noImgElement: Satori renders plain img only. */}
						<img alt="" src={markDataUri("#ffffff")} width={50} height={43} />
						<div
							style={{
								display: "flex",
								fontSize: 44,
								fontWeight: 500,
								letterSpacing: "-0.07em",
								lineHeight: 0.9,
							}}
						>
							{SITE_INFO.name}
						</div>
					</div>
				</header>

				<main style={{ display: "flex", flexDirection: "column" }}>
					<div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
						<Pill strong>Component</Pill>
						<Pill>React</Pill>
						<Pill>shadcn/ui</Pill>
					</div>

					<div
						style={{
							display: "flex",
							fontSize: titleSize(title),
							fontWeight: 600,
							letterSpacing: "-0.055em",
							lineHeight: 0.95,
							maxWidth: WIDTH - PADDING_X * 2,
						}}
					>
						{title}
					</div>

					{description ? (
						<div
							style={{
								color: "rgba(255, 255, 255, 0.82)",
								display: "flex",
								fontSize: 28,
								fontWeight: 500,
								letterSpacing: "-0.02em",
								lineHeight: 1.35,
								marginTop: 22,
								maxWidth: 940,
							}}
						>
							{description}
						</div>
					) : null}
				</main>
			</div>
		</div>,
		{
			width: WIDTH,
			height: HEIGHT,
			// An empty array would replace next/og's bundled fallback font and fail.
			fonts: fonts.length > 0 ? fonts : undefined,
			headers: {
				"Cache-Control": "public, max-age=3600, s-maxage=31536000, immutable",
			},
		},
	);
}

function Pill({
	children,
	strong = false,
}: {
	children: string;
	strong?: boolean;
}) {
	return (
		<div
			style={{
				background: strong
					? "rgba(255, 255, 255, 0.25)"
					: "rgba(255, 255, 255, 0.14)",
				borderRadius: 9,
				color: strong ? "#ffffff" : "rgba(255, 255, 255, 0.8)",
				display: "flex",
				fontSize: 24,
				fontWeight: 500,
				letterSpacing: "-0.03em",
				lineHeight: 1,
				padding: "9px 14px 10px",
			}}
		>
			{children}
		</div>
	);
}
