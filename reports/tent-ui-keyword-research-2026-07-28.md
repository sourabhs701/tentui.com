# Tent UI SEO Keyword Research

Research date: 2026-07-28

## Recommendation

| Field | Recommendation |
| --- | --- |
| Primary keyword | `shadcn landing page` |
| Search intent | Build or find the sections needed for a shadcn-compatible marketing landing page |
| Article title | **Shadcn Landing Page: Build One with Copy-Paste Blocks** |
| Suggested slug | `/blog/shadcn-landing-page` |
| Article angle | Assemble one coherent landing page from Tent UI's actual hero, testimonials, pricing, FAQ, CTA, and footer blocks; show the finished result, exact registry commands, dependencies, framework-specific adaptations, and the content/assets that must be replaced before launch. |
| Primary conversion | Browse or install the corresponding Tent UI blocks from `/blocks` and its category pages |
| Confidence | High product fit; medium demand confidence; medium targetability confidence; unknown volume and ranking difficulty |

**Recommendation:** Target `shadcn landing page`, not the broader `shadcn blocks`. The phrase describes Tent UI's current landing-page positioning and block inventory more precisely, and Google Autocomplete exposes a tightly related set of landing-page and section-level queries.[^google-landing][^tent-home][^tent-registry]

The article should be an implementation walkthrough, not a roundup of component libraries. Its original value is a tested composition made from the product's real blocks, with transparent installation and adaptation notes. It should not call the result a complete “template” unless Tent UI publishes the composed page source as one installable item.

## Evidence Standard

- **Observed:** Directly present in the repository, a fetched first-party page/API, or Google Autocomplete on the research date.
- **Inferred:** A conclusion drawn from the observed evidence.
- **Unknown:** Not established by the available sources.

Autocomplete is evidence of query wording and related intent. It is not evidence of monthly search volume, keyword difficulty, click-through rate, or attainable ranking. No search-volume figures are invented in this report.

## Product Reality

### Positioning and inventory

**Observed:** The repository describes Tent UI as hand-crafted React components and landing-page blocks built for shadcn. The current documentation is more specific: Tent UI is a shadcn-based source registry for purposeful components that complement, rather than replace, a core primitive library.[^repo-readme][^repo-introduction]

**Observed:** The source registry and live registry catalog currently expose 12 `registry:component` items and 13 `registry:block` items. The blocks cover two heroes, two pricing sections, three FAQs, three footers, one testimonials section, one CTA, and one legal-page route group.[^repo-components][^repo-blocks][^tent-registry]

**Observed:** The live homepage leads with “Landing pages that feel hand crafted” and points visitors to components and blocks. This makes landing-page construction part of the current public positioning, not a keyword imposed on an unrelated product.[^tent-home]

**Inference:** Tent UI has unusually direct product proof for the proposed topic. It can show real, installable solutions for nearly every major marketing-page section instead of summarizing generic landing-page advice.

### Installation model

**Observed:** Tent UI is not a runtime package. Users configure the `@tentui` namespace as `https://tentui.com/r/{name}.json` in `components.json`, then use the shadcn CLI to copy source, registry dependencies, and npm dependencies into their own project. A direct registry-item URL and manual copy are also supported.[^repo-installation][^repo-components-json][^shadcn-namespace][^shadcn-item]

**Observed:** This follows the official shadcn registry model. Official documentation defines `registry:block` for complex components with multiple files, allows package and registry dependencies, and says the CLI writes files to destinations resolved from `components.json` or explicit targets.[^shadcn-registry][^shadcn-item]

**Observed:** Exact current installable names include `@tentui/hero-01`, `@tentui/hero-02`, `@tentui/testimonials-01`, `@tentui/pricing-01`, `@tentui/pricing-02`, `@tentui/faq-01` through `faq-03`, `@tentui/cta-01`, and `@tentui/footer-01` through `footer-03`.[^tent-registry]

### Compatibility and claim constraints

**Observed:** Several landing-page blocks currently import Next.js APIs. Hero 01, Hero 02, CTA 01, Footer 01, and Footer 02 use one or more of `next/image`, `next/link`, or `next/navigation`; other blocks are less framework-specific. Next.js documents that `next/image` adds image sizing, layout-stability, lazy-loading, and remote-image configuration behavior, so replacing it in another React framework is a real adaptation rather than a cosmetic import change.[^repo-next-imports][^next-images]

