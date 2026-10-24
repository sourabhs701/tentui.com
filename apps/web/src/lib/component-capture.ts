import { components } from "@/registry/components/_registry";

export const COMPONENT_CAPTURE_FRAME = {
	height: 360,
	width: 480,
} as const;

export const COMPONENT_CAPTURE_THEMES = ["light", "dark"] as const;

export type ComponentCaptureTheme = (typeof COMPONENT_CAPTURE_THEMES)[number];

/**
 * Per-component framing for the fixed 4:3 capture frame. `zoom` scales small
 * components up so they read at card size; `className` replaces the demo's
 * `previewClassName` on the stage.
 */
export const COMPONENT_CAPTURE_FRAMING: Record<
	string,
	{ zoom?: number; className?: string }
> = {
	"animated-arrow": { zoom: 1.6 },
	"animated-tabs": { zoom: 1.6 },
	"copy-button": { zoom: 1.8 },
	"email-dock": { zoom: 1.2 },
	"hold-to-confirm": { zoom: 1.6 },
	"peeping-button": { zoom: 1.35 },
	"snap-sheet": { zoom: 0.62 },
	"stateful-button": { zoom: 1.15 },
	"swipe-actions": { zoom: 0.92 },
	"theme-toggle": { zoom: 2.4 },
	"tick-ruler": { zoom: 1.15 },
};

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
