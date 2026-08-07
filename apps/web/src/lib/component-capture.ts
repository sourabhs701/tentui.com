import { components } from "@/registry/components/_registry";

export const COMPONENT_CAPTURE_FRAME = {
	minHeight: 360,
	width: 480,
} as const;

export const COMPONENT_CAPTURE_THEMES = ["light", "dark"] as const;

export type ComponentCaptureTheme = (typeof COMPONENT_CAPTURE_THEMES)[number];

export const componentCaptureNames = components.map((component) =>
	String(component.name),
);

export function isComponentCaptureName(name: string) {
	return componentCaptureNames.includes(name);
}

export function isComponentCaptureTheme(
	theme: string,
): theme is ComponentCaptureTheme {
	return COMPONENT_CAPTURE_THEMES.some((candidate) => candidate === theme);
}
