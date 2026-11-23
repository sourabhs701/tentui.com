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
	// The scene stacks four variants; the card folds up when the run ends.
	"agent-thinking": { zoom: 1.1 },
	"animated-arrow": { zoom: 1.6 },
	// The capture scene sizes the headline itself, so the art stays at 1:1.
	"ascii-decode-text": { className: "px-6" },
	"animated-tabs": { zoom: 1.6 },
	"copy-button": { zoom: 1.8 },
	"dynamic-island": { zoom: 1.4 },
	"elastic-slider": { zoom: 1.5 },
	"email-dock": { zoom: 1.2 },
	"glass-toggle": { zoom: 3 },
	// The bubble is portaled outside the stage, so it takes the trigger's zoom.
	"fluid-tooltip": { zoom: 1.7, className: "pt-[58px]" },
	"brand-context-menu": { zoom: 2 },
	"bubble-wrap": { zoom: 1.2 },
	// The docs preview's min-h-96 is taller than the frame; center the chart instead.
	"chart-brush": {
		zoom: 1.05,
		className: "place-items-center content-center px-6",
	},
	"hold-to-confirm": { zoom: 1.6 },
	"ink-filter-bar": { zoom: 1.3 },
	// The preview is a tall column; scaled down so all three capsules fit.
	"liquid-glass-carousel": {
		zoom: 0.82,
		className: "place-items-center content-center",
	},
	// The dialog is portaled out of the zoomed stage, so it is framed at 1:1.
	"morph-dialog": {},
	// The viewer is portaled out of the zoomed stage, so it is framed at 1:1.
	"morph-lightbox": {},
	// The menu is portaled out of the zoomed stage, so it is framed at 1:1.
	"liquid-glass-menu": {},
	"number-stepper": { zoom: 1.6 },
	"otp-field": { zoom: 1.2 },
	"pagination-rail": { zoom: 1.15 },
	"peeping-button": { zoom: 1.35 },
	// Starts near the top so the suggestion list opens below the field.
	"prompt-chip-input": { className: "items-start px-6 pt-10" },
	"pull-cord": { zoom: 1.1 },
	"ripple-reveal": { zoom: 1.2 },
	"rotary-knob": { zoom: 1.5 },
	"scratch-card": { zoom: 1.3 },
	// A tall panel; scaled down so the whole card, tray edge to edge, fits.
	"scroll-accordion": {
		zoom: 0.8,
		className: "place-items-center content-center px-8",
	},
	"search-command": { zoom: 2 },
	"snap-sheet": {},
	"star-rating": { zoom: 1.5 },
	"stateful-button": { zoom: 1.5 },
	"swipe-actions": { zoom: 1.1 },
	"text-scramble": { className: "px-6" },
	"theme-toggle": { zoom: 2.4 },
	"tick-ruler": { zoom: 1.15 },
	"time-ring": { zoom: 1.1 },
	"variable-font-hover": { className: "px-6" },
	"wheel-picker": { zoom: 1.3 },
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
