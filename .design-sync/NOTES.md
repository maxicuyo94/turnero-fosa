# design-sync notes — turnero-fosa

This repo is a Next.js app, not a published component library. The design system
was extracted from the app's own screens into `src/components/ui/` and is built
for syncing by a dedicated `pnpm ds:build`. The app imports the same components,
so the DS and the product cannot drift.

## Setup gotchas (in the order they bite)

- **`package.json` needs `"types": "./ds-dist/index.d.ts"`.** The converter finds
  components through `findTypesRoot`, which only probes `build/ts`, `dist/types`,
  `types`, `lib`, `dist` — it does not know about `ds-dist`. Without that field
  the build reports `[ZERO_MATCH] no component exports` and emits a tokens-only
  bundle. `--entry` does not help; it only points at the JS.
- **esbuild's postinstall is blocked by npm's allow-scripts.** After
  `npm i` in `.ds-sync/`, run `npm approve-scripts esbuild` or the native binary
  is missing.
- **`playwright` must be installed into `.ds-sync/`, pinned to the version that
  matches the cached chromium.** The repo depends on `@playwright/test` only, and
  pnpm does not hoist `playwright` to `node_modules/`, so the render check cannot
  import it. The machine cache holds `chromium-1228`, which playwright **1.61.1**
  pins — install exactly that: `npm i --ignore-scripts playwright@1.61.1`.
  (`node_modules/.pnpm/playwright-core@<v>/node_modules/playwright-core/browsers.json`
  is where the pinned revision is readable.)
- **Windows throws a transient `EPERM` when the converter clears `ds-bundle/`.**
  It is a file-handle race, not a real permission problem. Re-run the same
  command; it succeeds.

## CSS: two rules that are easy to break

- **`src/components/ui/base.css` must not set a background on `html`.** Preview
  cards set `body{background:#fff}` inline, which wins. If `html` also has a
  background, body's background stops propagating to the canvas and every card
  renders as a small white strip over a full-viewport black block. The app-only
  `html { background }` (for over-scroll) lives in `app/globals.css` instead.
- **The `@source inline(...)` safelist in `ds.css` is load-bearing.** Scanning
  alone compiles only the ~190 utilities the product happens to use today, so
  anything the design agent composes (`gap-6`, `mt-10`, `grid-cols-3`) would not
  resolve. The safelist raises that to ~2,710 classes and the stylesheet to
  ~227 KB (measured 2026-08-01; an earlier note said ~272 KB — that figure was
  wrong, not a regression). If you narrow it, narrow the spacing scale, not the
  colour ramps.

## Preview conventions

- **Every preview wraps its story in a local `Surface`** (`bg-charcoal-950`).
  This DS is dark-only; on the card's white body the `ghost` Button and all
  `text-white` content are invisible. `SiteHeader` is the one exception — it
  paints its own bar.
- **`PageShell` needs the surface explicitly.** It is a layout container only
  (column width and gutters, no background), so its stories render invisible
  headings without a wrapper. This was caught in grading, not by the render check.
- `cfg.overrides` sets `cardMode: "column"` for Alert, AppointmentCard, Field,
  SiteHeader and StatusBadge — their compositions are wider than a grid cell.

## Known render warns

None. The final validate run exits 0 with zero warnings; 19/19 previews render
cleanly and no component ships the floor card. Any warn on a future run is new.

## Re-sync risks

- **The library is app-coupled by design.** `src/components/ui/` has no Next
  imports (that is enforced only by convention — `SiteHeader`/`RouteCard` take a
  `linkComponent` prop instead). If someone adds `next/link`, `next/image` or a
  server action inside `src/components/ui/`, the bundle still builds but the
  component breaks in the design runtime. Check for it after any UI change.
- **`ds-dist/` is generated and gitignored.** A fresh clone must run
  `pnpm ds:build` before the converter, or `findTypesRoot` sees nothing.
- **Tests do not cover the design system's appearance.** `pnpm test` passes 45/45
  but two `*-prisma.test.ts` files fail without a `.env` — that is pre-existing
  and unrelated to the UI. Do not read it as a regression.
- **Grades are keyed to the authored `.tsx` files AND to the component source.**
  Under `keyRecipe: 7` the source key mixes a global slice (config + stylesheet)
  with each component's own `srcSha`, so a change anywhere in
  `src/components/ui/` — even a two-line edit to one file — re-keys **all 19**
  and clears every grade. Expect a full re-grade after any UI commit; it is not
  a nondeterminism bug. (An earlier note claimed component edits do not clear
  grades — that was wrong.)
- **The generated `.d.ts` drops native HTML attributes.** `Button`, `TextInput`,
  `Select` and `Textarea` extend `ButtonHTMLAttributes` / `InputHTMLAttributes` /
  `SelectHTMLAttributes` / `TextareaHTMLAttributes` and spread `...rest`, but the
  extractor filters React DOM props, so `type`, `name`, `required`, `value` and
  `onChange` never reach `<Name>Props`. That filtering is deliberate (it keeps
  the DS pane's contract readable); `conventions.md` carries the paragraph that
  tells the design agent those four take native attributes anyway. If the set of
  components extending native attribute types changes, update that paragraph.
- `.design-sync/conventions.md` is human-editable and belongs to its authors.
  Re-validate its class and component names against the fresh build each sync;
  never rewrite it wholesale.
