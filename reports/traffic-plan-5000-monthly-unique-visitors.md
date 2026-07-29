# Tent UI Traffic Plan: 5,000 Monthly Unique Visitors

Date: 2026-07-26

Research basis: [SEO Content Opportunity: Shadcn Loading Button](./seo-content-opportunity-2026-07-26.md)

## Goal

Reach 5,000 deduplicated human visitors in a calendar month while growing
meaningful usage of Tent UI components.

This is a target, not a forecast. The repository does not provide access to the
current analytics or Search Console baseline, so the first operating task is to
record it. The 12-18 month horizon below assumes the site is starting with
limited non-brand search visibility. A stronger baseline can shorten it.

## Define the number once

Use one analytics system as the source of truth for the 5,000 goal. OpenPanel is
the recommended default because screen-view tracking is already integrated.
Do not add OpenPanel and the separate `co.srb.codes` analytics counts together.

The monthly scorecard should include:

| Metric | Source | Definition |
| --- | --- | --- |
| Monthly unique visitors | OpenPanel | Deduplicated human visitors, excluding internal traffic and known bots |
| Organic clicks and impressions | Google Search Console | Google web-search performance for `tentui.com` |
| Indexed pages | Google Search Console | Canonical Tent UI pages indexed by Google |
| Article-to-component visits | OpenPanel | Sessions that move from a guide to a relevant component page |
| Install-copy and GitHub actions | OpenPanel custom events | High-intent actions after a content or component landing |
| Referring domains | Search Console and a backlink tool | Legitimate sites sending links or discovery traffic |

Record the previous 28 and 90 days before launch. Segment branded and non-brand
search queries so growth in people already looking for Tent UI is not confused
with new discovery.

## Target acquisition mix

Do not require one article, keyword, or channel to carry the goal. Use this as a
planning allocation:

| Channel | Monthly visitor target | Share | Primary mechanism |
| --- | ---: | ---: | --- |
| Organic search | 3,500 | 70% | First-hand implementation guides, component pages, and topic hubs |
| Relevant communities and referrals | 750 | 15% | Technical excerpts, canonical cross-posts, and useful project discussions |
| Direct and returning visitors | 500 | 10% | GitHub releases, blog RSS, repeat component use, and consistent publishing |
| Directories and launch surfaces | 250 | 5% | shadcn directory, curated lists, and substantive releases |
| Total planning allocation | 5,000 | 100% | Measured as deduplicated visitors, not summed platform counts |

The channel figures are allocation targets. Visitors can touch more than one
channel, so only the canonical analytics total determines whether the goal is
met.

## Organic traffic model

For the 3,500-visitor organic allocation:

| Input | Type | Value |
| --- | --- | ---: |
| Organic visitors | Target | 3,500 |
| Search clicks per visitor | Assumption | 1.05 |
| Required monthly clicks | Calculated target | 3,675 |
| Blended click-through rate | Assumption | 5% |
| Required monthly impressions | Calculated target | 73,500 |

Formula: `3,500 x 1.05 = 3,675 clicks`; `3,675 / 0.05 = 73,500 impressions`.

| Blended CTR | Impressions needed for 3,675 clicks |
| ---: | ---: |
| 3% | 122,500 |
| 5% | 73,500 |
| 8% | 45,938 |

These are planning calculations, not evidence that the available keywords have
that demand. Search Console will show whether the portfolio is accumulating
enough relevant impressions.

## Positioning

Tent UI should not compete as another generic list of React components. Its
search advantage is first-hand implementation knowledge about interaction
details developers need to ship.

Every content candidate should meet all four conditions:

1. A developer is trying to build or fix something specific.
2. Tent UI has working source, a reproducible example, or direct experience.
3. The page can add information beyond the current official documentation.
4. The query can lead naturally to a useful component, block, or registry action.

Reject topics that only repeat definitions, summarize other articles, or use a
popular keyword without a product-backed solution.

## Three content pillars

### Async actions and button feedback

Use Stateful Button, Copy Button, Tailwind CSS Buttons, and Peeping Button to
cover loading behavior, duplicate-action prevention, success and error
feedback, clipboard interactions, keyboard behavior, and motion preferences.

The first article in this pillar is now `/blog/shadcn-loading-button`.

