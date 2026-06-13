# factorio-facts Design

factorio-facts is a local TypeScript app for exploring Factorio Space Age recipe dependencies. It helps a player select an item or fluid, inspect recipes that produce or consume it, and collect recipe instances into small planning layouts. It is a relationship workbench, not a production-ratio solver.

## Data Source

The reliable source for Space Age recipes is Factorio prototype data after prototype loading, not a wiki scrape or hand-maintained recipe list. Official online docs define the schema and extraction method, but they do not publish a complete machine-readable Space Age recipe database.

Use official docs for prototype shape:

- Recipes are `RecipePrototype` entries.
- Recipe inputs use `IngredientPrototype`, a union of item and fluid ingredients.
- Recipe outputs use `ProductPrototype`, a union of item and fluid products.
- Space Age recipes may use `SurfaceCondition`.

When a full recipe corpus is needed, ingest a user-provided dump made from Factorio with the official Space Age-related mods enabled and unrelated community mods disabled:

```sh
factorio --dump-data
```

Factorio documents `--dump-data` as dumping `data.raw` as JSON to the script output folder and exiting. The canonical recipe collection is:

```text
data.raw.recipe
```

Codex should not run Factorio locally for this project unless explicitly asked. The dump should be supplied by the user or generated outside this workflow from the same Factorio version the player is using, with official expansion-related mods such as `space-age`, `quality`, and `elevated-rails` enabled as appropriate for that install.

Store local dumps outside git or under an ignored data directory, then point an importer at the JSON file. A suggested local path is:

```text
data/raw/data.raw.json
```

Treat generated or imported recipe JSON as rebuildable data unless the project deliberately adds a tiny fixture for tests.

## FactorioLab Bootstrap Data

FactorioLab can be used as a practical bootstrap source for the first viewer. Its repository contains Space Age data and icon assets under:

```text
public/data/spa/data.json
public/data/spa/icons.webp
```

Use these through a dedicated adapter, not as the internal canonical model. FactorioLab data is optimized for a calculator and may omit, transform, or synthesize recipe details differently than raw Factorio `RecipePrototype` data. The full-fidelity import path should remain `data.raw.recipe`.

If FactorioLab data or icons are vendored into this repository, include the FactorioLab MIT license notice and keep the upstream source URL in the import metadata. Icons are visually derived from Factorio game assets; keep them acceptable for local development and illustration, but do a licensing review before public distribution.

The current vendored bootstrap data is stored under:

```text
data/vendor/factoriolab/spa/data.json
data/vendor/factoriolab/spa/defaults.json
data/vendor/factoriolab/spa/hash.json
data/vendor/factoriolab/spa/icons.webp
```

The local inspector can verify counts and show first-order recipe relationships:

```sh
npm run inspect:factoriolab -- iron-plate
```

At the time of import, the Space Age dataset reports Factorio `2.0.77` for `base`, `elevated-rails`, `quality`, and `space-age`, with 578 items, 902 recipes, 901 icon atlas entries, and 6 locations.

## Data Model

Keep imported recipes close to Factorio's `RecipePrototype` shape. Preserve fields such as `ingredients`, `results`, `category`, `enabled`, `hidden`, and `surface_conditions`; avoid flattening Space Age details that may matter for filtering by surface, planet, or crafting context.

Model dependencies as a graph, not a strict tree. Recipes can have many inputs, many outputs, alternate producers, fluids, surfaces, spoilage behavior, and recycling paths. The core questions are:

- `madeBy(itemOrFluid)`: recipes that produce the selected prototype.
- `usedIn(itemOrFluid)`: recipes that consume the selected prototype.
- `connectedRecipes(itemOrFluid)`: both directions for the selected prototype.

Keep ingredient/result amounts and probabilities for labels and future work, but avoid ratio calculations unless the project explicitly adds that feature.

## Product Shape

The first screen is the working tool, not a landing page. The app uses a three-pane Vite/React workbench:

