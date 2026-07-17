import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import "../index.css";
import { cn } from "@tentui.com/ui/lib/utils";
import Providers from "@/components/providers";
import { META_THEME_COLORS } from "@/config/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const darkModeScript = String.raw`
	try {
		if (localStorage.theme === "dark" || ((!('theme' in localStorage) || localStorage.theme === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
			document.querySelector('meta[name="theme-color"]').setAttribute("content", "${META_THEME_COLORS.dark}")
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
	metadataBase: new URL("https://tentui.com"),
	title: {
		default: "TentUI",
		template: "%s – TentUI",
	},
	description:
		"Beautiful, open-source interface blocks for modern web applications.",
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
				<script
					type="text/javascript"
					dangerouslySetInnerHTML={{ __html: darkModeScript }}
				/>
			</head>
			<body className="antialiased">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
