# factorio-facts

## Goal

factorio-facts is a TypeScript tool for exploring Factorio Space Age recipe dependencies. The primary workflow is selecting an item or fluid and seeing which recipes produce it and which recipes consume it, so a player can reason about factory layout without needing production ratios or optimizer-style calculations.

## Data Strategy

Use Factorio's own prototype data as the source of truth. Official online docs define the prototype schema and document the `data.raw` dump mechanism; they do not provide a complete machine-readable Space Age recipe list. For vanilla Space Age, recipes should come from a user-provided `data.raw` JSON dump produced by Factorio with the official Space Age-related mods enabled and unrelated community mods disabled. Treat `data.raw.recipe` as the canonical recipe collection.

FactorioLab data and icons may be used as a bootstrap source for the first UI and illustration pass. Keep this behind an adapter because FactorioLab uses an app-specific calculator schema rather than raw `RecipePrototype`. If vendoring FactorioLab files, include the upstream MIT license notice and preserve a clear source/attribution record. Treat Factorio-derived icons as a public-distribution licensing checkpoint before shipping.

Keep imported recipes close to Factorio's `RecipePrototype` shape. Preserve fields such as `ingredients`, `results`, `category`, `enabled`, `hidden`, and `surface_conditions`; do not flatten away Space Age details that may become useful for filtering by planet, surface property, or crafting context.

## Implementation Strategy

Model recipe relationships as a graph, not a strict tree. A recipe can have many inputs and many outputs, and the same item can be produced or consumed by multiple recipes. The first useful graph layer should answer:

- `madeBy(itemOrFluid)`: recipes that produce the selected item or fluid.
- `usedIn(itemOrFluid)`: recipes that consume the selected item or fluid.
- `connectedRecipes(itemOrFluid)`: both directions for the selected prototype.

Avoid ratio calculations in the first version. Keep amounts and probabilities in the model for labels and future work, but optimize the first UI for clarity, searching, filtering, and expansion.

## Source Layout

- `src/factorio/prototypes.ts`: TypeScript interfaces for the Factorio recipe prototype subset we consume.
- `src/factorio/recipe-book.ts`: Helpers for extracting recipes from a `data.raw` dump and indexing item/fluid relationships.
- `src/factoriolab/adapter.ts`: Adapter from vendored FactorioLab Space Age data into the graph-ready recipe model.
- `src/app/`: Vite/React recipe explorer UI.
- `data/vendor/factoriolab/`: Vendored FactorioLab bootstrap data and upstream attribution.
- `docs/data-source.md`: Notes on obtaining reliable recipe data.
- `docs/ui-ux.md`: Current UI/UX design notes.

## Tooling

- Use the user's `fnm` Node/npm setup.
- Install dependencies locally in this repo with `npm install`.
- Use local npm scripts; do not rely on global TypeScript.
- Verify TypeScript with `npm run check`.
- Build the app with `npm run build`.
- Inspect bootstrap recipes with `npm run inspect:factoriolab -- <item-id>`.
- Do not run Factorio locally unless explicitly asked.

## Working Notes

Prefer small, typed data transforms over ad hoc string parsing. When adding fields from Factorio prototypes, consult the official prototype docs and keep unknown fields preserved when practical, because Factorio and Space Age data evolves over time.
