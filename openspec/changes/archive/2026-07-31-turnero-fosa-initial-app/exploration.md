## Exploration: Turnero Fosa initial product build

### Current State
The project is SDD-initialized only: `openspec/`, `.atl/skill-registry.md`, and no application scaffold, package manager config, git repository, tests, linting, CI, or runtime code. The provided stack is planned context, not detected implementation.

### Affected Areas
- `openspec/config.yaml` — source for current constraints: hybrid artifacts, MVP boundaries, review budget, configurable settings, and no implementation before SDD acceptance.
- `openspec/changes/turnero-fosa-initial-app/` — active change folder for the initial app proposal, specs, design, tasks, and later verification.
- Future app boundaries — public booking portal, protected workshop panel, scheduling/domain logic, data model, auth, notifications, and visual system.

### Domain Boundaries
- **Catalog** — services, durations, active/inactive visibility, display order.
- **Workshop settings** — business identity, schedule, breaks, capacity, booking notice, booking window, cancellation policy, confirmation mode, visual/contact settings.
- **Booking availability** — computes valid time slots from settings, services, existing appointments, capacity, notice, and booking window.
- **Customers and motorcycles** — customer identity/contact plus motorcycle profile captured during booking and reused internally.
- **Appointments** — lifecycle, assigned service, requested slot, customer, motorcycle, notes, status changes, cancellation.
- **Internal operations** — protected daily agenda, appointment management, status transitions, and settings maintenance.
- **Notifications** — email confirmation/status updates via Resend; keep provider behind an adapter.

### Approaches
1. **Modular monolith in Next.js** — one Next.js app with domain modules, Prisma/PostgreSQL, Auth.js, Zod validation, server actions or route handlers, Tailwind UI.
   - Pros: fastest MVP, low deployment friction on Vercel, clear upgrade path, enough separation if domain modules stay explicit.
   - Cons: requires discipline to keep scheduling logic out of UI/server-action glue.
   - Effort: Medium

2. **API-first backend plus frontend** — separate backend service/API and a frontend app.
   - Pros: strong service boundaries, easier future mobile/third-party clients.
   - Cons: slower MVP, more infrastructure, duplicated validation/auth concerns, premature for one workshop surface.
   - Effort: High

3. **No-code/headless scheduler integration** — compose booking flow around an existing scheduler.
   - Pros: fastest demo path.
   - Cons: weaker control over motorcycle/workshop-specific rules, configurability, internal workflow, and future domain ownership.
   - Effort: Low initially, High when customizing

### Recommendation
Use the **modular monolith in Next.js** for the MVP. Treat scheduling as a domain service with tests, not as page-level logic. Store all Taller Express values as seed/test data or configurable records, never as product constants.

Recommended initial phases:
1. **Foundation** — scaffold Next.js/TypeScript, Tailwind, Prisma, PostgreSQL, Auth.js, Zod, test tooling, formatting/linting.
2. **Domain core** — model settings, services, customers, motorcycles, appointments, status lifecycle, and availability calculation.
3. **Public booking** — service selection, slot availability, customer/motorcycle capture, manual-confirmation appointment creation, cancellation flow.
4. **Internal panel** — protected login, daily appointment view, status changes, appointment details, basic settings/catalog management.
5. **Operational polish** — email notifications, empty/error states, responsive dark/apple-green UI, deployment configuration.

### MVP Risks
- Availability logic can become the product's hardest invariant; it must be isolated and tested early.
- Race conditions can overbook capacity when two users book the same slot; design should use database constraints/transactions or equivalent safeguards.
- Auth and internal/public boundaries must be explicit before implementation to avoid leaking protected operations.
- Settings configurability can be lost if defaults are hardcoded during scaffold/demo work.
- Initial build will likely exceed the 800-line review budget; tasks should forecast chained review slices.
- Email/DB provider choices should remain replaceable until deployment constraints are confirmed.

### Ready for Proposal
Yes. The next proposal should define the `turnero-fosa-initial-app` change as a phased MVP build, explicitly excluding payments, WhatsApp automation, reports, full mechanical history, multi-branch, inventory, and online rescheduling.
