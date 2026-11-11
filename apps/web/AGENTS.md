<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Component docs checklist

Every component in `src/registry/components/<slug>` needs a docs page at
`src/content/components/<slug>.mdx`. Use an existing page such as
`wheel-picker.mdx` as the model, and ship each new page with:

- **Frontmatter:** `title`, a keyword-friendly `description` (one sentence that
  says what it is and what makes it different, for example "A React OTP input
  for shadcn/ui with…"; it is the meta description, the `/llms.txt` line, and
  the JSON-LD description), `createdAt`, and `updatedAt`. Bump `updatedAt`
  whenever the page content changes, because the sitemap `lastmod` and IndexNow
  `--since` read it. `seoTitle` is optional: a search-focused page title for
  when the display title isn't what developers search for.
- **Wording:** describe TentUI as "free and source-available", never
  "open-source".
- **A `## FAQ` section** as the last `##` section, after `## API reference`,
  with 4-6 questions developers actually search for: how to install it with
  shadcn, accessibility and keyboard support, controlled state and forms (React
  Hook Form), customization, and "Is it free?". Every answer must match the
  component source; check the props, defaults, and dependencies before writing.
  Use exactly this format:

  ```mdx
  ## FAQ

  ### How do I install the Wheel Picker with shadcn?

  Run `npx shadcn@latest add @tentui/wheel-picker` after adding the `@tentui`
  registry to `components.json`. The CLI copies `wheel-picker.tsx` into your
  project and installs `motion`, `web-haptics`, and `@rexa-developer/tiks`.

  ### Is the Wheel Picker free to use?

  Yes. The Wheel Picker is free and source-available: the shadcn CLI copies its
  source into your project, and you can use it in unlimited personal and client
  projects under the [TentUI License](/license).
  ```

  Each `###` heading is one question and must end with `?`. The answer is the
  plain Markdown after it: answer first, 1-3 sentences, no components, code
  blocks, or nested headings. The section ends at the next `##` heading.

Schema is automatic. `src/lib/faq.ts` parses the FAQ section and the component
page emits FAQPage JSON-LD for it; pages without one emit none. The page,
`/llms.txt`, and `/llms-full.txt` all read the MDX, so there is nothing else to
register. Check the format with `pnpm exec tsx src/lib/faq.test.ts`, run from
`apps/web`.

# Search indexing (IndexNow)

`public/<key>.txt` holds the IndexNow key and is served at
`https://tentui.com/<key>.txt`. `INDEXNOW_KEY` can override the key, but it
must match the file name and contents, or submissions fail with 403. To use a
new key, replace the file and deploy before submitting.

After a deploy that adds or changes pages, notify Bing and the other IndexNow
engines:

```bash
pnpm --dir apps/web run indexnow --since 2026-11-11             # dry run, prints the payload
pnpm --dir apps/web run indexnow --since 2026-11-11 --submit    # sends it
pnpm --dir apps/web run indexnow /components/otp-field --submit # explicit URLs
```

Without URLs the script reads `https://tentui.com/sitemap.xml`, or another
sitemap URL or file passed with `--sitemap`. `--since` keeps only entries whose
`lastmod` is on or after the date. Submit only live pages that really changed.