**Observed:** Tent UI blocks use Tailwind responsive variants, and several use Motion. Tailwind documents a mobile-first breakpoint model; Motion documents `MotionConfig reducedMotion="user"` and `useReducedMotion` for respecting device preferences.[^tailwind-responsive][^motion-accessibility]

**Inference:** The article should include a block-by-block compatibility table instead of claiming every Tent UI block is framework-agnostic. “Shadcn-compatible React blocks, with the shown composition tested in Next.js” is more defensible than “works unchanged in every React framework.”

**Observed:** The README and introduction call Tent UI open source, but there is no root `LICENSE` file, and the live custom license discusses items available for “purchase or download,” team-size licenses, and restrictions on redistribution and template creation.[^repo-readme][^repo-introduction][^repo-license][^tent-license]

**Inference:** Do not put “free” or “open source” in the proposed article title until the applicable license and price for these blocks are made unambiguous. Google does suggest free-oriented variants, but matching that wording without a clear offer would create expectation and trust risk.[^google-landing][^google-free-blocks]

### Freshness issues to resolve before publication

**Observed:** The current source and live registry catalog contain 13 blocks, but the rendered `/blocks` navigation says “All New 12.” The homepage claims “100+ production-ready components, blocks, and templates,” while the public registry catalog currently contains 25 components and blocks combined and no `registry:page` item presented as a complete landing-page template.[^tent-blocks][^tent-home][^tent-registry]

**Observed:** The installation guide uses `@tentui/saas-hero-01` as its block example, but no item with that name exists in the current source or live registry catalog; the current names are `hero-01` and `hero-02`.[^repo-installation][^tent-registry]

**Inference:** Correct these visible inventory and command mismatches before publishing the article. Otherwise a high-intent visitor may question whether the catalog or installation instructions are current.

## Existing Blog Coverage

The requested repository check was completed against every file in `apps/web/src/content/blog`.

| Existing post | Main intent | Overlap with proposed topic |
| --- | --- | --- |
| `Shadcn Loading Button with Success and Error States` | Build a complete async button lifecycle | None; one component-level implementation[^blog-loading] |
| `Motion that earns its place` | Decide when interface animation is useful | Adjacent design principle only[^blog-motion] |
| `Git Branching for UI Component Libraries` | Organize Git workflow for a component library | None[^blog-git] |
| `Introducing TentUI` | Product announcement and positioning | Mentions the registry and components but does not teach landing-page assembly[^blog-introduction] |
| `Why copy-paste components scale` | Explain source ownership as a distribution boundary | Adjacent installation philosophy only[^blog-copy-paste] |
| `Fixing Next.js ISR Cache on Cloudflare` | Diagnose a deployment cache issue | None[^blog-cloudflare] |

**Observed:** No existing repository blog post targets a shadcn landing page, landing-page blocks, or the assembly of hero, proof, pricing, FAQ, CTA, and footer sections.

**Observed:** The fetched live blog index did not yet show the repository's loading-button post, so the repository is the more complete source for the non-overlap check requested here.[^tent-blog][^blog-loading]

**Conclusion:** The recommended topic does not overlap an existing post. It is also distinct from the `/blocks` catalog if intent is kept separate: the article teaches composition and adaptation; `/blocks` remains the browse/install destination.

## Query Evidence

### Primary cluster

**Observed:** Google's suggestion endpoint returned the following exact phrases for the seed `shadcn landing page` on 2026-07-28: `shadcn landing page`, `shadcn landing page templates`, `shadcn landing page components`, `shadcn landing page blocks`, `shadcn landing page github`, `shadcn landing page free`, `shadcn landing page templates free`, `shadcn landing page example`, `shadcn landing page template github`, and `shadcn landing page design`.[^google-landing]

**Inference:** The wording spans four closely related jobs: find a complete starting point, find composable sections, inspect source, and evaluate price/licensing. The primary phrase is broad enough to contain the whole job but narrow enough to stay aligned with Tent UI's public landing-page positioning.

### Recommended supporting keywords