### Building with shadcn registries

Use Tent UI's own registry, installation docs, namespace, and MCP integration
to explain registry creation, source ownership, discovery, and maintenance from
first-hand experience.

### Purposeful React interaction patterns

Use Animated Tabs, Animated Arrow, Glow Card, Component Sidebar, and Scribbled
Text to explain state continuity, pointer effects, responsive navigation,
reduced motion, and animation that communicates change.

## Content portfolio

Work toward a portfolio rather than a post count:

| Page group | Target count | Average monthly click allocation | Group target |
| --- | ---: | ---: | ---: |
| Three substantial topic hubs | 3 | 350 | 1,050 |
| First-hand implementation guides | 15 | 140 | 2,100 |
| Component and block landing pages | 20 | 25 | 500 |
| Total organic allocation | 38 | Uneven in practice | 3,650 |

Actual performance will be uneven. A small number of strong pages should be
expected to generate most clicks. Counts are capacity targets, not permission to
publish thin pages.

## Candidate backlog

Validate each candidate with current autocomplete, Search Console, and a manual
result comparison immediately before writing it. Do not publish adjacent pages
until query data shows distinct intent.

| Candidate | Product proof | Intended job |
| --- | --- | --- |
| Shadcn loading button with success and error states | Stateful Button | Build a complete async action button |
| Prevent duplicate clicks in React async actions | Stateful Button | Protect a non-idempotent action before disabled state renders |
| React copy button with success and error feedback | Copy Button | Copy text and report clipboard failure |
| Tailwind CSS button examples | Tailwind CSS Buttons | Find copy-ready visual button treatments |
| Animated tabs in React with reduced motion | Animated Tabs | Preserve context while changing panels |
| Mouse-follow glow card effect | Glow Card | Build a pointer-responsive card without losing keyboard usability |
| Build a custom shadcn registry | Tent UI registry | Distribute copy-paste source from a registry |
| Use a shadcn registry with an AI coding agent | MCP docs | Discover and install registry components from an editor |
| Responsive component-library sidebar | Component Sidebar | Navigate many examples on desktop and mobile |

The duplicate-click topic may belong inside the loading-button article rather
than on a separate URL. Split it only if Search Console reveals distinct demand
and the new page can provide materially deeper testing or server-side
idempotency guidance.

## Publishing cadence

Use a sustainable engineering-led cadence:

| Monthly output | Quantity | Quality requirement |
| --- | ---: | --- |
| Deep implementation guides | 2 | Working demo, source, original diagram or test, limitations, and internal links |
| Existing page improvements | 4 | Better intent match, examples, metadata, internal links, or observed test evidence |
| Distribution packages | 2 | One package per guide: visual, code excerpt, concise lesson, tracked link |
| Portfolio review | 1 | Search Console decisions: expand, improve, consolidate, or stop |

At this cadence, 15 strong guides take roughly eight months. Topic hubs should
be assembled from proven clusters, not created before their supporting pages
show demand.

## First 90 days

### Days 0-7

1. Record the analytics and Search Console baseline.
2. Deploy `/blog/shadcn-loading-button` and verify its canonical, image,
   structured data, mobile render, and sitemap entry.
3. Inspect the URL in Search Console and submit the sitemap if it is not already
   registered.
4. Verify article-to-component navigation and install-copy events in OpenPanel.
5. Publish one technical excerpt with a canonical link on DEV after the original
   page is live and indexable.

### Days 8-30

1. Apply to the official shadcn Registry Directory if Tent UI meets its current
   requirements.
2. Prepare a legitimate `awesome-shadcn-ui` proposal that describes the full
   registry, not only the stateful button already represented by another project.
3. Share the state diagram, duplicate-click lesson, and reduced-motion behavior
   as separate useful posts instead of repeating a launch announcement.
4. Add blog RSS so readers can return without depending on a social algorithm.
5. Review indexing after 7-14 days and first query impressions after 28 days.

### Days 31-60

1. Choose the second guide from real query evidence and product fit.
2. Improve four component pages whose Search Console impressions show demand or
   whose content does not yet answer the landing intent.
3. Add observed keyboard, reduced-motion, and assistive-technology results where
   tests have actually been run.
