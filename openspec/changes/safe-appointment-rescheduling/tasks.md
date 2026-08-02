## 0. Change preparation

- [x] 0.1 Accept proposal, specifications, design, and MVP boundaries.
- [x] 0.2 Archive the completed `extend-appointment-duration` change after synchronizing its accepted behavior into base specs.
- [x] 0.3 Split implementation if the forecast exceeds the 800-line review budget.

## 1. Shared scheduling policy — RED/GREEN

- [x] 1.1 Add failing unit tests for service minimum, slot-step alignment, closed holiday, exceptional opening, outside hours, break overlap, local day boundary, capacity exhaustion, back-to-back intervals, and non-capacity statuses.
- [x] 1.2 Add failing tests proving the edited appointment is excluded from capacity and that both shortening and extension validate the full resulting interval.
- [x] 1.3 Extract the shared interval validator and retain separate public notice/window policy.
- [x] 1.4 Refactor public availability to use the shared low-level rules without changing public behavior.

## 2. Atomic persistence and audit — RED/GREEN

- [x] 2.1 Add a Prisma migration and model for appointment interval history.
- [x] 2.2 Extend repository contracts to load target-date occupancy and update appointment plus history in one transaction.
- [x] 2.3 Revalidate under the capacity lock immediately before writing.
- [x] 2.4 Add integration tests for rollback on rejection and concurrent final-capacity edits.

## 3. Protected action and UI — RED/GREEN

- [x] 3.1 Replace the extend-only action with a typed reschedule action accepting appointment ID, date, start time, total duration, and optional reason.
- [x] 3.2 Add an availability-preview action for eligible start times based on proposed date and duration.
- [x] 3.3 Replace the drawer duration form with date, available start time, duration, reason, and explicit final-interval summary.
- [x] 3.4 Show precise rejection feedback and keep the original interval visible after failure.
- [x] 3.5 Disable editing for terminal appointments and verify keyboard/mobile usability.

## 4. History and notifications — RED/GREEN

- [x] 4.1 Show interval history with operator and reason in the appointment detail.
- [x] 4.2 Send reschedule/duration-change email only after a successful commit and log delivery outcome.
- [x] 4.3 Add tests proving rejected edits create neither history nor notification.

## 5. Verification and rollout

- [x] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`.
- [ ] 5.2 Apply migration and deploy to `preview`.
- [ ] 5.3 Complete desktop/mobile acceptance for move, shorten, extend, holiday, break, terminal status, and concurrent conflict scenarios.
- [ ] 5.4 Promote the exact verified commit to `main` and monitor application/email logs.