| Keyword | Evidence | Inferred intent | Product fit and use |
| --- | --- | --- | --- |
| `shadcn landing page components` | Returned for `shadcn landing page`[^google-landing] | Find section components for a marketing page | Secondary phrase for the article introduction and block-selection explanation |
| `shadcn landing page blocks` | Returned for `shadcn landing page` and for its own exact seed[^google-landing][^google-landing-blocks] | Find larger copy-paste page sections | Closest supporting phrase to Tent UI's `registry:block` catalog |
| `shadcn hero section` | Exact seed returned with `shadcn hero section blocks`, `free`, and `component` variants[^google-hero] | Find or install a hero section | Link the article's hero step to `/blocks/hero`; Tent UI has two heroes |
| `shadcn pricing component` | Exact seed returned; `shadcn pricing` also returned component, page, block, cards, table, section, plan, and template variants[^google-pricing][^google-pricing-component] | Find an interactive pricing treatment | Link to `/blocks/pricing`; Tent UI has two pricing blocks |
| `shadcn testimonials component` | Exact seed returned; the broader seed also returned section and animated-testimonials variants[^google-testimonials][^google-testimonials-component] | Add social proof to a shadcn page | Link to `/blocks/testimonials`; Tent UI has a testimonial mosaic |
| `shadcn faq component` | Exact seed returned; the broader seed also returned section, block, page, and accordion variants[^google-faq][^google-faq-component] | Add an FAQ section using shadcn primitives | Link to `/blocks/faq`; Tent UI has three FAQ blocks |
| `shadcn cta section` | Returned for `shadcn cta`, alongside block and component variants[^google-cta] | Add a conversion section | Link to `/blocks/cta`; Tent UI has CTA 01 |
| `shadcn footer component` | Exact seed returned; the broader seed also returned block, free, example, template, section, and design variants[^google-footer][^google-footer-component] | Find a ready-made footer | Link to `/blocks/footer`; Tent UI has three footer blocks |

These are supporting terms, not a recommendation to produce eight near-duplicate posts. The article should use them only where each block is actually demonstrated, then route section-specific browsing intent to the existing category pages.

### Observed but not recommended as targets now

| Query | Why not select it |
| --- | --- |
| `shadcn blocks` | Google returns a strong broad cluster, but the official shadcn site owns a prominent Blocks product and directly targets copy-paste blocks. Tent UI has a clearer differentiator in the narrower landing-page job.[^google-blocks][^shadcn-blocks] |
| `shadcn landing page templates` | Strong adjacent wording, but Tent UI currently publishes individual blocks rather than one complete installable landing-page template. Use only if the article ships a complete composed source example.[^google-landing][^tent-registry] |
| `shadcn landing page free` | Observed demand language, but the current custom-license and open-source wording need clarification before Tent UI can satisfy the promise cleanly.[^google-landing][^tent-license] |
| `free shadcn blocks` | Google suggests this phrase and related hero-block variants, but the same licensing caveat applies.[^google-free-blocks][^tent-license] |

## Why This Is Realistically Targetable

### Evidence

1. Google returns the exact primary phrase and a coherent set of block-level variations; this is stronger wording evidence than inventing a topic from the catalog alone.[^google-landing]
2. Tent UI's public homepage already positions the product around hand-crafted landing pages, and the live registry contains the exact section inventory implied by the query.[^tent-home][^tent-registry]
3. The fetched official shadcn Blocks page foregrounds Featured, Sidebar, Login, and Signup categories. It demonstrates strong competition for the generic `shadcn blocks` term but does not foreground a marketing-landing-page category on that page.[^shadcn-blocks]
4. The shadcn registry specification formally supports complex blocks, dependencies, target paths, and namespaced installation, so the article can use standard ecosystem language and commands rather than teaching a proprietary installation model.[^shadcn-item][^shadcn-namespace]

### Inference

`shadcn landing page` is a plausible medium-confidence target because it combines demonstrated wording, exact product fit, and a more specific job than the official site's generic blocks category. Tent UI can add first-hand value by composing and testing its own blocks, documenting what the CLI changes, and showing the framework adaptations required.

