# Releasing packages

This pnpm workspace publishes the packages under `packages/` independently. The root package is private and is never published. Repository development and releases use Node.js 22.11+ and pnpm 10; each published package keeps its own runtime engine requirements.

## Prepare a change

1. Run `pnpm changeset` and select every affected `@editable-ui/*` package.
2. Choose the version bump and describe the user-visible change. Breaking changes to the current `0.x` packages use a minor bump.
3. Commit the generated `.changeset/*.md` file with the code change.

Pull requests run type checks and the package security tests. After a changeset reaches `master`, the release workflow opens a version pull request. Review its package versions, dependency ranges, and generated changelogs, then merge it to publish.

The version job needs the repository setting **Allow GitHub Actions to create and approve pull requests**. If it is disabled, the job pushes `changeset-release/master` but cannot open the pull request; open a PR from that branch manually. Enabling this setting also permits workflows to approve PRs.

## Bootstrap the first publish of a package

All ten package names currently in this workspace already exist on npm, so they do not need this bootstrap. npm only lets you configure a trusted publisher after a package name exists in the registry. For a future new package name, use a clean checkout of the generated `changeset-release/master` branch and publish its initial version once after the CI checks pass:

```sh
git fetch origin
git switch --detach origin/changeset-release/master
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm typecheck
npm login
corepack pnpm changeset publish
git push --tags origin
```

Run installation and all checks before logging in; log in immediately before publishing so registry credentials are not available to dependency lifecycle scripts or test code.

`changeset publish` processes every package version in the release batch, not only the new package; review all generated versions before running it. Internal dependency updates can also bump other workspace packages whose names already exist on npm, and those new versions are included in the local publish. It publishes versions that are not already on npm and skips versions already present. It honors each package's `publishConfig.access: public`, rewrites `workspace:` dependencies, and creates package git tags; the final command pushes those tags. This is a one-time local bootstrap, so the npm credential stays out of the repository and GitHub Actions secrets. The bootstrap publish does not have GitHub Actions provenance.

After the package appears on npm, configure its trusted publisher as described below. Configure every package in the release before merging the version PR. Subsequent releases use the workflow's GitHub OIDC publisher and provenance. Package names already present on npm do not need the bootstrap step.

## Enable npm trusted publishing once

Each of the ten public packages needs its own trusted publisher configured in npm because npm stores this setting per package. For every `@editable-ui/*` package, add a GitHub Actions publisher with:

- Owner: `hanifhadyan`
- Repository: `editable-ui`
- Workflow file: `release.yml`
- Permission: publish

Use npm CLI 11.15.0 or newer and an account with two-factor authentication enabled. Run one command per package from the repository root; pass its full scoped package name because npm does not infer it from the current directory. For example:

```sh
npm trust github @editable-ui/core --file release.yml --repo hanifhadyan/editable-ui --allow-publish
```

Repeat for each package. The release workflow uses GitHub OIDC and npm provenance; it does not need an `NPM_TOKEN`. The publish job gets `id-token: write` only while publishing.

Each package publishes its build output and a package-specific README. Build and type checks run before the tarballs are created.

All published packages declare the MIT license and include the repository's `LICENSE` file.
