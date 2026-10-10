# Research landing page

The public showcase served at `/`. It is self-contained: nothing outside this
folder imports from it, and it imports only `@/lib/utils` (`cn`) from the rest
of the app. Removing this folder and restoring the previous `src/app/page.tsx`
would leave the platform untouched.

## What to edit

| I want to change…                        | Edit                                     |
| ---------------------------------------- | ---------------------------------------- |
| Team names, index numbers, supervisor, university | `data/team.ts`                  |
| Component titles, capabilities, metrics, tech | `data/engines.ts`                   |
| Hero headline figures                    | `data/stats.ts`                          |
| Research contribution claims             | `data/novelty.ts`                        |
| Stack diagram nodes and data flow        | `data/architecture.ts`                   |
| Colours, shadows, keyframes              | `tailwind.config.js` (repo root of `frontend/`) |
| Landing-only CSS utilities               | end of `src/app/globals.css`             |

**`data/team.ts` ships placeholders.** Replace `Researcher One`…`Four`, the
`ITxxxxxxxx` index numbers, the supervisor names and `INSTITUTION` before this
page is shown to anyone. The `branch` values are real, read from the
repository — verify each is paired with the right person.

## Honesty conventions

Two deliberate choices, both so the page survives questioning:

1. **`maturity` on each engine.** `"live"` means the pipeline runs end to end
   in this repository. `"prototype"` means the UI and data contracts are
   complete but the model behind it is still illustrative. Component 4 is
   currently `"prototype"`: its BOQ rows are hard-coded, its OPEX curve is
   labelled illustrative in the source, and no gradient-boosting dependency is
   declared in `backend/requirements.txt`. Flip it to `"live"` once a regressor
   is wired up.

2. **`provenance` on each hero stat.** Rendered as a tooltip. Three of the four
   figures are design targets rather than measured results. When an evaluation
   run exists, replace the provenance string with the dataset and sample size.

Every capability string in `data/engines.ts` was read off the implementation
rather than the proposal; the file header lists which service each component
maps to.

## Rendering model

`src/app/page.tsx` is a server component that composes the sections. Client
boundaries are kept as small as possible:

- `LandingNav`, `Hero`, `StatsStrip`, `EngineGrid`, `EngineCard`,
  `ArchitectureFlow`, `Reveal`, `LandingScrollScope` — client.
- `EngineBento`, `ResearchNovelty`, `TeamSection`, `LandingFooter`,
  `primitives/Section`, `primitives/Badge` — server.

`EngineGrid` exists purely as a client boundary: engine records carry
`lucide-react` icon components, which are functions and cannot be passed as
props across the server/client divide, so the grid imports `ENGINES` itself and
the enclosing section stays server-rendered.

## Behaviour without JavaScript

Everything is server-rendered and readable. Two specific guards:

- `Reveal` does not apply `opacity-0` inline. The hidden state lives in
  `globals.css` under `html[data-landing="true"] [data-reveal="pending"]`, and
  that attribute is only set by `LandingScrollScope` on mount. No JS means no
  attribute, so no section is stranded invisible.
- `StatsStrip` renders the real figures until `mounted` flips, so the strip
  reads `99.2%` rather than `0%` when the count-up never runs.

## Performance

The WebGL hero (`HeroScene`) is `next/dynamic` with `ssr: false` and is only
requested at `lg` and above, and only when `prefers-reduced-motion` is
`no-preference`. Narrower or motion-sensitive viewports get a static blueprint
panel. The scene column reserves its box at every breakpoint so the hero never
reflows when the canvas arrives.

`/` builds to roughly 119 kB first-load JS, with Three.js and
`@react-three/fiber` outside that budget.

## Accessibility

- Semantic landmarks, one `h1`, sections labelled via `aria-labelledby`.
- Skip link to the research components.
- Nav exposes `aria-current`; the mobile sheet sets `aria-expanded` /
  `aria-controls`, traps background scroll and closes on `Escape`.
- The architecture diagram is operable by keyboard (each node is a button with
  focus handlers) and its hover state is mirrored in an `aria-live` caption,
  so the data flow is not conveyed by colour alone.
- All decorative SVG and glow layers are `aria-hidden`; the meaningful previews
  carry `role="img"` with a description.
- Interactive targets are at least 48 px (`min-h-touch`).
- Every decorative animation is disabled under `prefers-reduced-motion`.

## Theme tokens

`charcoal` and `gold` predate this page and are used across auth and dashboard
— **do not remove them**. The landing page adds `ink` (`#0F172A`, `ink-deep`,
`ink-light`) and `emerald-brand`. The `emerald` extension merges with
Tailwind's default emerald scale rather than replacing it, so existing
`emerald-50`…`emerald-950` usage in the dashboard is unaffected.