This does **not** mean the keyword is easy. Google result pages could not be reliably retrieved in this research session, no Search Console data was available, and no paid keyword dataset was used. Current ranking competition, domain authority requirements, traffic potential, and time to rank remain unknown.

## Article Brief

### Search promise

Show a developer how to turn an initialized shadcn project into a coherent marketing landing page using source-owned blocks, without pretending the blocks are a drop-in branded product.

### Required original evidence

1. A working final page composed from one hero, testimonials, pricing, FAQ, CTA, and footer block.
2. Exact `@tentui/...` commands copied from the current registry, not the stale `saas-hero-01` example.
3. A file/dependency summary after each install, including transitive Tent UI and built-in shadcn dependencies.
4. A compatibility table identifying Next.js-specific imports and the substitutions required for another React framework.
5. Before/after examples for replacing demo logos, screenshots, links, prices, testimonials, and placeholder copy.
6. Mobile, keyboard, reduced-motion, and image-loading observations recorded from the composed result.
7. A clear license statement linked to the applicable Tent UI terms.

### Suggested outline

1. Show the finished shadcn landing page.
2. Explain blocks versus primitives versus a complete template.
3. Initialize shadcn and add the `@tentui` registry.
4. Install and adapt the hero.
5. Add social proof and pricing.
6. Add FAQ and CTA sections.
7. Finish with a footer.
8. Reconcile typography, spacing, colors, and motion across blocks.
9. Audit Next.js-specific code, responsive behavior, accessibility, assets, and licensing.
10. Link to the live block catalog and individual category pages.

### Cannibalization boundary

- `/blog/shadcn-landing-page`: instructional intent, complete assembly, tradeoffs, and adaptation.
- `/blocks`: browse all available blocks and copy install commands.
- `/blocks/hero`, `/blocks/pricing`, `/blocks/testimonials`, `/blocks/faq`, `/blocks/cta`, `/blocks/footer`: section-specific evaluation and installation intent.

Do not create separate thin articles for every supporting phrase while this cluster is unproven. Use Search Console query and page data after publication to decide whether any section deserves a materially deeper guide.

## Limitations

- Google Autocomplete changes by date, locale, device, and request context.
- Autocomplete does not publish search volume or ranking difficulty.
- Direct Google result pages returned an interstitial rather than usable result listings, so no current ranking or SERP-composition claim is made.
- No Google Search Console, analytics, backlink, or paid keyword dataset was available.
- The live site and repository have freshness mismatches, so registry item URLs and source registries were used to verify current inventory.
- “Free” and “open source” positioning should not be used as keyword promises until the license applicable to each item is clarified.

## Sources

All web sources were accessed on 2026-07-28.

