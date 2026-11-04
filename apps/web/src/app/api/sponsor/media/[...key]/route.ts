import { getMedia } from "@/lib/sponsors/store";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ key: string[] }> },
) {
	const { key } = await params;
	const object = await getMedia(key.join("/"));
	if (!object) return new Response("Not found", { status: 404 });

	return new Response(object.body, {
		headers: {
			"Content-Type":
				object.httpMetadata?.contentType ?? "application/octet-stream",
			"Cache-Control": "public, max-age=31536000, immutable",
			"X-Content-Type-Options": "nosniff",
			// Uploaded SVGs can carry scripts; never let them run if opened directly.
			"Content-Security-Policy":
				"default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
		},
	});
}
