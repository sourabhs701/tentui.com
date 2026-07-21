import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const componentPathPrefix = "/components/";

export function middleware(request: NextRequest) {
	if (request.nextUrl.pathname.endsWith(".mdx")) {
		return NextResponse.next();
	}

	if (!acceptsMarkdown(request.headers.get("accept"))) {
		return NextResponse.next();
	}

	const response = NextResponse.rewrite(getMarkdownUrl(request));
	response.headers.append("Vary", "Accept");
	return response;
}

export const config = {
	matcher: "/components/:slug",
};

function acceptsMarkdown(accept: string | null) {
	if (!accept) return false;

	return accept.split(",").some((range) => {
		const [mediaType, ...parameters] = range
			.split(";")
			.map((part) => part.trim());

		if (mediaType.toLowerCase() !== "text/markdown") return false;

		const quality = parameters
			.map((parameter) => parameter.split("=", 2))
			.find(([name]) => name.trim().toLowerCase() === "q")?.[1];

		return quality === undefined || Number(quality) > 0;
	});
}

function getMarkdownUrl(request: NextRequest) {
	const url = request.nextUrl.clone();
	const slug = url.pathname.slice(componentPathPrefix.length);
	url.pathname = `/doc.mdx/${slug}`;
	return url;
}
