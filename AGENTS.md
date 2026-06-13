# factorio-facts

## Purpose

factorio-facts is a local TypeScript app for exploring Factorio Space Age recipe dependencies. It helps a player select an item or fluid, see which recipes make it and which recipes use it, and collect recipe instances into small planning layouts. It is not a production-ratio solver.

## Data

Factorio prototype data is the source of truth. Official docs define the schema and `data.raw` dump mechanism, but they do not publish a complete machine-readable Space Age recipe list. For reliable vanilla Space Age data, ingest a user-provided `data.raw` JSON dump from Factorio with the official Space Age-related mods enabled and unrelated community mods disabled. Treat `data.raw.recipe` as canonical.

The current UI may use vendored FactorioLab data and icons as a bootstrap source. Keep that path behind `src/factoriolab/adapter.ts` because FactorioLab uses an app-specific calculator schema, not raw `RecipePrototype`. Preserve upstream attribution and license notices, and treat Factorio-derived icon redistribution as a shipping checkpoint.

Keep imported recipes close to Factorio's `RecipePrototype` shape. Preserve fields such as `ingredients`, `results`, `category`, `enabled`, `hidden`, and `surface_conditions`; avoid flattening Space Age details that may matter for filtering by surface, planet, or crafting context.

## Model

Model dependencies as a graph, not a strict tree. Recipes can have many inputs, many outputs, alternate producers, fluids, surfaces, spoilage behavior, and recycling paths. The core questions are:

- `madeBy(itemOrFluid)`: recipes that produce the selected prototype.
- `usedIn(itemOrFluid)`: recipes that consume the selected prototype.
- `connectedRecipes(itemOrFluid)`: both directions for the selected prototype.

Steam variants are the only temperature-compatible family for now: `steam` and `steam-165` may connect as one steam material while preserving exact ids in labels and saved state. Do not merge hot/cold fluoroketone, molten fluids, or other temperature-themed fluids unless the model is deliberately expanded.

Keep ingredient/result amounts and probabilities for labels and future work, but avoid ratio calculations unless the project explicitly adds that feature.

## App Behavior

The app is a three-pane Vite/React workbench:

- Left: item selector entry point and layout management.
- Center: selected item context plus `Made by` and `Used in` recipe columns.
- Right: filters for surface, category, and recipe flags.

Layouts are ordered lists of recipe instances. Duplicate recipes are allowed. The focused layout receives new recipe instances, layout focus stems reorder layout cards, recipe row numbers reorder recipes inside a layout, and populated layouts can open a React Flow graph. The graph header toolbar lets users force and reset optional external terminals, create compatible edges between nodes, and stage shared-item edge material edits before applying them. Full graph reset requires confirmation. Graph node positions, edge endpoint sides, terminal sides, Bezier bend points, edge item overrides, and optional external terminal choices are persisted in the URL. Layout-heavy URL state uses the compact `s=v1.<blob>` codec; old `layouts=` links remain readable.

## Source Map

- `src/factorio/prototypes.ts`: Factorio prototype interfaces consumed by the app.
- `src/factorio/recipe-book.ts`: extraction and relationship indexing for `data.raw`.
- `src/factoriolab/adapter.ts`: FactorioLab-to-recipe-model bootstrap adapter.
- `src/app/`: Vite/React UI, URL state, filters, layouts, and graph dialog.
- `data/vendor/factoriolab/`: vendored FactorioLab bootstrap data and attribution.
- `DESIGN.md`: consolidated data-source, model, UI, and graph design notes.

## Tooling

- Use the user's `fnm` Node/npm setup.
- Install dependencies locally with `npm install`.
- Use local npm scripts; do not rely on global TypeScript.
- Run `npm run check` for TypeScript verification.
- Run `npm run build` for a production build.
- Run `npm run build -- --mode github-pages` to verify the GitHub Pages build
  that deploys under `/factorio-facts/`.
- Run `npm run inspect:factoriolab -- <item-id>` to inspect bootstrap recipe data.
- Do not run Factorio locally unless explicitly asked.

## Maintenance Notes

Prefer small, typed data transforms over ad hoc string parsing. When adding Factorio prototype fields, consult the official prototype docs and preserve unknown fields when practical because Factorio and Space Age data can evolve.

review and update AGENTS.md and other documentation whenever codebase changes.
