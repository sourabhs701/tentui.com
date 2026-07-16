# Port Chanhdai’s registry, block viewer, and preview system to TentUI

## Summary

Rebuild the staged TentUI draft around Chanhdai’s current implementation at commit `9e87a64`, matching its viewer UI and behavior while retaining only TentUI’s `gradient-hero-01` block.

The public registry will use `@tentui/gradient-hero-01` and `https://tentui.com/r/gradient-hero-01.json`. Chanhdai content, Componentry’s legacy catalog, analytics, haptics, Dialkit, and preview-media scripts remain out of scope.

## Implementation changes

### Registry and build pipeline

- Replace the custom JavaScript/VM registry generator with a typed shadcn source registry validated through `shadcn/schema`.
- Make the block definition and source file the only authored content. Rebrand remaining Componentry text and give both block actions valid destinations.
- Generate deterministic equivalents of Chanhdai’s:
  - Root `registry.json`.
  - Runtime lazy-import index.
  - Sorted block-list JSON.
  - Built `public/r/registry.json` and `public/r/gradient-hero-01.json`.
- Port registry item loading, LRU caching, install-path normalization, import rewriting, file-tree creation, icon transformation, code formatting, and dual-theme Shiki highlighting.
- Delete the staged `registry/generated` design, duplicate block registry JSON, stale 38-item metadata catalog, custom validator, media upload/recompression scripts, screenshot tooling, and other Componentry-derived artifacts.
- Place `registry:build` and `registry:validate` in the web package. Add a web-specific Turbo configuration so `next build` depends on the cached registry build; root scripts may only delegate through `turbo run`.

### Viewer and preview behavior

- Port the Chanhdai viewer context and composition:
  - Preview/code tabs.
  - Searchable shadcn/tweakcn theme picker with palette previews.
  - 30%, 60%, and 100% resizable preview widths.
  - Refresh and open-in-new-tab controls.
  - Install-command copy and Open in v0 actions.
  - Collapsible file tree, language icons, highlighted source, and per-file copy.
  - Simplified mobile iframe presentation.
- Preserve iframe state by serializing the initial theme into the URL and sending subsequent changes through `postMessage` instead of reloading.
- Port preview CSS-variable and Google Font injection. Bundle shadcn themes locally and cache tweakcn’s registry for 24 hours, returning only local themes when the external request fails.
- Keep the visual system isolated: add viewer-specific primitives and additive CSS tokens/utilities without replacing TentUI’s existing base-lyra components. Link-shaped controls must use semantic anchors styled with variants, following current shadcn Button guidance.
- Use TentUI’s Lucide icon library for standard icons and copy only Chanhdai’s bespoke SVG icons needed for visual fidelity.

### Routing and site integration

- Introduce route groups so normal pages retain the TentUI header while `/preview/[name]` renders without the application shell; remove the header’s pathname-based preview exception.
- Implement statically generated `/blocks`, `/blocks/[category]`, `/blocks/[category]/[name]`, and `/preview/[name]` routes with unknown parameters returning 404.
- Match Chanhdai’s block listing, category navigation, detail navigation, sharing, previous/next keyboard controls, responsive layout, and “more blocks” footer treatment.
- Add TentUI-branded canonical metadata, OG image generation, breadcrumbs, CollectionPage JSON-LD, and SoftwareSourceCode JSON-LD. Use `https://github.com/sourabhs701/tentui.com` as the source repository and omit undeclared license and social-handle fields.
- Mark preview pages `noindex, nofollow`; block listing and detail pages remain indexable.

## Public contracts

- Registry namespace: `@tentui`.
- Registry URL pattern: `https://tentui.com/r/{name}.json`.
- Install command: `npx shadcn@latest add @tentui/gradient-hero-01`.
- Authored items use shadcn `Registry`/`RegistryItem` types, including categories and `meta.createdAt`, `meta.iframeHeight`, and `meta.previewClassName`.
- Preview search parameters expose nullable `theme`; later parameters can be added through the same serializer and iframe message contract.
- Generated files are build outputs and must never be hand-edited.

## Test plan

- Unit-test block sorting, category filtering, static parameters, namespace/URL helpers, import rewriting, target normalization, file-tree construction, theme validation, CSS-variable generation, and font-family extraction.
- Run registry generation twice and confirm the second run produces no diff.
- Validate the source and built registries with the shadcn CLI, then dry-run installing the local block JSON into a temporary shadcn project.
- Run web type checking, Biome without fixes, unit tests, the Turbo build, and the OpenNext-compatible production build.
- Browser-test every block/preview route at desktop and mobile widths. Verify resizing, tabs, file selection, copying, refresh, new-tab/v0 links, share and keyboard navigation, theme switching without iframe reload, preview shell isolation, unknown-route 404s, and tweakcn-offline fallback.

## Assumptions

- Chanhdai commit `9e87a64` is the parity reference.
- Only `gradient-hero-01` is retained; neither Chanhdai’s catalog nor Componentry’s missing component catalog is migrated.
- User-visible parity excludes analytics events, haptic/audio feedback, Dialkit, and automated preview-media management.
- Existing authentication, dashboard, API, Cloudflare/OpenNext configuration, and shared TentUI component APIs remain unchanged.

## Implementation handoff notes

- Treat all current uncommitted and staged changes as user-owned. Inspect them before editing, preserve unrelated changes, and replace only the Componentry-derived registry/viewer draft covered by this plan.
- Read and follow the repository’s applicable shadcn, Next.js, Turborepo, and React guidance before implementation.
- Use `../chanhdai.com` for architecture and UI behavior, not for catalog content or branding.
- Use subagents for independent read-only analysis and verification. Coordinate file ownership before allowing parallel edits because all agents share one working tree.
