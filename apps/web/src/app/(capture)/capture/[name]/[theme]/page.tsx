import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";

import {
	ComponentSidebarScene,
	NumberStepperScene,
	ScribbledTextScene,
	SnapSheetScene,
	SwipeActionsScene,
	TailwindcssButtonsScene,
	TickRulerScene,
} from "@/components/capture/capture-scenes";
import { ComponentCaptureStage } from "@/components/capture/component-capture-stage";
import {
	COMPONENT_CAPTURE_FRAME,
	COMPONENT_CAPTURE_FRAMING,
	COMPONENT_CAPTURE_THEMES,
	componentCaptureNames,
	isComponentCaptureName,
	isComponentCaptureTheme,
} from "@/lib/component-capture";
import { Index } from "@/registry/__index__";

type CaptureIndexItem = {
	component?: ComponentType;
	meta?: { previewClassName?: unknown };
};

const captureIndex = Index as Record<string, CaptureIndexItem>;

// Capture-only framings for demos that don't fit the 4:3 frame or are too
// busy for a card.
const captureScenes: Record<string, ComponentType> = {
	"component-sidebar": ComponentSidebarScene,
	"number-stepper": NumberStepperScene,
	"scribbled-text": ScribbledTextScene,
	"snap-sheet": SnapSheetScene,
	"swipe-actions": SwipeActionsScene,
	"tailwindcss-buttons": TailwindcssButtonsScene,
	"tick-ruler": TickRulerScene,
};

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export const metadata: Metadata = {
	robots: { follow: false, index: false },
};

export function generateStaticParams() {
	return componentCaptureNames.flatMap((name) =>
		COMPONENT_CAPTURE_THEMES.map((theme) => ({ name, theme })),
	);
}

export default async function ComponentCapturePage({
	params,
}: {
	params: Promise<{ name: string; theme: string }>;
}) {
	const { name, theme } = await params;
	if (!isComponentCaptureName(name) || !isComponentCaptureTheme(theme)) {
		notFound();
	}

	const example = captureIndex[`${name}-demo`];
	const Component = captureScenes[name] ?? example?.component;
	if (!Component) notFound();

	const framing = COMPONENT_CAPTURE_FRAMING[name];
	const previewClassName =
		framing?.className ??
		(typeof example?.meta?.previewClassName === "string"
			? example.meta.previewClassName
			: undefined);

	return (
		<ComponentCaptureStage
			className={previewClassName}
			height={COMPONENT_CAPTURE_FRAME.height}
			name={name}
			theme={theme}
			width={COMPONENT_CAPTURE_FRAME.width}
			zoom={framing?.zoom}
		>
			<Component />
		</ComponentCaptureStage>
	);
}
