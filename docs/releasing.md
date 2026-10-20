# Releasing packages

This pnpm workspace publishes the packages under `packages/` independently. The root package is private and is never published. Repository development and releases use Node.js 22.11+ and pnpm 10; each published package keeps its own runtime engine requirements.

## Prepare a change

1. Run `pnpm changeset` and select every affected `@editable-ui/*` package.
2. Choose the version bump and describe the user-visible change. Breaking changes to the current `0.x` packages use a minor bump.
3. Commit the generated `.changeset/*.md` file with the code change.

Pull requests run type checks and the package security tests. After a changeset reaches `master`, the release workflow opens a version pull request. Review its package versions, dependency ranges, and generated changelogs, then merge it to publish.

## Enable npm trusted publishing once

Each of the ten public packages needs its own trusted publisher configured in npm because npm stores this setting per package. For every `@editable-ui/*` package, add a GitHub Actions publisher with:

- Owner: `hanifhadyan`
- Repository: `editable-ui`
- Workflow file: `release.yml`
- Permission: publish

The workflow uses GitHub OIDC and npm provenance; it does not need an `NPM_TOKEN`. The release job gets `id-token: write` only while publishing. The package must already exist on npm before its trusted publisher can be configured.

Each package publishes its build output and a package-specific README. Build and type checks run before the tarballs are created.

The repository currently has no `LICENSE` file or declared package license. Choose and add the license before the next public release.
