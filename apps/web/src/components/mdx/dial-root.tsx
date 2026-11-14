"use client";

// dialkit's stylesheet starts with a render-blocking Google Fonts @import, so
// it loads with this lazy chunk when the configure panel first opens, not with
// every page that has a component preview.
import "dialkit/styles.css";

export { DialRoot as default } from "dialkit";
