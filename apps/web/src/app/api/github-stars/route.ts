import { fetchStarCount } from "@/lib/github";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
	const stargazersCount = await fetchStarCount();
	return Response.json({ stargazersCount });
}
