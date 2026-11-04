import { isRegistrySlug } from "@/lib/registry-slugs";
import {
	getViews,
	incrementViews,
	isBotRequest,
	isRepeatView,
} from "@/lib/views";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
	const { slug } = await params;
	if (!isRegistrySlug(slug))
		return Response.json({ count: 0 }, { status: 404 });

	const count = await getViews(slug);

	return Response.json(
		{ count },
		{ headers: { "Cache-Control": "public, s-maxage=300" } },
	);
}

export async function POST(request: Request, { params }: RouteContext) {
	const { slug } = await params;
	if (!isRegistrySlug(slug))
		return Response.json({ count: 0 }, { status: 404 });

	const count =
		isBotRequest(request.headers.get("user-agent")) ||
		isRepeatView(slug, request.headers)
			? await getViews(slug)
			: await incrementViews(slug);

	return Response.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