- Left: item selector entry point plus layout management.
- Center: selected item context plus `Made by` and `Used in` recipe columns. The column headings and header counters use different direction icons so producers and consumers are visually distinct.
- Right: filters for surface, FactorioLab category, and recipe flags.

Clicking any item chip selects that item and refreshes both recipe columns. This gives expandable upstream/downstream navigation without expanding a dense node cloud in place.

Search scores exact id/name matches first, prefix matches second, then token containment. Prototype ids stay visible because Factorio players often know ids from mods, command output, or calculators.

Popups use a shared header pattern with close and fullscreen controls. Fullscreen mode lets dense surfaces such as the item selector and layout graph fill the viewport without changing the underlying app state.

## Layouts

Layouts are lightweight recipe collections for planning a factory subsection. There is always one focused layout; if the URL does not provide layout state, the app creates an empty unnamed layout automatically.

Each layout is an ordered list of recipe instances, not a set of recipe ids. The same recipe can appear multiple times to represent multiple copies of the same factory step. Recipe card add buttons always append another instance to the focused layout. Layout cards can be reordered by dragging their focus stem, and layout recipe row numbers act as drag handles for reordering recipes within a layout. When the recipe already appears in the focused layout, the button keeps working but shows a duplicate-count hint.

The left panel lets users create, focus, rename, collapse, and graph populated layouts. Empty layouts show delete in the same action slot where populated layouts show graph. Collapsed layouts keep their recipes but hide the list for scanning.

Layout state is serialized into the URL once it differs from the default empty layout. Simple app state such as the selected item, view mode, and filters remains readable as ordinary query params. Layout-heavy state is written as a compact `s=v1.<blob>` query param: recipe ids are dictionary-encoded, layout entries and graph details refer to entry indexes, side choices use small numeric codes, and the compact JSON is compressed with `lz-string`'s URL-safe codec. Old `layouts=` JSON links are still accepted and migrate to the compact `s=` format on the next URL update.

## Layout Graphs

A layout graph popup renders recipe instances as vertices using React Flow (`@xyflow/react`). Possible edges are item/fluid flows inferred from products of one recipe instance that match ingredients of another recipe instance in the same layout. Active edges are the user-visible subset of those flows; if an edge has no saved override, all matching items are active by default. Edges connect visually to recipe cards while preserving side-specific invisible anchors for routing.

Flow matching preserves exact item/fluid identity except for steam variants. The bootstrap data represents 500°C steam as `steam` and 165°C steam as `steam-165`; the graph treats those as one compatible steam family when deciding whether a recipe output can satisfy a recipe input, while still displaying and persisting the exact product id carried by an edge. This steam-only compatibility also respects raw `minimum_temperature` and `maximum_temperature` constraints when those fields are available. Hot and cold fluoroketone remain distinct fluids because Space Age recipes model them as an explicit conversion loop.

Graph rendering treats the layout contents as a multiset of recipe instances. The sidebar list order is useful for managing entries, but it does not determine graph geometry; vertices are ranked from inferred producer-to-consumer relationships and sorted by stable recipe identity within each rank.

Users can drag recipe vertices in the graph. Dragged positions are stored by layout entry id in the URL, so manual graph arrangement survives reloads and sharing. Edges can be focused from the line or item-flow label; dragging the item-flow label creates or moves a Bezier bend point for that edge while preserving the source and target side tangents. A small reset button above a focused routed edge clears only that edge's bend point.

When an edge is focused, its source and target nodes show clickable endpoint targets on all four sides so users can choose where the edge starts and ends. The graph popup reset action is guarded: the first click changes the control to `Reset?` with confirm and cancel buttons, and only the confirm button clears saved positions, edge endpoint choices, bend points, edge item overrides, and optional external terminal choices. A repeated click in the original reset-button position does not reset the graph.

### Graph Toolbar

