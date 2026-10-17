# Changesets

Run `bun run changeset` to describe a change to one or more `@rosegriffon/*`
packages. On `main`, the release workflow opens a "Version packages" pull request;
merging it publishes every public package whose version is not yet on npm.
