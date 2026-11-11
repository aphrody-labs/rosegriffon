# Historical NIE release tooling

These retained scripts document the former standalone NIE deployment pipeline.
They are outside the active IECODE Bun gate and release entry points. They retain
old Infra checkout and frontend assumptions and must not be used for a current
release. Their accompanying test is a historical reference, not a root test gate.

Current release and host operations belong to Aphrody's `@aphrody/workspace`
under the sibling Aphrody checkout. The local thin operations adapter is
[`scripts/tools/aphrody-ops.ts`](../../tools/aphrody-ops.ts).

Source history remains available in Git; these files preserve deployment recovery
and artifact provenance details without maintaining a competing orchestrator.

The retained e2e-site harness requires the former absent `apps/nie-web` frontend and is not a current IECODE acceptance gate.
