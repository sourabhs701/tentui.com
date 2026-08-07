import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";

import { ComponentCaptureStage } from "@/components/capture/component-capture-stage";
import {
	COMPONENT_CAPTURE_FRAME,
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
	const Component = example?.component;
	if (!Component) notFound();

	const previewClassName =
		typeof example.meta?.previewClassName === "string"
			? example.meta.previewClassName
			: undefined;

	return (
		<ComponentCaptureStage
			className={previewClassName}
			minHeight={COMPONENT_CAPTURE_FRAME.minHeight}
			name={name}
			theme={theme}
			width={COMPONENT_CAPTURE_FRAME.width}
		>
			<Component />
		</ComponentCaptureStage>
	);
}