4. Link related pages in both directions using descriptive, natural anchors.

### Days 61-90

1. Publish the third deep guide and its working demo.
2. Compare non-brand impressions, clicks, article-to-component visits, and
   install actions with the baseline.
3. Expand the winning pillar only if multiple relevant pages are gaining
   impressions without cannibalizing one another.
4. Consolidate weak overlapping pages rather than adding more URLs.
5. Set the next quarter from measured query and referral data.

## Distribution system

Each guide should produce several channel-native assets from the same original
work:

| Asset | Best use |
| --- | --- |
| 20-30 second deterministic demo | X, Bluesky, LinkedIn, and release notes |
| Static state or architecture diagram | Social preview, community explanation, and article reference |
| One surprising implementation excerpt | Developer communities and short technical posts |
| Condensed canonical cross-post | DEV, with `canonical_url` pointing to Tent UI |
| Reproducible test or benchmark | GitHub discussions and technical references |

Lead with the lesson. Disclose project ownership. Read current community rules
before posting, and do not drop identical promotional links into unrelated
threads.

Use UTM parameters on external campaign links. Never use them on internal links
or canonical URLs.

## Authority and links

Earn links with things another developer can reference:

1. Original state diagrams and implementation visuals.
2. Complete copy-ready source with clear licensing.
3. Accessibility and browser test matrices with exact versions.
4. Reproducible fixes for real Cloudflare, Next.js, React, and shadcn problems.
5. Registry tooling or examples that improve official ecosystem documentation.

Avoid paid link packages, reciprocal-link pages, mass guest-post outreach, and
AI-generated listicles. Those tactics do not build durable product authority and
can create search-policy risk.

## Conversion and retention

Traffic without product engagement is not success for Tent UI. Every guide
should have one primary next action that matches its topic:

| Landing intent | Primary next action |
| --- | --- |
| Learn an implementation | Open the exact component demo and source |
| Find copy-ready code | Copy the registry install command |
| Evaluate the library | Browse related components or blocks |
| Follow future work | Subscribe to blog RSS or watch GitHub releases |

Track the article-to-component click, install-command copy, demo interaction,
and GitHub visit. Use those signals to prioritize content that attracts likely
users rather than maximizing raw pageviews.

## Decision rules

| Signal | Action |
| --- | --- |
| URL not indexed after 7-14 days | Diagnose response, robots, canonical, rendering, sitemap, and internal links |
| Indexed with negligible relevant impressions after 8-12 weeks | Reassess actual demand before writing supporting content |
| Queries appearing at positions 11-30 | Deepen the matching section, add first-hand evidence, and improve relevant internal links |
| Top-10 impressions with weak CTR | Align title and description more directly with the observed intent |
| Visits with weak component engagement | Move the working demo and exact next action closer to the answer |
| Multiple pages ranking for the same intent | Consolidate or clearly differentiate them |
| Referral channel sends engaged visitors | Repeat the useful format, not merely the posting frequency |

## Milestones

These are operating milestones, not guaranteed forecasts:

| Horizon | Monthly unique target | Evidence required to continue |
| --- | ---: | --- |
| Months 0-3 | 1,000 | Reliable baseline, indexing, first non-brand query growth, and working conversion events |
| Months 4-6 | 2,000 | More than one guide and component page contributing qualified traffic |
| Months 7-12 | 3,500 | At least one proven content pillar plus repeatable referral distribution |
| Months 12-18 | 5,000 | Portfolio near 3,675 monthly organic clicks plus durable referral and returning traffic |

If the current verified baseline is already above a milestone, use the next one.
If impressions do not support the organic allocation, either choose a stronger
product-backed cluster or revise the channel mix. Do not compensate by lowering
content quality.

## Monthly review template

1. What were total deduplicated unique visitors and the channel mix?
2. Which non-brand queries and landing pages gained or lost clicks?
3. Which pages moved visitors to a component, install, or GitHub action?
4. Which distribution asset produced engaged referral traffic?
5. Are any pages overlapping in intent?
6. Which page should be improved, consolidated, expanded, or left alone?
7. What evidence justifies the next article?

The goal is not to publish indefinitely. It is to build a small set of pages
that developers repeatedly find, trust, reference, and use.
