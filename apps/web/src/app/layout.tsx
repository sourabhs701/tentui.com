import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";

import "../index.css";
import { cn } from "@tentui.com/ui/lib/utils";
import Providers from "@/components/providers";
import { META_THEME_COLORS, SITE_INFO } from "@/config/site";
import { JsonLdScript, websiteJsonLd } from "@/lib/json-ld";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const OG_IMAGE = "/og-image.png";

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
	manifest: "/favicon_io/site.webmanifest",
	icons: {
		icon: [
			{
				url: "/favicon_io/favicon-16x16.png",
				sizes: "16x16",
				type: "image/png",
			},
			{
				url: "/favicon_io/favicon-32x32.png",
				sizes: "32x32",
				type: "image/png",
			},
		],
		shortcut: "/favicon_io/favicon.ico",
		apple: [
			{
				url: "/favicon_io/apple-touch-icon.png",
				sizes: "180x180",
				type: "image/png",
			},
		],
	},
	openGraph: {
		siteName: SITE_INFO.name,
		url: "/",
		type: "website",
		locale: "en_US",
		images: [
			{
				url: OG_IMAGE,
				width: 1924,
				height: 1080,
				alt: SITE_INFO.name,
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		images: [OG_IMAGE],
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
