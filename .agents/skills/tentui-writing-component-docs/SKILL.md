---
name: tentui-writing-component-docs
description: Write and review TentUI component documentation in MDX and registry metadata. Use when creating or updating files in apps/web/src/content/components, synchronizing registry descriptions, documenting features, installation, usage, composition, accessibility, API references, examples, credits, or technical references, or reviewing TentUI component docs for consistency and quality.
---

# Write TentUI component documentation

Write concise, consistent documentation for components published through the TentUI shadcn registry. Ground every claim in the component source and demo; do not invent behavior, props, accessibility support, attribution, or links.

## Inspect the component first

Read the relevant files before writing:

- Documentation: `apps/web/src/content/components/{component-name}.mdx`
- Registry metadata: `apps/web/src/registry/components/_registry.ts`
- Component source: `apps/web/src/registry/components/{component-name}/`
- Demo source: `apps/web/src/registry/examples/{component-name}-demo.tsx`
- Demo metadata: `apps/web/src/registry/examples/_registry.ts`

Confirm the public component name, actual behavior, dependencies, exported props, composition, keyboard behavior, reduced-motion behavior, and original inspiration from these files.

Treat `apps/web/src/registry/__index__.tsx`, `apps/web/src/registry/__items__.json`, `apps/web/registry.json`, and files under `apps/web/public/r/` as generated output. Never edit them by hand.

## Follow the TentUI document structure

Use this section order and omit sections that do not add value. Use sentence-case for custom headings.

````markdown
---
title: Component Name
description: One concise sentence about what the component does.
new: true # optional
createdAt: YYYY-MM-DD
updatedAt: YYYY-MM-DD
---

<ComponentPreview name="{component-name}-demo" />

## Features              <!-- optional: non-obvious capabilities -->

## Installation

## Usage

## Composition           <!-- optional: compound components only -->

## Accessibility         <!-- optional: meaningful behavior to document -->

## API reference         <!-- optional: public props worth documenting -->

## Examples              <!-- optional -->

## Credits               <!-- optional: inspiration or original sources -->

## References            <!-- optional: technical reading; always last -->
````

Keep `createdAt` unchanged on an existing document and set `updatedAt` to the date of a meaningful documentation change. For a new document, use the same current date for both. Keep the registry item's `meta.createdAt` equal to the document's `createdAt`.

The `image` field is optional. Omit it to use TentUI's generated social image. When a custom image exists, use a verified TentUI-owned URL; never copy another project's asset host.

The component category comes from the `components/` directory and registry metadata, not MDX frontmatter.

## Write the description

Use the exact same `description` in MDX frontmatter and the component registry item.

1. Write one short sentence focused on what the component does, not how it is built.
2. Start with a verb or a concrete noun phrase. Do not start with “A,” “An,” or “A React component for.”
3. Remove implementation details such as Motion, React, or Tailwind CSS unless they are the subject of the documentation.
4. Avoid subjective filler such as “sleek,” “beautiful,” or “easy.”
5. Keep the sentence under about 80 characters when practical.

Prefer:

```text
Cycle through logos column by column in a staggered wave.
Display install commands with a package manager switcher and copy button.
Copy text to the clipboard with visual feedback.
```

Avoid:

```text
A sleek React component built with Motion for displaying animated logos.
```

## Write Features

Add `## Features` only when the title, description, preview, and usage do not reveal important capabilities such as multiple modes, unusual interactions, keyboard controls, persistence, or composability.

- Write two to four one-line bullets.
- Start with the capability.
- End every bullet with a period.
- Do not add an introductory paragraph or emoji.
- Do not repeat installation, usage, or API information.

```markdown
## Features

- Cycles columns independently in a staggered wave.
- Supports automatic and manually controlled playback.
```

Skip this section for self-explanatory components.

## Write Installation

Use TentUI's `@tentui` registry namespace in the CLI command:

```bash
npx shadcn@latest add @tentui/{component-name}
```

Follow the existing `<CodeTabs>`, `<TabsListInstallType />`, `<TabsContent>`, `<Steps>`, `<Step>`, and `<ComponentSource>` pattern when manual installation is useful. Derive dependency commands from the registry item and component imports. Do not list workspace-only packages that consumers do not install.

## Write Usage

Show the smallest realistic import and JSX example that demonstrates the public API. Keep the example consistent with the installed target path, normally:

```tsx
import { ComponentName } from "@/components/component-name";
```

Ensure the preview name resolves to an item in `apps/web/src/registry/examples/_registry.ts` and that its source file exists.

## Write Composition

Add `## Composition` only for compound components that consumers assemble from multiple subcomponents. Place it immediately after Usage.

Start with:

```text
Use the following composition to build a `ComponentName`.
```

Then show the complete Usage JSX hierarchy in a `text` fence with `├──`, `└──`, and `│`. Include wrapped primitives from other packages when they are part of the public composition.

````markdown
## Composition

Use the following composition to build a `Testimonial`.

```text
Testimonial
├── TestimonialQuote
└── TestimonialAuthor
    ├── TestimonialAvatar
    │   ├── TestimonialAvatarImage
    │   └── TestimonialAvatarRing
    └── TestimonialAuthorName
```
````

Skip this section for single components configured only through props.

## Write Accessibility

Add `## Accessibility` when the component has accessibility behavior that consumers need to understand. Document only behavior verified in the implementation, such as:

- Keyboard controls and focus behavior.
- Semantic roles, labels, and announcements.
- Reduced-motion behavior.
- Consumer responsibilities for accessible names, alt text, or contrast.

Use specific subheadings such as `### Keyboard interaction` or `### Reduced motion` when covering more than one concern. Do not claim compliance or support that has not been tested or implemented.

## Write API reference

Use TentUI's generated type table when the component exports a stable props type:

```mdx
### ComponentName

<AutoTypeTable
  path="src/registry/components/{component-name}/{component-name}.tsx"
  name="ComponentNameProps"
/>
```

Match `path` and `name` to real source exports. Omit the section when there is no useful public API to document.

## Separate Credits from References

Use this intent check:

- Put a link in `## Credits` when it answers “Who or what inspired this component?”
- Put a link in `## References` when it answers “How does this work?” or “Where can I learn the relevant API?”
- Prefer Credits when one link genuinely fits both.
- Skip generic links that do not help readers trace the origin or understand the implementation.

### Credits

Place Credits near the end, before References. Use one markdown-link bullet per source, normally one to five items. Display only the creator, organization, product, or handle, and point to the exact original source whenever possible.

```markdown
## Credits

- [@creator](https://x.com/creator/status/123)
- [Devouring Details](https://example.com/exact-interaction)
```

Do not add a thank-you paragraph, emoji, generic technical documentation, or labels such as “Original demo by.”

### References

Place References last. Use one markdown-link bullet per technical source, normally one to five items. Add short context after an em dash only when the relevance is not obvious.

```markdown
## References

- [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [Motion layout animations](https://motion.dev/docs/react-layout-animations) — layout transition behavior
```

Do not use References for attribution, and do not add broad React or Tailwind homepages without component-specific value.

## Synchronize the registry item

Use TentUI's current registry schema. Do not add an `author` field; TentUI's registry items do not use one.

```typescript
{
  name: "component-name",
  type: "registry:component",
  title: "Component Name",
  description: "Same one-sentence description as the MDX frontmatter.",
  dependencies: ["motion"],
  files: [
    {
      path: "components/component-name/component-name.tsx",
      type: "registry:component",
      target: "@components/component-name.tsx",
    },
  ],
  categories: ["marketing"],
  meta: {
    createdAt: "YYYY-MM-DD",
  },
  docs: "https://tentui.com/components/component-name",
}
```

Include only fields and dependencies supported by the actual component. Keep the registry `name`, doc slug, preview dependency, public docs URL, source path, and target path consistent.

## Verify the result

Before finishing:

1. Compare the MDX description character-for-character with the registry description.
2. Verify every documented feature, prop, interaction, accessibility claim, credit, and reference against source or a trustworthy exact URL.
3. Confirm section order: Preview → Features → Installation → Usage → Composition → Accessibility → API reference → Examples → Credits → References.
4. Confirm dates, filenames, slugs, preview names, source paths, `@tentui` install commands, and docs URLs.
5. Run `pnpm registry:build` from the repository root to refresh generated registry artifacts.
6. Run `pnpm registry:validate` from the repository root.
7. Run the narrowest relevant type or build check when component or MDX code changed.

Review generated diffs after building, but fix source registry files rather than generated artifacts.