The graph popup header has a contextual node/edge toolbar centered between the layout title and the popup actions. Its job is to expose semantic graph edits without adding another floating inspector panel to the canvas. The graph itself should remain a spatial planning surface: nodes, edges, terminal sets, endpoint handles, and bend handles stay close to the objects they affect, while the toolbar provides the compact list-editing controls that would be too noisy if repeated on every node or edge.

The toolbar follows the current graph focus state:

- No focused node, edge, terminal, or pending connection: show no active controls. The header should remain stable so reset, fullscreen, and close actions do not jump around.
- Focused terminal set: keep the toolbar inactive. Terminal focus is already handled directly on the related node by showing four side targets for docking that terminal set.
- Focused node: show the node toolbar.
- Focused existing edge: show the edge toolbar.
- Pending connection between two nodes: show the pending edge toolbar until the user confirms or cancels.

The node toolbar contains the focused recipe name, an external input group, an external output group, a terminal reset button, and a connect button. External groups are lists of item/fluid icon toggles derived from the focused recipe's actual ingredients and products. A checked toggle means the item is displayed as an external terminal for that node. A disabled checked toggle means the terminal is required because the current active graph does not satisfy that ingredient or product through an active edge. Users may not turn off required terminals, because doing so would hide a real unsatisfied boundary of the layout.

Optional node toolbar toggles represent a different intention: they let the user deliberately show a boundary terminal even when the item is already supplied or consumed inside the layout. This is useful when a factory subsection intentionally exports some of a product, imports a buffered item anyway, or wants to make an otherwise internal flow visible at the boundary. Optional external terminal choices are persisted separately from required terminal inference, so changing edges can make a formerly optional terminal become required, or make it optional again without losing the user's explicit choice unless reset clears it.

The node terminal reset button clears only the focused node's optional external input and output choices. It does not move the node, reset terminal side docking, alter connected edges, or touch required external terminals. This keeps its semantics parallel to edge material reset: the toolbar can reset the semantic display choices it owns, while spatial graph cleanup remains the job of the graph-level reset and direct canvas controls. The node reset button is disabled when the focused node has no saved optional terminal choices.

The connect button puts the focused node into connection-pick mode. In that mode, clicking another compatible node opens a pending edge toolbar. Shift-clicking another node while a node is focused is the shortcut for the same action. Compatibility is directional and recipe-based: one node must produce at least one item/fluid consumed by the other. If only the reverse direction is compatible, the pending edge uses that reverse producer-to-consumer direction. If neither direction shares a valid product-to-ingredient item, no pending edge is created.

The pending edge toolbar names the proposed source and target recipes, lists the shared item/fluid toggles, and provides confirm and cancel controls. If the proposed edge has no saved item override, all shared items are selected by default. If the edge already has a saved override, the pending toolbar starts from that saved selection, including the intentionally empty case where the edge is currently hidden. Confirm is disabled while no shared items are selected, because an edge with no active items is not visible flow. Confirming writes the selected item keys to the layout and focuses the resulting edge. Cancel exits pending connection state without changing graph state.

The edge toolbar edits an existing active edge. It shows the source and target recipe names plus one toggle for every item/fluid that the source can produce and the target can consume. Checked toggles are the staged items for that edge, not immediately persisted graph state. The toolbar also contains a material reset button and an apply button. Material reset returns the staged selection to the inferred default flow, meaning every shared item/fluid is active and any saved material override for that edge is removed when applied. Apply writes the staged material edit; it is grey and disabled when the staged selection would not change the active flow or clear a saved override.

Material edits are batched because edge contents can change the graph's semantic boundary. Turning an item off stages its removal from that edge; turning it on stages its return. If the user applies an empty staged selection, the active edge disappears and the related source output and target input become required external terminals. This is intentional: removing a flow should reveal the newly unsatisfied boundary instead of silently dropping information. The small reset button above a focused routed edge remains a separate canvas control for the edge bend point only; it does not alter edge material.

