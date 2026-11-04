import { getDownloads } from "@/lib/downloads";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ slug: string }> },
) {
	const { slug } = await params;
	const count = await getDownloads(slug);

	return Response.json(
		{ count },
		{ headers: { "Cache-Control": "public, s-maxage=300" } },
	);
}
