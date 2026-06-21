# factorio-facts

## Purpose

factorio-facts is a local TypeScript app for exploring Factorio Space Age recipe dependencies. It helps a player select an item or fluid, see which recipes make it and which recipes use it, and collect recipe instances into small planning layouts. It is not a production-ratio solver.

## Data

Factorio prototype data is the source of truth. Official docs define the schema and `data.raw` dump mechanism, but they do not publish a complete machine-readable Space Age recipe list. For reliable vanilla Space Age data, ingest a user-provided `data.raw` JSON dump from Factorio with the official Space Age-related mods enabled and unrelated community mods disabled. Treat `data.raw.recipe` as canonical.

The current UI may use vendored FactorioLab data and icons as a bootstrap source. Keep that path behind `src/factoriolab/adapter.ts` because FactorioLab uses an app-specific calculator schema, not raw `RecipePrototype`. Preserve upstream attribution and license notices, and treat Factorio-derived icon redistribution as a shipping checkpoint.

Keep imported recipes close to Factorio's `RecipePrototype` shape. Preserve fields such as `ingredients`, `results`, `main_product`, `icon`, `icons`, `icon_size`, `category`, `enabled`, `hidden`, and `surface_conditions`; avoid flattening Space Age details that may matter for filtering by surface, planet, icon display, or crafting context.

Resolve displayed recipe icons through a shared helper: explicit recipe icon first, then recipe-id atlas icons such as FactorioLab recycling sprites, then `main_product` or singular-result fallback, then first result.

## Model

Model dependencies as a graph, not a strict tree. Recipes can have many inputs, many outputs, alternate producers, fluids, surfaces, spoilage behavior, and recycling paths. The core questions are:

- `madeBy(itemOrFluid)`: recipes that produce the selected prototype.
- `usedIn(itemOrFluid)`: recipes that consume the selected prototype.
- `connectedRecipes(itemOrFluid)`: both directions for the selected prototype.

Steam variants are the only temperature-compatible family for now: `steam` and `steam-165` may connect as one steam material while preserving exact ids in labels and saved state. Do not merge hot/cold fluoroketone, molten fluids, or other temperature-themed fluids unless the model is deliberately expanded.

Keep ingredient/result amounts and probabilities for labels and future work, but avoid ratio calculations unless the project explicitly adds that feature.

## App Behavior

The app is a mode-based Vite/React workbench with a persistent left sidebar. Sidebar section headers are labels, and the controls under each section manage the current focus and main lens:

- Recipes: the section shows only the focused item/fluid; clicking it opens the recipe explorer, while the picker button opens item selection.
- Layouts: global layout rows focus, reorder, and open fullscreen layout recipe editing or graph views for layouts; the layout editor itself only edits the focused layout.
- Graph: fullscreen React Flow layout graph editing for the selected layout, entered from a layout row or the focused layout editor.

Layouts are ordered lists of recipe instances. Duplicate recipes are allowed. Each recipe instance has a positive production size number that is saved but not yet used for ratio solving. The focused layout receives new recipe instances, the global sidebar reorders layouts, and the layout editor reorders recipe rows. The layout editor is a focused-layout document view: it renames the current layout, edits recipe instance order and production sizes, and shows an in-place recipe inspector when a row is selected. Recipe rows should not jump to the recipe browser; use an explicit inspector action for that context switch. Populated layouts can open the fullscreen React Flow graph view. Empty layouts can import pasted factorio-facts layout JSON strings, while graph views can export the open layout as a copyable JSON string. Graphs contain recipe nodes plus circular relay nodes that identity-route selected item/fluid sets; both are first-class selectable/connectable graph nodes. The graph header toolbar lets users create compatible edges, create conservative relays from terminals or selected edges, smart-merge focused relays, and stage node terminals, relay contents, and edge materials before applying them. The graph action row has export, per-layout undo/redo, guarded reset, and a close/back control. Graph node positions, relay material sets, edge endpoint sides, terminal sides, Bezier bend points, edge item overrides, and optional external terminal choices are persisted in the URL. Layout-heavy URL state uses the compact `s=v1.<blob>` codec; old `layouts=` links remain readable.

## Source Map

- `src/factorio/prototypes.ts`: Factorio prototype interfaces consumed by the app.
- `src/factorio/recipe-book.ts`: extraction and relationship indexing for `data.raw`.
- `src/factoriolab/adapter.ts`: FactorioLab-to-recipe-model bootstrap adapter.
- `src/app/`: Vite/React UI, URL state, filters, layouts, and graph workspace.
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
