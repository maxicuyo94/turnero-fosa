## Context

See `proposal.md` for motivation. Production runs on Vercel with a Neon PostgreSQL database, while local integration and E2E tests use PostgreSQL 17 through Docker Compose. Vercel production variables are sensitive and cannot be exported, so non-production environments must not depend on copying them.

## Goals / Non-Goals

**Goals:**

- Make every pushed change verifiable on a clean GitHub runner.
- Keep production, preview, CI, and local data isolated.
- Use one supported Node.js line across local development, CI, and Vercel.
- Make provider and security follow-ups visible and repeatable.

**Non-Goals:**

- Changing the Prisma schema, authentication behavior, scheduling invariants, or production workshop records.
- Storing provider credentials in GitHub, OpenSpec, logs, or committed environment files.
- Forcing an unsupported `sharp` release into Next.js.

## Decisions

### CI uses an ephemeral PostgreSQL service

GitHub Actions will run PostgreSQL 17 as a service, apply the existing Prisma schema, seed a deterministic CI admin, run all Vitest and Playwright tests, and build with non-production values. This reproduces the verified Docker workflow without accessing Neon.

### Vercel remains the deployment authority

The GitHub repository will be connected directly to the existing Vercel project. Vercel will build production from `main` and previews from other branches; GitHub Actions remains an independent quality gate.

### Environment data stays isolated

Preview and Development should use a non-production Neon branch and independently generated auth/admin credentials. Production sensitive values will not be downloaded or copied. Resend credentials and sender identity require account-owner confirmation.

### Node.js 24 is the common baseline

The repository will declare Node.js `24.x`, matching Vercel's current LTS runtime and avoiding the announced October 2026 retirement of Node 20 deployments. CI and local development will use the pinned Node 24 release.

### Residual advisories are monitored, not overridden unsafely

Dependabot will track npm and GitHub Actions updates. CI will report production audit results, while the known `sharp` advisory remains documented until Next.js accepts `sharp >=0.35.0`.

## Risks / Trade-offs

- GitHub/Vercel connection may require an account-level authorization -> use the authenticated Vercel CLI and stop for explicit authorization if requested.
- Preview email could contact real customers -> keep delivery disabled until a dedicated Resend key/sender is confirmed.
- A generated preview admin password can be lost -> set it once through Vercel and record it only in the user's password manager.
- CI E2E increases runtime -> use one Chromium worker and cache pnpm/browser downloads where supported.
- Node runtimes eventually reach end of support -> Dependabot and scheduled maintenance should move all environments together.

## Migration Plan

1. Add CI, Dependabot, Node metadata, and documentation; validate locally with Docker.
2. Connect GitHub to the existing Vercel project.
3. Create isolated non-production database resources before adding Preview/Development variables.
4. Commit and push the hardening changes; verify CI and Vercel deployment status.
5. Roll back repository changes with a normal revert commit; disconnect Git or remove only non-production variables if provider configuration causes issues.

## Open Questions

- The workshop requested editable weekly schedules, Argentine holiday handling, and safe test-data profiles. These alter application behavior and belong in a separate functional change.
- Phone, pricing, and deposit fields are not yet modeled and remain deferred to that functional change.

## Confirmed Operational Decisions

- Keep capacity at two simultaneous motorcycles.
- Keep automatic confirmation, two-hour minimum notice, a 30-day booking window, and online cancellation/rescheduling disabled.
- Keep real email delivery disabled outside production; production Resend verification remains blocked until the workshop has a domain.
