/**
 * Shared sizing for the docs page toolbar and header icon buttons.
 *
 * Every button renders at the shadcn `icon-sm` size (32px, 16px icon) on all
 * screens so the row reads as one set. On touch screens an invisible
 * pseudo-element grows the hit area to 44px tall without changing the
 * visible size.
 */
export const TOOLBAR_PRESS =
	"touch-manipulation border-none transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";

/** 44px tall hit area, 40px wide, so neighbours 8px apart never overlap. */
export const TOOLBAR_HIT_AREA =
	"relative after:absolute after:-inset-x-1 after:-inset-y-1.5 pointer-fine:after:hidden";

/** Hit area for buttons inside a ButtonGroup: grows vertically only. */
export const TOOLBAR_GROUP_HIT_AREA =
	"relative after:absolute after:inset-x-0 after:-inset-y-1.5 pointer-fine:after:hidden";
