## 1. Repository Automation

- [x] 1.1 Add a GitHub Actions workflow with PostgreSQL 17, Prisma setup, lint, type checking, Vitest, Playwright, and production build verification.
- [x] 1.2 Add Dependabot configuration for npm and GitHub Actions updates.
- [x] 1.3 Declare and document Node.js 20 as the shared local, CI, and Vercel runtime.

## 2. Deployment And Environments

- [x] 2.1 Connect the GitHub repository to the existing Vercel project and verify the project association.
- [x] 2.2 Create an isolated Neon branch for non-production data.
- [x] 2.3 Configure safe Preview and Development variables without exposing values in logs or committed files.

## 3. Provider And Workshop Readiness

- [x] 3.1 Inspect Resend sender readiness and document the account-owner action needed for a real delivery test.
- [x] 3.2 Record approved values and defer unmodeled schedule/holiday/test-data requirements to a functional change without changing production records.
- [x] 3.3 Record the residual transitive `sharp` advisory and the safe upgrade condition.

## 4. Verification And Delivery

- [x] 4.1 Run OpenSpec validation, dependency audit, lint, type checking, all Vitest tests, Playwright tests, and production build.
- [ ] 4.2 Commit and push the reviewed changes, then verify GitHub Actions and Vercel production status.
