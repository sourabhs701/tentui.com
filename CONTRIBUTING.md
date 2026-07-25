# Contributing to TentUI

Thank you for considering a contribution to TentUI. Thoughtful bug fixes,
component improvements, documentation updates, and accessibility enhancements
help keep the library useful and polished.

Please read these guidelines before getting started.

## Issue tracker

We use [GitHub Issues](https://github.com/sourabhs701/tentui.com/issues) for bug
reports, feature requests, and project discussions.

Before starting work:

1. Search the issue tracker for an existing report or proposal.
2. Add relevant information to an existing issue when one exists.
3. Open a new issue before beginning a substantial change so its scope and
   approach can be discussed.

For bugs, include reproduction steps, expected and actual behavior, browser and
device details, and a minimal reproduction when possible.

## Contribution scope

We currently welcome:

- Bug fixes and component enhancements
- Accessibility and responsive design improvements
- Performance improvements
- Documentation and example corrections
- Build, registry, and developer-experience fixes

New community components and blocks are not currently being accepted. Please do
not open a pull request for a new registry item without prior maintainer approval.

## Branch naming

Create a focused branch from `main` using one of these prefixes:

| Change | Pattern | Example |
| --- | --- | --- |
| Feature or enhancement | `feat/<name>` | `feat/improve-animated-tabs` |
| Bug fix | `fix/<name>` | `fix/world-map-keyboard-navigation` |
| Documentation | `docs/<name>` | `docs/clarify-registry-setup` |
| Maintenance | `chore/<name>` | `chore/update-biome-config` |

Use short, lowercase, hyphen-separated names.

## Local setup

Follow the [local development guide](README.md#local-development) to install the
workspace and configure environment variables.

```bash
pnpm install
pnpm dev:web
```

The website is available at [http://localhost:3001](http://localhost:3001).

## Making changes

Keep pull requests focused on one problem. Match the existing code style and
avoid unrelated refactors.

For component or block changes:

1. Update the source under `apps/web/src/registry`.
2. Update its example and MDX documentation when behavior or APIs change.
3. Confirm that registry dependencies, files, target paths, and metadata remain accurate.
4. Rebuild the registry so previews, displayed source, and installable artifacts stay synchronized.

```bash
pnpm registry:build
pnpm registry:validate
```

Registry outputs such as `apps/web/registry.json`,
`apps/web/src/registry/__index__.tsx`, and `apps/web/public/r/*.json` are
generated. Do not edit them manually; include the relevant generated changes
produced by the registry build.

## Quality checklist

Before opening a pull request:

- Test the change locally on desktop and mobile viewports.
- Test keyboard navigation, focus states, and screen-reader labels where relevant.
- Respect `prefers-reduced-motion` for movement-based interactions.
- Check light and dark themes when the affected interface supports both.
- Confirm that the browser console contains no new errors or warnings.
- Verify that component examples and documentation match the implementation.
- Run the relevant project checks.

```bash
pnpm check-types
pnpm check
```

For registry changes, also run:

```bash
pnpm registry:build
pnpm registry:validate
```

Run `pnpm build` when your change affects application builds, routing,
infrastructure, or shared packages.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make and verify your changes locally.
3. Push the branch to your fork and open a pull request against `main`.
4. Use a clear, descriptive title and explain what changed and why.
5. Link the related issue with `Closes #<issue-number>` when applicable.
6. Include before-and-after screenshots or videos for visual and interaction changes.
7. Call out breaking changes, new dependencies, or follow-up work explicitly.

Pull requests may be closed when they fall outside the accepted contribution
scope, contain unrelated changes, or do not meet the quality checks above.

## Review process

Maintainers may request changes to behavior, implementation, documentation, or
visual details. Keep review conversations focused and update the pull request
description when its scope changes.

All contributors and reviewers are expected to communicate respectfully and
constructively.

## Questions

If anything is unclear, open a
[GitHub issue](https://github.com/sourabhs701/tentui.com/issues) before starting
work. This is the best way to confirm whether a proposed change fits the project.

Thank you for helping make TentUI better.
