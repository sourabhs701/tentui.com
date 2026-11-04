import { getSponsorSlots } from "@/lib/sponsors/store";

export async function GET() {
	const slots = await getSponsorSlots();

	return Response.json(slots, {
		headers: { "Cache-Control": "public, s-maxage=60" },
	});
}
