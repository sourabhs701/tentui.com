import {
	COMPONENT_CAPTURE_FRAME,
	COMPONENT_CAPTURE_THEMES,
	componentCaptureNames,
} from "@/lib/component-capture";

export const dynamic = "force-static";
export const revalidate = false;

export function GET() {
	return Response.json({
		components: componentCaptureNames,
		frame: COMPONENT_CAPTURE_FRAME,
		themes: COMPONENT_CAPTURE_THEMES,
	});
}