[^repo-readme]: Tent UI repository, [`README.md`](../README.md). Product positioning and installation model.
[^repo-introduction]: Tent UI repository, [`apps/web/src/content/docs/introduction.mdx`](../apps/web/src/content/docs/introduction.mdx). Registry positioning, source ownership, and relationship to core libraries.
[^repo-installation]: Tent UI repository, [`apps/web/src/content/docs/installation.mdx`](../apps/web/src/content/docs/installation.mdx). Namespace, CLI, direct URL, manual installation, and current stale block example.
[^repo-components-json]: Tent UI repository, [`apps/web/components.json`](../apps/web/components.json). Live `@tentui` namespace configuration.
[^repo-components]: Tent UI repository, [`apps/web/src/registry/components/_registry.ts`](../apps/web/src/registry/components/_registry.ts). Twelve component declarations.
[^repo-blocks]: Tent UI repository, [`apps/web/src/registry/blocks/_registry.ts`](../apps/web/src/registry/blocks/_registry.ts). Thirteen block declarations, categories, dependencies, files, and current item names.
[^repo-next-imports]: Tent UI repository, [`apps/web/src/registry/blocks`](../apps/web/src/registry/blocks). Next.js imports in Hero 01, Hero 02, CTA 01, Footer 01, and Footer 02.
[^repo-license]: Tent UI repository, [`apps/web/src/app/(site)/(company)/license/page.tsx`](../apps/web/src/app/%28site%29/%28company%29/license/page.tsx). Custom item-license language and restrictions.
[^blog-loading]: Tent UI repository, [`apps/web/src/content/blog/shadcn-loading-button.mdx`](../apps/web/src/content/blog/shadcn-loading-button.mdx).
[^blog-motion]: Tent UI repository, [`apps/web/src/content/blog/motion-that-earns-its-place.mdx`](../apps/web/src/content/blog/motion-that-earns-its-place.mdx).
[^blog-git]: Tent UI repository, [`apps/web/src/content/blog/git-branching-for-ui-component-libraries.mdx`](../apps/web/src/content/blog/git-branching-for-ui-component-libraries.mdx).
[^blog-introduction]: Tent UI repository, [`apps/web/src/content/blog/introducing-tentui.mdx`](../apps/web/src/content/blog/introducing-tentui.mdx).
[^blog-copy-paste]: Tent UI repository, [`apps/web/src/content/blog/why-copy-paste-components.mdx`](../apps/web/src/content/blog/why-copy-paste-components.mdx).
[^blog-cloudflare]: Tent UI repository, [`apps/web/src/content/blog/fixing-tentui-isr-cache-on-cloudflare.mdx`](../apps/web/src/content/blog/fixing-tentui-isr-cache-on-cloudflare.mdx).
[^tent-home]: Tent UI, [homepage](https://tentui.com/). Current public landing-page positioning.
[^tent-blocks]: Tent UI, [Blocks](https://tentui.com/blocks). Rendered block catalog and displayed count.
[^tent-registry]: Tent UI, [live registry catalog](https://tentui.com/r/registry.json). Current public item names, types, files, categories, and dependencies.
[^tent-blog]: Tent UI, [Blog](https://tentui.com/blog). Live post index on the access date.
[^tent-license]: Tent UI, [Licensing](https://tentui.com/license). Current public license wording.
[^google-landing]: Google Suggest API, [`shadcn landing page`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20landing%20page).
[^google-landing-blocks]: Google Suggest API, [`shadcn landing page blocks`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20landing%20page%20blocks).
[^google-hero]: Google Suggest API, [`shadcn hero section`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20hero%20section).
[^google-pricing]: Google Suggest API, [`shadcn pricing`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20pricing).
[^google-pricing-component]: Google Suggest API, [`shadcn pricing component`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20pricing%20component).
[^google-testimonials]: Google Suggest API, [`shadcn testimonials`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20testimonials).
[^google-testimonials-component]: Google Suggest API, [`shadcn testimonials component`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20testimonials%20component).
[^google-faq]: Google Suggest API, [`shadcn faq`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20faq).
[^google-faq-component]: Google Suggest API, [`shadcn faq component`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20faq%20component).
[^google-cta]: Google Suggest API, [`shadcn cta`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20cta).
[^google-footer]: Google Suggest API, [`shadcn footer`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20footer).
[^google-footer-component]: Google Suggest API, [`shadcn footer component`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20footer%20component).
[^google-blocks]: Google Suggest API, [`shadcn blocks`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=shadcn%20blocks).
[^google-free-blocks]: Google Suggest API, [`free shadcn blocks`](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=free%20shadcn%20blocks).
[^shadcn-blocks]: shadcn/ui, [Building Blocks for the Web](https://ui.shadcn.com/blocks). Official blocks positioning and visible categories.
[^shadcn-registry]: shadcn/ui, [Registry introduction](https://ui.shadcn.com/docs/registry). Official code-registry model.
[^shadcn-item]: shadcn/ui, [`registry-item.json` specification](https://ui.shadcn.com/docs/registry/registry-item-json). Block type, dependencies, files, and target behavior.
[^shadcn-namespace]: shadcn/ui, [Registry namespaces](https://ui.shadcn.com/docs/registry/namespace). Namespace configuration, installation syntax, trust model, and dependency resolution.
[^next-images]: Next.js, [Image Optimization](https://nextjs.org/docs/app/getting-started/images). `next/image` behavior and remote image requirements.
[^tailwind-responsive]: Tailwind CSS, [Responsive design](https://tailwindcss.com/docs/responsive-design). Mobile-first responsive variants and breakpoints.
[^motion-accessibility]: Motion, [Create accessible animations in React](https://motion.dev/docs/react-accessibility). Reduced-motion APIs and behavior.
