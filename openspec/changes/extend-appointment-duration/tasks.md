## 1. Public Effective Duration

- [ ] 1.1 Add failing domain tests for default duration, valid longer duration, below-default rejection, and slot-step rejection.
- [ ] 1.2 Pass effective duration through public page/query/form state and recalculate slots for the complete interval.
- [ ] 1.3 Revalidate and persist the effective interval in the booking transaction.

## 2. Internal Appointment Extension

- [ ] 2.1 Add failing domain tests for successful extension, shortening rejection, terminal-status rejection, and day-boundary validation.
- [ ] 2.2 Add the protected server action and repository update that preserve `startAt` and extend `endAt`.
- [ ] 2.3 Add an agenda duration control showing the current total and service default.

## 3. Verification

- [ ] 3.1 Add/update component and Prisma integration coverage for effective duration persistence and UI controls.
- [ ] 3.2 Run strict OpenSpec validation, type checking, lint, Vitest, Playwright, and the production build.
- [ ] 3.3 Confirm the implementation remains within the 800-line review budget or split the change before delivery.
