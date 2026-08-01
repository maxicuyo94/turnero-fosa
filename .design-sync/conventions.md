# Taller Express — how to build with this design system

A dark-only design system for a motorcycle-workshop booking product (Spanish,
es-AR). 19 React components on `window.TurneroFosaUI`, styled with a Tailwind v4
preset. The look is charcoal surfaces, a single lime accent, and very heavy
tight-tracked headings.

## Setup: nothing to wrap

There is **no provider, no theme context, no registration step**. Every component
is a plain function — import it and render it. Do not invent a `ThemeProvider`.

Two things the surface depends on:

- **The page must sit on the dark surface.** `styles.css` sets `color-scheme: dark`
  and paints `body` with the charcoal gradient. Text colours assume it — a
  component placed on a white background renders white-on-white and disappears.
  When you need a dark panel inside an otherwise light container, use
  `bg-charcoal-950`.
- **Links.** `SiteHeader` and `RouteCard` render `<a>` by default. In a router
  context pass `linkComponent={Link}`; the component takes it as a prop rather
  than importing any framework.

## Styling idiom: Tailwind utilities, brand palette

Compose layout with normal Tailwind utilities. Colour comes from two custom
families plus the neutral ramp — stay inside them and the result is on-brand.

| Family | Values | Use for |
|---|---|---|
| `apple-300` `apple-400` `apple-500` | lime `#b8ff58` `#8ee000` `#73bd00` | the single accent: primary buttons, eyebrows, active states, links |
| `charcoal-800` `charcoal-900` `charcoal-950` | near-black greens | page and panel surfaces |
| `zinc-100`…`zinc-950` | neutrals | body copy (`text-zinc-300`), muted copy (`text-zinc-500`) |
| `red-200`…`red-500` | destructive | cancellation, errors |

Signature patterns worth copying verbatim:

- **Panel surface**: `border border-white/10 bg-white/[0.04]` — a translucent
  white lift over charcoal, never a solid grey. `Card` already does this.
- **Page title**: `font-black tracking-[-0.05em] text-white` at `text-5xl`.
- **Eyebrow**: `text-xs font-semibold uppercase tracking-[0.55em] text-apple-300`.
  The extreme letter-spacing is the brand signature — keep it.
- **Monospace code**: `font-mono tracking-[0.16em]` for appointment codes.

Prefer a component over re-creating its markup: reach for `Card` before writing
`rounded-[1.7rem] border …`, and `PageHeading` before an eyebrow + `h1` pair.
`cn(...)` is exported for conditional class strings.

## The components

`PageShell` `PageHeading` `SiteHeader` `Card` `Button` `Field` `TextInput`
`Select` `Textarea` `Alert` `Chip` `StatusBadge` `EmptyState` `SlotOption`
`Toggle` `CodeDisplay` `DetailList` `AppointmentCard` `RouteCard`

`PageShell` is the page container (column width + gutters, paints no background);
`PageHeading` opens every screen; `Card` is the section panel. `StatusBadge`
takes one of the six appointment states and renders its Spanish label.

**`Button`, `TextInput`, `Select` and `Textarea` also accept every native
attribute of the element they render** (`type`, `name`, `required`, `value`,
`onChange`, `disabled`, `placeholder`, …) and forward it — their props extend
`ButtonHTMLAttributes` / `InputHTMLAttributes` / `SelectHTMLAttributes` /
`TextareaHTMLAttributes`. The generated `.d.ts` lists only the design-system
props, so use native attributes freely on those four even though they are not
enumerated there.

## Where the truth lives

Read `_ds/<folder>/styles.css` and the `_ds_bundle.css` it imports for the exact
compiled utilities and token values, and each component's `.prompt.md` and
`.d.ts` for its real props. Those files are authoritative; this page is a summary.

## An idiomatic screen

```jsx
<>
  <SiteHeader active="booking" />
  <PageShell>
    <PageHeading eyebrow="Turnos online" title="Reservar turno" />
    <Card className="mt-8">
      <h2 className="text-2xl font-black text-white">Datos para el turno</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Nombre y apellido">
          <TextInput name="fullName" required />
        </Field>
        <Field label="Telefono">
          <TextInput name="phone" required />
        </Field>
      </div>
      <Button className="mt-6" size="md" type="submit">Solicitar turno</Button>
    </Card>
  </PageShell>
</>
```
