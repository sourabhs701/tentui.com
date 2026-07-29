# SEO Content Opportunity: Shadcn Loading Button

Research date: 2026-07-26

## Executive recommendation

Publish a first-party implementation guide titled **"Shadcn Loading Button with Success and Error States"** at `/blog/shadcn-loading-button`, paired closely with the existing [Stateful Button](https://tentui.com/components/stateful-button) component.

This is the strongest immediate SEO wedge because:

- Google Autocomplete exposes a specific cluster around `shadcn loading button`, `shadcn button loading state`, and closely related phrases.
- Developers have repeatedly requested loading-button behavior in the official shadcn repository.
- Official shadcn documentation shows how to place a spinner in a button, but its documented Button API has no loading-state prop and does not cover the complete async lifecycle.
- Tent UI already has first-party code for loading, success, and error states, duplicate-action prevention, status announcements, and reduced-motion handling.
- The article can solve a real implementation problem and lead naturally to a copy-paste component, rather than manufacturing a topic only for search traffic.

The evidence supports testing this article. It does **not** establish search volume, ranking difficulty, or a guarantee that this page alone can produce 5,000 monthly visitors. A credible route to 5,000 monthly organic users requires a measured portfolio of implementation guides, hubs, and component pages.

## Evidence labels

The report uses these labels to prevent estimates from being mistaken for facts:

- **Measured:** observed directly in the repository or a cited first-party API/page on 2026-07-26.
- **Inferred:** a conclusion drawn from measured evidence.
- **Assumed:** an explicit input used only for planning arithmetic.
- **Target:** a result to work toward, not a forecast.

## Decision

### Recommended topic

| Field | Recommendation |
| --- | --- |
| Primary query | `shadcn loading button` |
| Search intent | Build or copy a shadcn-compatible button that communicates an asynchronous action |
| Article title | Shadcn Loading Button with Success and Error States |
| Slug | `/blog/shadcn-loading-button` |
| Primary CTA | Try or install Tent UI's Stateful Button |
| Audience | React developers using shadcn who need robust async-action feedback |
| Differentiator | A complete async state machine plus duplicate-action protection, status announcements, and reduced motion |
| Confidence | High product fit; medium demand confidence; medium-high direct competition; unknown traffic potential |

### Why this topic fits Tent UI

**Measured:** Tent UI describes itself as hand-crafted React components and landing-page blocks built for shadcn. Its repository supports shadcn CLI installation and direct source editing.[^repo-readme]

**Measured:** The tracked registry contains 12 components and 13 blocks. The Stateful Button specifically promises loading, success, and error states for asynchronous actions.[^component-registry][^block-registry]

**Measured:** The implementation:

- Models `idle`, `loading`, `success`, and `error` states.
- Uses a synchronous ref guard to reject rapid duplicate clicks.
- Disables the button while an action or feedback state is active.
- Sets `aria-busy` during loading.
- Exposes non-idle labels through a polite `role="status"` live region.
- Uses Motion's user reduced-motion configuration and stops the spinner under `prefers-reduced-motion`.[^stateful-source]

**Inferred:** Tent UI can demonstrate first-hand implementation knowledge that a generic SEO publisher cannot. The content can include the actual source, design decisions, failure handling, and observed accessibility tests.

## Demand evidence

### Google Autocomplete cluster

The following suggestions were returned by Google's public suggestion endpoint on 2026-07-26.[^autocomplete-loading-button][^autocomplete-button-loading][^autocomplete-spinner][^autocomplete-async][^autocomplete-accessibility]

| Seed | Relevant returned suggestions |
| --- | --- |
| `shadcn loading button` | `shadcn loading button`; `shadcn loader button`; `shadcn button loading state`; `shadcn button loading spinner`; `shadcn ui loading button`; `shadcn ui button loading state` |
| `shadcn button loading` | `shadcn button loading`; `shadcn button loading state`; `shadcn button loading spinner`; `shadcn ui button loading`; `shadcn ui button loading state` |
| `shadcn spinner button` | `shadcn spinner button`; `shadcn loading spinner button` |
| `shadcn async button` | `shadcn async button` |
| `loading button accessibility` | `loading button accessibility`; `button loading state accessibility` |
| `button loading state accessibility` | `button loading state accessibility` |

**Measured:** There are 13 unique, relevant phrases across these responses after removing duplicates and unrelated Vue, switch, and loading-bar suggestions.

**Inferred:** The variations indicate recurring implementation language around the same job: adding a loading state or spinner to a shadcn button. The accessibility suggestions support a useful secondary section, but they do not prove that accessibility is the dominant intent for the primary query.

**Important limitation:** Autocomplete confirms that Google has enough query activity or related data to suggest phrases. It does not disclose monthly search volume, keyword difficulty, click potential, geography, or ranking feasibility. Suggestions can change by date, locale, and request context.

### First-party developer demand

The official `shadcn-ui/ui` repository provides direct evidence that developers encounter this problem:

- Issue [#3117, "Adding a 'loading' prop for buttons"](https://github.com/shadcn-ui/ui/issues/3117), requested native loading behavior and supplied an implementation. It accumulated 9 comments before being closed as completed.[^issue-3117]
- Issue [#6734, "Button with useFormStatus"](https://github.com/shadcn-ui/ui/issues/6734), reports a delayed loading indicator and duplicate invocation around a form action.[^issue-6734]
- Pull request [#471](https://github.com/shadcn-ui/ui/pull/471) proposed a reusable `isLoading` prop and spinner example.[^issue-search]
- Pull request [#3289](https://github.com/shadcn-ui/ui/pull/3289) proposed a `loading` prop in response to issue #3117.[^issue-search]
- Pull request [#8353](https://github.com/shadcn-ui/ui/pull/8353) again proposed adding a loading state to `button.tsx`.[^issue-search]
- Pull request [#10307](https://github.com/shadcn-ui/ui/pull/10307) proposed a submit button with loading-state support, disabling, a spinner, and `aria-busy`.[^issue-search]

**Measured:** A GitHub API search for the phrase `"loading button"` in issue titles and bodies returned 13 issues and pull requests on 2026-07-26. Some results are only adjacent to the exact problem, so this count should not be presented as 13 direct feature requests.[^issue-search]

**Inferred:** Repeated issues and pull requests over several years show durable implementation friction. This is stronger evidence of audience pain than a generic keyword list, but it remains separate from search-volume evidence.

### Ecosystem scale, not keyword volume

- **Measured:** The npm downloads API reported 24,718,296 downloads of the `shadcn` package from 2026-06-25 through 2026-07-24.[^npm-downloads]
- **Measured:** GitHub's repository API reported 119,859 stars and 9,549 forks for `shadcn-ui/ui` on 2026-07-26.[^shadcn-repo]

**Inferred:** The implementation sits inside a large active ecosystem.

**Important limitation:** Package downloads and GitHub stars are not unique developers, search demand, or addressable traffic for this article. They should only be used to establish ecosystem relevance.

## Content gap

### Known competing content

This is a content comparison, not a Google ranking report. Google result pages could not be reliably retrieved during this research, so no claim is made about current positions.

| Source | What it provides | Gap Tent UI can address |
| --- | --- | --- |
| Official shadcn Button docs | A Spinner section showing a `<Spinner />` inside a button; documented Button API lists `variant`, `size`, and `asChild` | No documented loading-state prop or end-to-end async lifecycle; no success/error recovery discussion[^shadcn-button] |
| Official shadcn Spinner docs | A status-labeled spinner and examples inside buttons, badges, input groups, and empty states | Focuses on the indicator, not action orchestration, duplicate prevention, or post-action feedback[^shadcn-spinner] |
| shadcn/ui expansions | A `LoadingButton` with a boolean `loading` prop, disabled behavior, and spinner | Covers loading only; the displayed source does not include success/error states, `aria-busy`, a live status message, or reduced-motion handling[^expansions-loading] |
| Stateful-Button-React | A direct shadcn-compatible substitute with XState, spinner and progress modes, success/error states, customizable ARIA messages, a reduced-motion hook, registry install, and Cypress component tests | Strong existing substitute. Tent UI declares fewer dependencies, uses a synchronous ref guard before the next render, keeps status labels visible, and fully stops spinner rotation under reduced motion; the article must demonstrate those differences rather than claim the state model is unique[^stateful-competitor] |
| Tent UI Stateful Button | Async lifecycle, four states, a click guard, status labels, and reduced-motion behavior | Needs a substantial explanatory guide and documented browser/assistive-technology observations[^stateful-source] |

### Defensible angle

Do not publish another page whose entire value is "put a spinning icon before the label." The official docs already satisfy that narrow need.

Do not claim to be the first stateful shadcn button either. `Stateful-Button-React` already covers the same four states, adds determinate progress, ships through a registry, and has automated component tests. Tent UI's case is fewer declared dependencies, explicit rapid-click protection, visible state labels, and stricter reduced-motion behavior, presented through a more complete implementation guide.[^stateful-competitor]

The article should answer the harder questions:

1. What state model prevents impossible combinations such as loading and success at once?
2. How is a second action prevented before React has rendered the disabled state?
3. What should happen when the promise rejects?
4. How and when should success or error feedback reset?
5. How are waiting, success, and error messages exposed without moving focus?
6. What changes when the user requests reduced motion?
7. Which behaviors were actually tested, in which browser and assistive-technology combinations?

This angle is aligned with Google's guidance to provide original, substantial, first-hand content that adds value beyond rewriting other sources.[^helpful-content]

## Article specification

### Search presentation

| Element | Draft |
| --- | --- |
| Title and H1 | Shadcn Loading Button with Success and Error States |
| Meta description | Build an accessible shadcn loading button with loading, success, and error states, duplicate-action protection, live updates, and reduced motion. |
| Canonical | `https://tentui.com/blog/shadcn-loading-button` |
| Social image | A 1200x630 image showing idle, loading, success, and error states |

Use the primary phrase naturally in the title, H1, introduction, and one descriptive internal anchor. Do not repeat every autocomplete variation. Google recommends using the words people use in prominent locations while explicitly discouraging keyword stuffing.[^search-essentials][^crawlable-links]

### Reader promise

By the end, a reader should have a shadcn-compatible async action button that:

- Shows meaningful loading, success, and error feedback.
- Prevents accidental duplicate execution.
- Announces status changes without moving focus.
- Honors reduced-motion preferences.
- Can be installed from the Tent UI registry or copied and adapted.

The current component is an async **action button** that defaults to `type="button"`. Do not describe it as a drop-in form-submit solution without first implementing and testing form semantics, React action behavior, and `useFormStatus` integration.

### Recommended outline

1. **Start with the finished behavior**
   Show the interactive component immediately, including a deterministic success path and error path.
2. **Why a spinner is not the state model**
   Define `idle | loading | success | error` and explain which transitions are allowed.
3. **Install the component**
   Include `npx shadcn@latest add @tentui/stateful-button`, dependencies, and the manual-copy option.
4. **Run an async action safely**
   Explain the Promise-based `onClick`, state transition order, and the ref guard that closes the rapid-click window before a disabled render occurs.
5. **Handle success and failure**
   Explain the feedback duration, custom labels, reset behavior, and the decision to catch a rejected Promise.
6. **Communicate status accessibly**
   Explain `aria-busy`, the polite status region, decorative icons, and why status changes should not steal focus.
7. **Respect reduced motion**
   Show what MotionConfig and `motion-reduce` change, including the non-spinning loading icon.
8. **Test behavior, not just markup**
   Publish observed keyboard, rapid-click, rejection, reduced-motion, and screen-reader results.
9. **Copy, install, and adapt**
   Link to the component page and full source with descriptive anchors.

### Original assets required

- An interactive demo with controlled success and error outcomes.
- The complete source, not pseudocode.
- A compact state-transition diagram.
- A behavior table for each state: label, disabled state, `aria-busy`, icon, announcement, and exit condition.
- A rapid-click reproduction showing that the action runs once.
- A reduced-motion comparison.
- A test matrix populated only with observed results.
- A concise "when not to use this component" note, including navigation and long-running jobs that need progress or cancellation.

### Accessibility basis and test requirement

WCAG 2.2 Success Criterion 4.1.3 says status messages must be programmatically determinable so assistive technologies can present them without receiving focus. Its examples explicitly include waiting, success, and error information, and its sufficient techniques include `role="status"` for status and result messages.[^wcag-status]

The existing live region is directionally aligned with this guidance. That is not enough to declare the component universally accessible. Before publication, test and record:

| Scenario | Required observation |
| --- | --- |
| Keyboard | Space and Enter activate once; focus behavior remains understandable through disabled and reset states |
| Rapid activation | Multiple clicks or key presses invoke the async handler once |
| Success | Visible label and status announcement are both understandable |
| Rejection | Error label is visible and announced; control becomes usable again after feedback |
| Reduced motion | Character transforms and spinner rotation stop without removing status information |
| Long labels | Layout remains readable at narrow mobile widths and 200% zoom |
| Unmount | Pending reset timer is cleaned up without warnings |

Record browser, OS, screen reader, and version. Do not turn untested expectations into claims.

## Internal linking plan

Google says every important page should receive a crawlable link from at least one other page, and that descriptive internal anchor text helps people and Google understand the destination.[^crawlable-links]

Add links when the article is implemented:

| Source page | Destination | Suggested natural anchor |
| --- | --- | --- |
| `/blog/shadcn-loading-button` | `/components/stateful-button` | `copy the Stateful Button component` |
| `/components/stateful-button` | `/blog/shadcn-loading-button` | `build an accessible shadcn loading button` |
| `/blog/why-copy-paste-components` | New article or component | `a complete async button you can own` |
| `/blog/motion-that-earns-its-place` | New article | `reduced-motion behavior for async feedback` |
| `/components/tailwindcss-buttons` | New article | `add loading, success, and error behavior` |
| `/components` | Stateful Button | `Stateful Button` with its async-state description |

Keep links in relevant prose. Do not add site-wide exact-match anchors solely for SEO.

## Technical publication checklist

### Existing foundation

The application already provides most of the necessary infrastructure:

- Blog metadata includes title, description, canonical URL, Open Graph article data, Twitter card data, publication and modification dates.[^blog-page]
- Blog pages emit `BlogPosting` and breadcrumb JSON-LD.[^blog-page]
- Blog posts are included in the generated sitemap.[^sitemap]
- `robots.ts` allows public routes and points crawlers to the sitemap.[^robots]

### Before launch

- Keep title, H1, description, canonical, visible byline, dates, and JSON-LD consistent.
- Use a representative, crawlable social/article image rather than a generic logo.
- Add an author URL to structured data if Tent UI has a stable author or profile page. Google recommends an author URL or `sameAs` value for disambiguation.[^article-data]
- Validate `BlogPosting` and breadcrumbs with Google's Rich Results Test.
- Verify the rendered article contains crawlable `<a href>` links.
- Confirm the new URL appears in `/sitemap.xml` with an accurate modification date.
- Test mobile layout, 200% zoom, keyboard interaction, and reduced motion.
- Run PageSpeed Insights, but treat field Core Web Vitals as unavailable until sufficient real-user data exists.
- Submit or inspect the URL in Search Console after deployment.

Google explicitly notes that meeting technical and structured-data requirements does not guarantee crawling, indexing, ranking, or rich-result display.[^search-essentials][^article-data]

## Distribution plan

Distribution should expose useful work to relevant developers, not manufacture links.

### Launch sequence

1. Publish the article and component update together, if an update is needed.
2. Inspect the live URL and submit the sitemap in Google Search Console.
3. Add a GitHub release or repository note only when there is a real component release to announce.
4. Submit Tent UI to the official shadcn Registry Directory if it meets the documented registry requirements and is not already listed. The official process is a pull request against `apps/v4/registry/directory.json`.[^registry-directory]
5. Consider proposing Tent UI to `awesome-shadcn-ui` after reviewing its current submission process. A direct `stateful-button` substitute is already listed, so acceptance is not automatic and a proposal must show broader registry value or material differentiation. The list had 20,146 GitHub stars on the research date, making it a relevant discovery surface, not a traffic guarantee.[^awesome-shadcn]
6. Publish a condensed technical version on DEV under relevant tags such as `react`, `typescript`, `webdev`, or `accessibility`, using DEV's `canonical_url` front-matter field to point to the Tent UI article. The `react` tag explicitly accepts React-related tutorials and discussion.[^dev-react]
7. Share the test findings and state diagram on channels where the maintainer already participates. Lead with the implementation lesson, not a generic product announcement.
8. Post to other communities only after checking each community's current self-promotion rules. Disclose project ownership.

### Reusable distribution assets

- A 20-30 second success/error demonstration.
- A static state-transition diagram.
- A concise code excerpt showing the ref guard and live status region.
- A short accessibility test table.
- A link directly to the article, plus a separate link to the registry install for readers who only need the code.

Use UTM parameters on promotional links so referral distribution can be distinguished from organic search. Do not add UTM parameters to internal links or canonical URLs.

## Measurement plan

### Establish the missing baseline

The repository README contains a marketing statement about reaching 1K+ developers monthly, but no analytics source was available in this research. Do not use that statement as the SEO baseline.[^repo-readme]

Before publishing, record:

- Unique visitors and sessions from the site's existing OpenPanel or Umami-compatible analytics for the previous 28 and 90 days, segmented to organic landings where referrer data permits.
- Search Console clicks, impressions, CTR, and average position for the previous 28 and 90 days.
- Indexed page count and sitemap status.
- Branded versus non-branded query clicks.
- Existing clicks and impressions for `/components/stateful-button` and all button-related queries.
- Conversions from organic landings to component views, install-command copies, and GitHub visits.

Search Console is the source for Google query, page, country, click, impression, and indexing data. Google recommends verifying ownership, reviewing indexing, submitting a sitemap, and monitoring the Search performance report.[^search-console]

### Article checkpoints

| Timing | Review | Decision |
| --- | --- | --- |
| Launch day | Live render, canonical, sitemap, JSON-LD, analytics events | Fix publication errors before distribution |
| Day 7-14 | URL Inspection and index status | Diagnose crawl/index issues; do not rewrite the article for traffic yet |
| Day 28 | First query and page impressions | Record discovered language; identify relevant queries not answered by the article |
| Day 56 | Impressions, clicks, position bands, CTA behavior | Improve weak sections or snippet only when the data identifies a specific problem |
| Day 84 | Non-brand growth and assisted component usage | Decide whether the async-button cluster merits supporting pages |
| Quarterly | Portfolio users, impressions, links, conversions, stale facts | Expand winners, consolidate overlap, and refresh only where content changed |

### Diagnostic rules

These are decision rules, not performance predictions:

- **Not indexed:** inspect crawlability, canonical, rendered content, sitemap, and server response.
- **Indexed with almost no impressions after 8-12 weeks:** do not assume a title rewrite will create demand. Reassess the topic with Search Console and a volume dataset.
- **Impressions at positions 11-30:** deepen the section matching the observed query, improve relevant internal links, and earn legitimate discovery through distribution.
- **Top-10 impressions with weak CTR:** compare the title and snippet with the actual intent; test a clearer benefit without sensational language.
- **Clicks without component engagement:** make the demo, install option, and relationship to Stateful Button clearer.
- **Queries split across overlapping pages:** consolidate or differentiate intent rather than publishing more near-duplicates.

## Path to 5,000 monthly organic users

### Reverse target model

No Search Console, analytics, or paid keyword-volume export was available. The following is planning arithmetic only.

| Input | Type | Value |
| --- | --- | ---: |
| Monthly organic users | Target | 5,000 |
| Organic clicks per user | Assumed | 1.05 |
| Required monthly organic clicks | Calculated target | 5,250 |
| Blended organic CTR | Assumed | 5% |
| Required monthly impressions | Calculated target | 105,000 |

Formula: `5,000 users x 1.05 clicks per user = 5,250 clicks`; `5,250 clicks / 0.05 CTR = 105,000 impressions`.

Sensitivity to the assumed blended CTR:

| Blended CTR | Impressions required for 5,250 clicks |
| ---: | ---: |
| 3% | 175,000 |
| 5% | 105,000 |
| 8% | 65,625 |

This model is useful because Search Console can validate impressions and CTR before GA4 reaches the user goal. It is not evidence that these impression levels are available in the selected query cluster.

### Portfolio allocation model

One narrow article should not be expected to produce 5,250 monthly clicks. A possible target allocation is:

| Page group | Target count | Average click target | Group click target |
| --- | ---: | ---: | ---: |
| Three substantial topic hubs | 3 | 500 | 1,500 |
| First-party implementation guides | 15 | 180 | 2,700 |
| Component and block landing pages | 20 | 52.5 | 1,050 |
| Total | 38 | - | 5,250 |

These averages are allocation targets, not forecasts for individual pages. Actual traffic will be uneven: a few pages may carry most clicks while many pages contribute little.

### Build the portfolio from product evidence

Use three connected areas, subject to validation in Search Console before each expansion:

1. **Buttons and async feedback:** loading states, success/error feedback, duplicate actions, copy feedback, keyboard behavior, and reduced motion.
2. **Building and distributing shadcn registries:** installation, custom registries, namespaces, MCP workflows, and maintaining copy-paste components.
3. **Purposeful interaction patterns:** animated tabs, contextual actions, pointer effects, navigation for component libraries, and motion accessibility.

Each guide should be backed by a working Tent UI component, source-level experience, or a reproducible test. Avoid producing generic articles merely to fill a count. Google explicitly warns against publishing many search-first pages across topics without original value.[^helpful-content]

### Conservative operating sequence

| Phase | Work | Gate before expansion |
| --- | --- | --- |
| Month 0-1 | Establish baseline; publish the loading-button guide; improve its component-to-article links | URL indexed, OpenPanel or Umami-compatible tracking verified, first relevant queries recorded |
| Month 2-3 | Publish up to three closely related guides or page improvements based on observed queries | Relevant non-brand impressions grow across more than one page |
| Month 4-6 | Build the first hub and deepen high-impression component pages | Cluster pages show distinct intent rather than cannibalizing each other |
| Month 7-12 | Expand successful clusters, earn directory/list inclusion, refresh test evidence | Portfolio has repeatable impressions, clicks, and component engagement |
| Month 12-18 | Work toward the 38-page allocation and 105,000-impression target | Search Console trajectory supports the 5,250-click target |

The 12-18 month window is an operating horizon, not a forecast. If the baseline is already substantial, it may be faster. If the domain has little non-brand visibility or the addressable demand is smaller than assumed, it may take longer or require a different channel mix.

### Stop conditions

Pause expansion of this cluster when:

- The article is indexed but receives negligible relevant impressions after a reasonable observation period.
- A reliable keyword dataset shows the cluster cannot support the traffic objective.
- Search Console shows that adjacent pages overlap rather than expand query coverage.
- Organic readers consume the article but show no meaningful interest in Tent UI components.
- Publishing additional pages would require content outside Tent UI's direct experience.

## Risks and limitations

- No Google Search Console or analytics account was available, so current organic traffic and rankings are unknown.
- No paid keyword-volume dataset was available. This report contains no monthly volume or keyword-difficulty claim.
- Google Trends requests were rate-limited during research, so no trend direction is asserted.
- Google result pages could not be retrieved reliably, so the competitor set is illustrative rather than exhaustive and no ranking position is claimed.
- Google Autocomplete is dynamic and is not a volume estimator.
- npm downloads, GitHub stars, issues, and pull requests establish ecosystem relevance or developer friction, not search traffic.
- Accessibility guidance establishes requirements; only hands-on testing can establish observed component behavior.
- Search traffic is affected by indexing, authority, competition, result features, seasonality, geography, and changes to search systems.
- Google does not guarantee crawling, indexing, ranking, or rich-result appearance even when its published guidance is followed.[^search-essentials][^article-data]

## Final assessment

**Proceed with the article as a measured validation wedge.** The topic has a clear query cluster, durable developer pain, and excellent product fit. Direct competition is stronger than the official docs alone suggest, so the article must earn attention through first-hand testing, fewer dependencies, robust duplicate-action handling, visible feedback, and reduced-motion behavior.

**Do not present it as a standalone 5,000-visitor opportunity.** The defensible strategy is to publish one unusually complete first-party guide, measure query discovery and conversion, then use that evidence to decide whether to build the wider button, registry, and interaction-pattern portfolio.

## Sources

All web sources were accessed on 2026-07-26 unless otherwise noted.

[^repo-readme]: Tent UI repository, [`README.md`](../README.md). Product positioning, shadcn installation, direct source editing, and the unverified 1K+ developer marketing statement.
[^component-registry]: Tent UI repository, [`apps/web/src/registry/components/_registry.ts`](../apps/web/src/registry/components/_registry.ts). Twelve component registry entries and Stateful Button description.
[^block-registry]: Tent UI repository, [`apps/web/src/registry/blocks/_registry.ts`](../apps/web/src/registry/blocks/_registry.ts). Thirteen block registry entries.
[^stateful-source]: Tent UI repository, [`apps/web/src/registry/components/stateful-button/stateful-button.tsx`](../apps/web/src/registry/components/stateful-button/stateful-button.tsx), and [`apps/web/src/content/components/stateful-button.mdx`](../apps/web/src/content/components/stateful-button.mdx). State model, click guard, disabled behavior, live status, reduced motion, install command, and docs.
[^autocomplete-loading-button]: Google Suggest API, [`shadcn loading button`](https://suggestqueries.google.com/complete/search?client=firefox&q=shadcn%20loading%20button).
[^autocomplete-button-loading]: Google Suggest API, [`shadcn button loading`](https://suggestqueries.google.com/complete/search?client=firefox&q=shadcn%20button%20loading).
[^autocomplete-spinner]: Google Suggest API, [`shadcn spinner button`](https://suggestqueries.google.com/complete/search?client=firefox&q=shadcn%20spinner%20button).
[^autocomplete-async]: Google Suggest API, [`shadcn async button`](https://suggestqueries.google.com/complete/search?client=firefox&q=shadcn%20async%20button).
[^autocomplete-accessibility]: Google Suggest API, [`loading button accessibility`](https://suggestqueries.google.com/complete/search?client=firefox&q=loading%20button%20accessibility) and [`button loading state accessibility`](https://suggestqueries.google.com/complete/search?client=firefox&q=button%20loading%20state%20accessibility).
[^issue-3117]: GitHub REST API, [`shadcn-ui/ui` issue #3117](https://api.github.com/repos/shadcn-ui/ui/issues/3117). Feature request, state, comments, dates, and reactions.
[^issue-6734]: GitHub, [`shadcn-ui/ui` issue #6734](https://github.com/shadcn-ui/ui/issues/6734). `useFormStatus` and duplicate-action report.
[^issue-search]: GitHub REST API, [issue and pull-request search for `"loading button"`](https://api.github.com/search/issues?q=repo%3Ashadcn-ui%2Fui+%22loading+button%22+in%3Atitle%2Cbody). Returned count and related proposals.
[^npm-downloads]: npm downloads API, [`shadcn` last-month point](https://api.npmjs.org/downloads/point/last-month/shadcn). Returned 24,718,296 downloads for 2026-06-25 through 2026-07-24.
[^shadcn-repo]: GitHub REST API, [`shadcn-ui/ui` repository](https://api.github.com/repos/shadcn-ui/ui). Repository description, stars, forks, and activity metadata.
[^shadcn-button]: shadcn, [Button documentation](https://ui.shadcn.com/docs/components/radix/button). Spinner example and documented Button API.
[^shadcn-spinner]: shadcn, [Spinner documentation](https://ui.shadcn.com/docs/components/radix/spinner). Spinner source, status semantics, and button examples.
[^expansions-loading]: shadcn/ui expansions, [Loading Button documentation](https://shadcnui-expansions.typeart.cc/docs/loading-button). Secondary competitor source and displayed implementation.
[^stateful-competitor]: Stateful-Button-React, [repository](https://github.com/nanyx95/Stateful-Button-React), [README](https://github.com/nanyx95/Stateful-Button-React/blob/main/README.md), [component source](https://github.com/nanyx95/Stateful-Button-React/blob/main/registry/new-york/ui/stateful-button/stateful-button.tsx), and [Cypress tests](https://github.com/nanyx95/Stateful-Button-React/blob/main/cypress/component/stateful-button.cy.tsx). Direct substitute, features, implementation details, registry install, and test coverage. GitHub's repository API reported 16 stars on 2026-07-26.
[^wcag-status]: W3C Web Accessibility Initiative, [Understanding WCAG 2.2 Success Criterion 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html). Page updated 2026-05-11.
[^search-essentials]: Google Search Central, [Google Search Essentials](https://developers.google.com/search/docs/essentials). Eligibility, people-first content, prominent search language, crawlable links, and non-guarantee.
[^helpful-content]: Google Search Central, [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content). Original value, first-hand expertise, and warnings against search-first production.
[^crawlable-links]: Google Search Central, [Link best practices for Google](https://developers.google.com/search/docs/crawling-indexing/links-crawlable). Crawlable anchors, descriptive text, and internal links.
[^article-data]: Google Search Central, [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article). `BlogPosting`, recommended author, image and date properties, validation, sitemap, and non-guarantee.
[^search-console]: Google Search Central, [Get started with Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start). Verification, indexing, sitemaps, and Search performance reporting.
[^blog-page]: Tent UI repository, [`apps/web/src/app/(site)/blog/_components/blog-post-page.tsx`](../apps/web/src/app/%28site%29/blog/_components/blog-post-page.tsx). Blog metadata, byline, canonical, `BlogPosting`, and breadcrumb data.
[^sitemap]: Tent UI repository, [`apps/web/src/app/sitemap.ts`](../apps/web/src/app/sitemap.ts). Generated blog, docs, components, and category URLs.
[^robots]: Tent UI repository, [`apps/web/src/app/robots.ts`](../apps/web/src/app/robots.ts). Public allow rule and sitemap declaration.
[^registry-directory]: shadcn, [Registry Directory documentation](https://ui.shadcn.com/docs/registry/registry-index). Public directory purpose, submission process, and requirements.
[^awesome-shadcn]: GitHub, [`birobirobiro/awesome-shadcn-ui`](https://github.com/birobirobiro/awesome-shadcn-ui), and its [repository API](https://api.github.com/repos/birobirobiro/awesome-shadcn-ui). Curated list contents, existing stateful-button entry, and audience indicators.
[^dev-react]: DEV Community, [`react` tag](https://dev.to/t/react), and [Editor Guide](https://dev.to/p/editor_guide). Tag purpose, submission guidance, and the `canonical_url` front-matter field.
