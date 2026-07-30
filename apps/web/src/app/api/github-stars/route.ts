import { fetchGitHubStargazerCount } from "@/lib/github";

const REVALIDATE_SECONDS = 86400;

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
	const stargazersCount = await fetchGitHubStargazerCount(REVALIDATE_SECONDS);
	return Response.json({ stargazersCount });
}
