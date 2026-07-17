import { LogosCarousel } from "@/registry/components/logos-carousel";

const LOGOS = [
	"Vercel",
	"Linear",
	"Raycast",
	"Figma",
	"Framer",
	"Resend",
	"Supabase",
	"Stripe",
];

export default function LogosCarouselDemo() {
	return (
		<LogosCarousel className="w-full py-4 text-foreground">
			{LOGOS.map((logo) => (
				<span key={logo} className="font-semibold text-sm tracking-tight">
					{logo}
				</span>
			))}
		</LogosCarousel>
	);
}