Toolbar edits must preserve the graph's truthfulness. The app can hide optional visualization details, but it should not imply that an ingredient is supplied or a product is consumed unless an active edge actually carries that item/fluid. Conversely, hiding an edge item must immediately update boundary terminals so the layout still communicates all required imports and exports. This is why terminal inference is based on active edge contents rather than merely on whether another recipe in the layout could theoretically match.

Toolbar state is part of shareable layout state. Edge item overrides are persisted by edge id, optional external terminal choices by terminal id, node positions by layout entry id, and endpoint/bend choices by their existing graph ids. The confirmed graph reset clears these saved graph-editing choices together with node positions, endpoint choices, terminal sides, and bend points, returning the graph to inferred active flows and required-only external terminals.

Products that are made by a recipe instance but not carried by an active outgoing edge remain attached to that recipe vertex as external output terminals. Ingredients that are consumed but not carried by an active incoming edge remain attached as external input terminals. Editing edge contents can therefore create or remove required boundary terminals. These boundary terminals dock outside the recipe card with short dashed stubs and directional arrows, while true recipe-to-recipe item flow remains a solid draggable edge.

Clicking a terminal set focuses it and shows the same four side targets used by focused edges, so users can move each input or output terminal set to the side that best fits the graph. This keeps graph semantics close to the underlying bipartite model without forcing users into a full ratio solver.

## Recipe Cards

The viewer has two global density modes:

- Detailed: full recipe cards for deliberate inspection.
- Concise: the default compact recipe card mode for scanning, using icon-only item, producer/building, time, and surface pills with hover/focus tooltips. Amounts are shown as icon, times marker, then number.

Recipe inputs and outputs are presented as a compact equation row (`inputs -> outputs`) instead of a two-column mini graph. This keeps common one-input, one-output recipes dense while still allowing multi-item recipes to wrap naturally.

Each detailed recipe card shows:

- Recipe icon and name.
- Prototype id.
- Craft time.
- Producers.
- Surface/location metadata.
- Inputs and outputs with amounts.
- Recipe flags such as `locked`, `mining`, `recycling`, and `technology`.
- Add-to-layout control for appending the recipe to the focused layout.

No ratio solving is attempted. Amounts are preserved for labels and future calculations.

## Filters

Surface filters include recipes that have no explicit location metadata, because FactorioLab treats those as broadly available in this bootstrap dataset.

Relationship filters are direction-specific. `No byproducts` applies only to `Made by` and keeps recipes where the selected item or fluid is the only output. `No co-inputs` applies only to `Used in` and keeps recipes where the selected item or fluid is the only input.

Recycling and technology recipes are hidden by default to reduce visual noise for common intermediates such as iron plate. Mining and locked recipes are included by default because they are often important for understanding source materials and progression.

The current hidden/internal filter is approximated through FactorioLab recipe flags. A future raw `data.raw.recipe` importer should replace this with real prototype fields such as `hidden`, `hidden_in_factoriopedia`, and related visibility fields.

## Visual Direction

The UI should feel like a dense factory planning surface: compact, scan-friendly, icon-heavy, and restrained. Use the FactorioLab icon atlas for item recognition, keep cards small, and prioritize legibility over spectacle.

## References

- Factorio command line parameters: <https://wiki.factorio.com/Command_line_parameters>
- Factorio `RecipePrototype` docs: <https://lua-api.factorio.com/latest/prototypes/RecipePrototype.html>
- Factorio `IngredientPrototype` docs: <https://lua-api.factorio.com/latest/types/IngredientPrototype.html>
- Factorio `ProductPrototype` docs: <https://lua-api.factorio.com/latest/types/ProductPrototype.html>
- Factorio `SurfaceCondition` docs: <https://lua-api.factorio.com/latest/types/SurfaceCondition.html>
- FactorioLab repository: <https://github.com/factoriolab/factoriolab>
- FactorioLab Space Age data folder: <https://github.com/factoriolab/factoriolab/tree/main/public/data/spa>
- FactorioLab license: <https://github.com/factoriolab/factoriolab/blob/main/LICENSE>
