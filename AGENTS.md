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
- Installed: installed layout snapshots appear as composite recipes that can be added to the focused layout, opened through their boundary item context, and unloaded only when no layout or installed snapshot references them.
- Layouts: global layout rows focus, reorder, and open fullscreen layout recipe editing or graph views for layouts; the layout editor itself only edits the focused layout.
- Graph: fullscreen React Flow layout graph editing for the selected layout, entered from a layout row or the focused layout editor.

Layouts are ordered lists of recipe instances. Duplicate recipes are allowed. Each recipe instance has a positive production size number plus optional selected producing machine, machine modules, and beacons saved as intent but not yet used for ratio solving. The focused layout receives new recipe instances, the global sidebar reorders layouts, and the layout editor reorders recipe rows. Unnamed layouts use an inferred display name when exactly one visible composite icon maps to one external output product; otherwise they fall back to the neutral untitled label. The layout editor is a focused-layout document view: it renames the current layout, shows the graph-derived composite recipe boundary, edits recipe instance order, selected machines, production sizes, modules, and beacons, installs populated layouts as immutable composite recipe snapshots, and shows an in-place recipe inspector when a row is selected. Double-clicking a layout recipe identity opens its recipe context in the Recipes view, while single-clicking keeps the in-place inspector workflow. Module and beacon editor rows should use icon dropdowns first, then numeric counts; counts may be blank while editing and `0` is a valid saved value. The compact module/beacon summary in a recipe row should select that row and move browser focus to the inspector because it is a direct factory-settings entry point. Recipe rows should not jump to the recipe browser on ordinary selection; use double-click or an explicit inspector action for that context switch. Layout recipe rows should show a leading row number reorder affordance, recipe identity, craft time, selected machine, compact module/beacon summaries, production multiplier with `×`, and remove without category pills; composite recipe rows leave craft time, machine, modules, and beacons blank. Composite recipe icons are inferred from one to four external outputs, rendered as a fitted multi-icon stack, and used directly as the leading layout-sidebar icon and composite recipe icon. Populated layouts can open the fullscreen React Flow graph view. Empty layouts can import pasted factorio-facts layout JSON strings, while graph views can export the open layout as a copyable JSON string. Graphs contain recipe nodes plus circular relay nodes that identity-route selected item/fluid sets; both are first-class selectable/connectable graph nodes sharing a common node data contract. Adding a recipe to a populated layout saves empty edge overrides for compatible edges touching the new recipe entry so it must be linked manually. The graph header title mirrors the layout editor header with the composite icon, inferred title, boundary summary, and recipe count, and the header keeps a stable layout-editor-height row even when no contextual toolbar is active. The graph header toolbar lets users smart-link focused nodes, create compatible edges, create relays from focused external input/output terminals, and stage node terminals, relay contents, and edge materials before applying them; map terminal clusters only focus terminal sets and expose side-docking targets. Focusing a node highlights active incoming edges and adjacent provider nodes with external-input green and active outgoing edges and adjacent consumer nodes with external-output gold. Smart link enables compatible incoming and outgoing edges for a focused recipe node and compatible outgoing edges for a focused relay node, and hovering or keyboard-focusing the Smart link button previews those flows without changing graph state using external-input green for flows that feed the focused node and external-output gold for flows that leave the focused node, while terminal chips keep their own input/output terminal colors. Turning selected edges into a relay inserts the relay into those exact flows with source-to-relay and relay-to-target edges while leaving unrelated compatible egresses opt-in. The graph canvas shows a compact shortcut strip next to the bottom-left view controls for hard-to-discover Shift-only node and edge selection accelerators. The graph action row has export, per-layout undo/redo, guarded reset, and a close/back control. Graph undo/redo snapshots must contain only graph-owned state and must not snapshot full layout recipe entries. The graph viewport auto-fits once when opening a graph view, then remains user-owned: do not automatically fit, center, pan, or zoom it when graph content or state changes. Layout recipe ids, installed composite snapshots, production sizes, selected machines, module/beacon settings, graph node positions, relay material sets, edge endpoint sides, terminal sides, Bezier bend points, edge item overrides, and optional external terminal choices are persisted in the URL. Layout-heavy URL state uses the compact `s=v1.<blob>` codec; old `layouts=` links remain readable.

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
