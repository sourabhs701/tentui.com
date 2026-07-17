import { cn } from "@/lib/utils";

export function YouTubeEmbed({
	videoId,
	title,
}: {
	videoId: string;
	title: string;
}) {
	return (
		<div className="relative my-5">
			<iframe
				className="aspect-video w-full rounded-xl border"
				src={`https://www.youtube.com/embed/${videoId}`}
				title={title}
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
				referrerPolicy="strict-origin-when-cross-origin"
				allowFullScreen
			/>
		</div>
	);
}

export function IframeEmbed({
	className,
	...props
}: React.ComponentProps<"iframe">) {
	return (
		<iframe
			className={cn("my-5 aspect-video w-full rounded-xl border", className)}
			{...props}
		/>
	);
}

export function FramedImage({
	className,
	alt,
	...props
}: Omit<React.ComponentProps<"img">, "alt"> & { alt: string }) {
	return (
		// biome-ignore lint/performance/noImgElement: MDX images may use arbitrary remote sources without fixed dimensions.
		<img
			alt={alt}
			className={cn("my-5 rounded-xl border", className)}
			{...props}
		/>
	);
}
