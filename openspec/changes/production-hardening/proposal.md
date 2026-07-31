## Why

The production MVP is live, but quality checks, Git-based deployments, non-production environments, provider verification, and runtime version alignment are not yet consistently automated. Hardening these operational paths reduces deployment risk without changing booking behavior or MVP boundaries.

## What Changes

- Add GitHub Actions coverage for PostgreSQL integration tests, Playwright, lint, type checking, and production builds.
- Connect the GitHub repository to Vercel and verify automatic deployment configuration.
- Establish safe Preview and Development environment configuration without copying production secrets into the repository.
- Verify Resend sender readiness and document any account-level action still required.
- Confirm which workshop policy values remain placeholders before changing production data.
- Align the supported Node.js version across local development, CI, and Vercel.
- Track the residual transitive `sharp` advisory until Next.js supports the patched release.

## Capabilities

### New Capabilities

None. This is an infrastructure and operational hardening change.

### Modified Capabilities

None. Existing application behavior and requirements remain unchanged.

## Impact

Affected areas are repository automation, package metadata, Vercel project configuration, Neon non-production resources, Resend account configuration, and operational documentation. No data model, authentication flow, scheduling invariant, or production workshop record will be changed without explicit values and a rollback path.
