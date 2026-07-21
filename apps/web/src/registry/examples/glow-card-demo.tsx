import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

import { GlowCard } from "@/registry/components/glow-card";

export default function GlowCardDemo() {
	return (
		<div className="w-full max-w-sm px-4">
			<GlowCard>
				<Card className="min-h-64 rounded-[inherit] shadow-none ring-0">
					<CardHeader>
						<CardTitle>Follow the light</CardTitle>
						<CardDescription>
							Move your pointer around the edge of this card.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-1 items-center">
						<div className="h-px w-full bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
					</CardContent>
					<CardFooter className="text-muted-foreground text-xs">
						Motion follows intent without competing with content.
					</CardFooter>
				</Card>
			</GlowCard>
		</div>
	);
}
