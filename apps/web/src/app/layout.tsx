import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";

import "../index.css";
import { cn } from "@tentui.com/ui/lib/utils";
import Providers from "@/components/providers";
import { META_THEME_COLORS, SITE_INFO } from "@/config/site";
import { JsonLdScript, websiteJsonLd } from "@/lib/json-ld";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const darkModeScript = `
	try {
		if (localStorage.theme === "dark" || ((!('theme' in localStorage) || localStorage.theme === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
			document.querySelector('meta[name="theme-color"]').setAttribute("content", "${META_THEME_COLORS.dark}")
		}
	} catch (_) {}

	try {
		if (/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)) {
			document.documentElement.classList.add("os-macos")
		}
	} catch (_) {}
`;

const geist = Geist({
	variable: "--font-geist",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	metadataBase: new URL(SITE_INFO.url),
	title: {
		default: SITE_INFO.name,
		template: `%s – ${SITE_INFO.name}`,
	},
	description: SITE_INFO.description,
	openGraph: {
		siteName: SITE_INFO.name,
		url: "/",
		type: "website",
		locale: "en_US",
		images: [
			{
				url: `/og/simple?title=${encodeURIComponent(SITE_INFO.name)}&description=${encodeURIComponent(SITE_INFO.description)}`,
				width: 1200,
				height: 630,
				alt: SITE_INFO.name,
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		images: [
			`/og/simple?title=${encodeURIComponent(SITE_INFO.name)}&description=${encodeURIComponent(SITE_INFO.description)}`,
		],
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: META_THEME_COLORS.light,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={cn(
				geist.variable,
				geistMono.variable,
				"font-sans",
				inter.variable,
			)}
			suppressHydrationWarning
		>
			<head>
				<JsonLdScript data={websiteJsonLd()} />
				<script
					defer
					src="https://co.srb.codes/script.js"
					data-website-id="3386bacf-e7d1-4a4e-8b1a-5e8da0d89194"
				/>
				<script
					type="text/javascript"
					dangerouslySetInnerHTML={{ __html: darkModeScript }}
				/>
			</head>
			<body className="antialiased">
				<Providers>{children}</Providers>
				<Script
					src="https://cdn.tkit.ai/widget.js"
					data-project-id="a0yPCWkO"
					strategy="afterInteractive"
				/>
			</body>
		</html>
	);
}
