## 1. Data And Domain

- [ ] 1.1 Add a Prisma date-exception model and migration with source/manual-override metadata.
- [ ] 1.2 Extend availability tests and logic so date exceptions precede weekly schedules.
- [ ] 1.3 Add repository coverage for transactional weekly schedules, breaks, and exceptions.

## 2. Internal Maintenance

- [ ] 2.1 Add validation and authenticated actions for complete weekly schedule and break updates.
- [ ] 2.2 Add internal UI controls for weekly schedules and date exceptions.
- [ ] 2.3 Add a validated ArgentinaDatos importer that preserves manual overrides and handles provider failure.

## 3. Test Data

- [ ] 3.1 Add explicit environment guards and an idempotent development test-data profile.
- [ ] 3.2 Add commands and documentation for loading the profile into Docker and Neon non-production only.
- [ ] 3.3 Test repeated profile loading and production refusal.

## 4. Verification

- [ ] 4.1 Run migrations and the quality suite against Docker PostgreSQL.
- [ ] 4.2 Verify imported holidays and manual overrides in Vercel Preview before production rollout.
