export default async function ComponentPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	return <div> {slug}</div>;
}
