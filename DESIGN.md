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

FactorioLab is an upstream factory-calculator project, not factorio-facts. It can be used as a practical bootstrap source for the first viewer because its repository contains Space Age data and icon assets under:

```text
public/data/spa/data.json
public/data/spa/icons.webp
```

Use these through a dedicated adapter, not as the internal canonical model. FactorioLab's public data reflects its own app schema and may omit, transform, or synthesize recipe details differently than raw Factorio `RecipePrototype` data. The full-fidelity import path should remain `data.raw.recipe`.

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

Keep imported recipes close to Factorio's `RecipePrototype` shape. Preserve fields such as `ingredients`, `results`, `main_product`, `icon`, `icons`, `icon_size`, `category`, `enabled`, `hidden`, and `surface_conditions`; avoid flattening Space Age details that may matter for filtering by surface, planet, icon display, or crafting context.

Recipe icon display should follow Factorio's recipe icon semantics through one shared resolver: prefer an explicit recipe icon, fall back to an available atlas icon keyed by recipe id, then fall back to the explicit `main_product` or singular result product, and only then fall back to the first result. The current FactorioLab bootstrap adapter stores FactorioLab recipe icon ids in metadata, while FactorioLab's atlas also includes recipe-id icons for generated recipes such as recycling.

Model dependencies as a graph, not a strict tree. Recipes can have many inputs, many outputs, alternate producers, fluids, surfaces, spoilage behavior, and recycling paths. The core questions are:

- `madeBy(itemOrFluid)`: recipes that produce the selected prototype.
- `usedIn(itemOrFluid)`: recipes that consume the selected prototype.
- `connectedRecipes(itemOrFluid)`: both directions for the selected prototype.

Keep ingredient/result amounts and probabilities for labels and future work, but avoid ratio calculations unless the project explicitly adds that feature.

## Product Shape

The first screen is the working tool, not a landing page. The app uses a mode-based Vite/React workbench with a persistent left sidebar and fullscreen task views. Sidebar section headers are labels, while section controls manage focus and the main lens:

- Recipes: the section shows only the focused item/fluid. Clicking that focused item opens the recipe explorer, while the picker button opens item selection. The recipe explorer itself shows the selected item context plus `Made by` and `Used in` recipe columns. The column headings and header counters use different direction icons so producers and consumers are visually distinct. Filters for surface, FactorioLab category, and recipe flags live beside this recipe explorer.
- Installed: installed layout snapshots appear as composite recipes that can be added to the focused layout, opened as immutable read-only layouts in the layout editor or graph view, and unloaded only while no layout or installed snapshot references them.
- Layouts: global layout rows focus and reorder layouts, and clicking a layout row opens dedicated layout recipe editing for that layout. The layout view does not repeat the layout gallery; it edits only the focused layout.
- Graph: dedicated React Flow graph editing for the selected layout, entered from a layout row or the focused layout editor.

Clicking any item chip selects that item and refreshes both recipe columns. This gives expandable upstream/downstream navigation without expanding a dense node cloud in place.

Search scores exact id/name matches first, prefix matches second, then token containment. Prototype ids stay visible because Factorio players often know ids from mods, command output, or calculators.

The item selector remains a fullscreen picker over the workbench. Layout recipe editing and graph editing are app views instead of sidebar-only or popup-only surfaces, so dense editing interactions stay stable in the main viewport.

## Layouts

Layouts are lightweight recipe collections for planning a factory subsection. There is always one focused layout; if the URL does not provide layout state, the app creates an empty unnamed layout automatically.

Each layout is an ordered list of recipe instances, not a set of recipe ids. The same recipe can appear multiple times to represent multiple copies of the same factory step. Each recipe instance stores a positive production size number and the recipe id only; layouts are planning documents rather than factory-configuration documents, so machine, module, and beacon choices are not persisted. Recipe card add buttons always append another instance to the focused layout. Layout rows are focused and reordered from the global sidebar using their leading composite recipe icon, and layout recipe rows are reordered from their leading row number. When the recipe already appears in the focused layout, the button keeps working but shows a duplicate-count hint.

Layout recipe rows should stay task-focused: show a leading row number reorder affordance, recipe identity, craft time, production multiplier, and remove, but avoid category pills because categories are scan noise in this editor. Production size should be presented as a multiplier with `×`, not the word `size`, so it reads as "this many copies" rather than a named recipe property.

The global layout rows let users focus, reorder, and graph layouts from anywhere in the workbench. The Layouts section header can import a pasted factorio-facts layout JSON string as a new focused layout, while the empty-layout editor first offers item selection through the shared picker and then a secondary import shortcut that fills that empty layout. The layout view is a focused-layout document editor: rename the current layout, review its graph-derived composite recipe boundary, reorder recipe instances, edit production sizes, export populated layouts, open the focused layout's graph, install a populated layout as a composite recipe snapshot, and delete the focused layout through a two-step confirmation at the far right of the header. Installed layouts are composite recipes, but clicking one opens this same layout editor surface as an immutable read-only snapshot instead of jumping to a boundary product in the Recipes view. Installed rows and installed read-only layout headers can also open the same graph surface in immutable read-only mode. Unnamed layouts use an inferred display name when exactly one visible composite icon maps to one external output product; otherwise they fall back to the neutral untitled label. Selecting a recipe row opens an in-place inspector for that recipe instance with ingredients, results, recipe metadata, and an explicit action for opening the recipe context in the Recipes view. Double-clicking a layout recipe's identity opens that same recipe context in the Recipes view, while single-clicking keeps the user in the layout editor. Row selection itself should not switch app views.

The layout editor header and layout graph action row include export. Export opens a readable factorio-facts layout JSON snapshot string for the open layout, with a copy action for moving it elsewhere. The snapshot includes recipe instances, production sizes, relays, graph geometry, edge material choices, terminal choices, layout metadata, and the recursive dependency closure of installed composite recipes referenced by the exported layout. Import installs bundled dependencies that are not already present; if a bundled `composite:` id collides with a different installed snapshot, import mints a new composite id and rewrites references in the imported bundle. It is a layout interchange format, not a Factorio prototype export.

Layout state is serialized into the URL once it differs from the default empty layout. Simple app state such as the selected item, active view mode, and filters remains readable as ordinary query params. Layout-heavy state is written as a compact `s=v1.<blob>` query param: recipe ids, installed composite recipe snapshots, and material keys are dictionary-encoded, recipe entries come first in the graph node index space, non-default production sizes are stored beside their recipe entries, relay nodes follow them, side choices use small numeric codes, and the compact JSON is compressed with `lz-string`'s URL-safe codec. Old `layouts=` JSON links are still accepted, ignore removed factory-setting fields, and migrate to the compact `s=` format on the next URL update.

## Composite Recipes

An installed layout recipe is treated as a composite recipe: recipe-shaped, graph-derived, and usable by other layouts, but not a Factorio prototype. Its public interface is the saved layout graph's truthful boundary: external inputs become ingredients and external outputs become results. That boundary includes required terminals inferred from active graph flow and user-forced optional terminals that deliberately expose imports or exports.

Composite recipes are immutable snapshots, not live references to editable layouts. Installing a layout as a recipe moves that snapshot out of the editable Layouts section and into the Installed section. The Installed section still treats each composite recipe as an installed layout: clicking it opens the layout editor in read-only mode, with renaming, icon editing, row reordering, production-size edits, graph editing, install, delete, import, and other mutation affordances disabled. Opening its graph reuses the graph editor in read-only mode: users can pan, zoom, focus nodes, focus edges, inspect terminals, and export the snapshot, but cannot drag nodes, bend edges, edit endpoints or terminals, smart-link, create relays, reset graph state, or use graph undo/redo. Unloading is guarded: a composite recipe can only be unloaded while no ordinary layout and no other installed snapshot contains a recipe entry for its `composite:` recipe id. This keeps layout graphs shareable and prevents downstream plans from changing when an upstream planning sketch is revised.

Composite recipe time and quantities remain deliberately non-specific until the app grows real ratio solving. Composite rows leave craft time blank while still allowing a production multiplier like other layout entries. Composite recipe icons are inferred from external outputs and rendered as a fitted multi-icon stack of up to four visible icons, including the leading icon for each layout row in the sidebar. The layout editor header lets the user override that icon by drag-reordering external output icons and toggling each icon's visibility independently; hidden icons keep their list order, more than four visible icons keep their selection state, and only the first four visible icons render in the stack.

## Layout Graphs

A layout graph view renders recipe instances and relay nodes as vertices using React Flow (`@xyflow/react`). Recipe vertices represent real recipe transformations. Relay vertices are circular identity nodes: each relay has a set of item/fluid materials, exposes the same set as inputs and outputs, and exists only to route or group graph flow. Recipes and relays share the same graph-node interaction semantics through a common selectable/connectable node data contract: both can be selected from their primary surface, put into connect-pick mode, highlighted as compatible connection targets, dragged, and connected. The relay's circular shape distinguishes identity routing from recipe transformation without making it a lesser interaction object. Possible edges are item/fluid flows inferred from products of one graph node that match ingredients of another graph node in the same layout. Active edges are the user-visible subset of those flows; if an edge has no saved override, all matching items are active by default. When a recipe is added to a populated layout, compatible edges touching that new recipe entry are saved as empty overrides so the user can link it manually instead of inheriting every inferred connection. Edges connect visually to graph nodes while preserving side-specific invisible anchors for routing.

The graph editor is lazy-loaded at the app view boundary. React Flow and its D3 dependencies should stay out of the initial recipe-browser chunk because graph editing is an explicit fullscreen mode, not required for first paint or ordinary recipe/layout browsing. The Vite build also uses explicit manual chunks for stable vendor code, URL codec code, graph vendor code, and vendored FactorioLab data so large dependencies remain cacheable and the production build warning stays meaningful.

Flow matching preserves exact item/fluid identity except for steam variants. The bootstrap data represents 500°C steam as `steam` and 165°C steam as `steam-165`; the graph treats those as one compatible steam family when deciding whether a recipe output can satisfy a recipe input, while still displaying and persisting the exact product id carried by an edge. This steam-only compatibility also respects raw `minimum_temperature` and `maximum_temperature` constraints when those fields are available. Hot and cold fluoroketone remain distinct fluids because Space Age recipes model them as an explicit conversion loop.

Graph rendering treats the layout recipe contents as a multiset of recipe instances. The layout editor order is useful for managing entries, but it does not determine graph geometry; vertices are ranked from inferred producer-to-consumer relationships and sorted by stable node identity within each rank. Relay nodes are graph-only layout state and do not appear in the recipe-instance editor.

Users can drag graph vertices. Dragged positions are stored by graph node id in the URL, so manual graph arrangement survives reloads and sharing. The graph viewport auto-fits once when the graph view opens so users start with the whole graph in frame, then becomes user-owned: the app should not run automatic fit, center, pan, or zoom behavior during resize or graph-content changes because that interrupts spatial editing workflows. Edges can be focused from the line or item-flow label; shift-selecting edge labels builds a selected edge set for relay routing. Dragging the item-flow label creates or moves a Bezier bend point for that edge while preserving the source and target side tangents. A small reset button above a focused routed edge clears only that edge's bend point.

When an edge is focused, its source and target nodes show clickable endpoint targets on all four sides so users can choose where the edge starts and ends. The graph view action row contains undo, redo, reset, export, and close/back controls. Undo and redo are graph-local and layout-local: each open layout has a linear history stack of confirmed graph edits, and undo/redo restores only graph-owned state on top of the current recipe rows: relay nodes, saved node positions, edge endpoint choices, bend points, edge material overrides, optional external terminal choices, and terminal sides. It must not snapshot full layout entries and then patch ordinary layout metadata back afterward. Performing a new graph edit after undo clears that layout's redo stack. The graph reset action is guarded: the first click changes the control to `Reset?` with confirm and cancel buttons, and only the confirm button removes relay nodes and clears saved positions, edge endpoint choices, bend points, edge item overrides, and optional external terminal choices. A repeated click in the original reset-button position does not reset the graph.

### Graph Toolbar

The graph view header uses the same shared workbench header component as the layout editor, with a contextual node/edge toolbar centered between the layout title and the graph actions. The shared title block owns the composite icon, inferred title, boundary summary, and recipe count, and the graph header keeps a stable layout-editor-height row even when no contextual toolbar is active. Its job is to expose semantic graph edits without adding another floating inspector panel to the canvas. The graph itself should remain a spatial planning surface: nodes, edges, terminal sets, endpoint handles, and bend handles stay close to the objects they affect, while the toolbar provides the compact list-editing controls that would be too noisy if repeated on every node or edge.

The toolbar follows the current graph focus state:

- No focused node, edge, terminal, edge set, or pending connection: show no active controls. The header should remain stable so export, undo/redo, reset, and close/back actions do not jump around.
- Focused terminal set: show the terminal toolbar. The related node still shows four side targets for docking that terminal set, while the terminal toolbar owns the create-relay action for moving that boundary outward into a relay node.
- Focused node: show the node toolbar and softly highlight active edges and adjacent nodes related to that node. Incoming related flows use the external-input green, and outgoing related flows use the external-output gold.
- Focused existing edge: show the edge toolbar.
- Focused edge set: show the edge-set toolbar for routing the selected flows through one relay.
- Pending connection between two nodes: show the pending edge toolbar until the user confirms or cancels.

The node toolbar contains the focused node name, external input and output groups, a terminal reset button, a smart link button, a connect button, and an apply button. Recipe nodes use the recipe's actual ingredients and products. Relay nodes use the relay material set as both ingredients and products, and their toolbar adds a `Carry` group where each carried material can be staged on or off. The last carried material is locked; deleting the relay is the explicit way to remove the whole identity node. A checked external toggle means the item is displayed as an external terminal for that node. A disabled checked external toggle means the terminal is required because the current active graph does not satisfy that ingredient or product through an active edge. Users may not turn off required terminals, because doing so would hide a real unsatisfied boundary of the layout. Relay node toolbars also include delete, which removes the relay and any graph state attached to it. Smart link explicitly enables compatible edge material overrides for the focused node: recipe nodes link compatible incoming and outgoing edges, while relay nodes link compatible outgoing edges to downstream consumers. Hovering or keyboard-focusing Smart link previews those compatible flows on the canvas with highlighted nodes, terminals, and dashed preview edges without changing saved graph state; node and edge highlights use external-input green for flows that feed the focused node and external-output gold for flows that leave the focused node, while terminal chips keep their own input/output terminal colors.

Optional node toolbar toggles represent a different intention: they let the user deliberately show a boundary terminal even when the item is already supplied or consumed inside the layout. This is useful when a factory subsection intentionally exports some of a product, imports a buffered item anyway, or wants to make an otherwise internal flow visible at the boundary. Optional external terminal choices are persisted separately from required terminal inference, so changing edges can make a formerly optional terminal become required, or make it optional again without losing the user's explicit choice unless reset clears it.

Node toolbar edits are batched. Toggling external inputs, toggling external outputs, removing or restoring relay carried materials, and pressing node terminal reset all modify only the toolbar draft until the user clicks apply. Apply is grey and disabled when the draft has no semantic delta. On recipe nodes, apply writes the staged optional external input and output choices. On relay nodes, apply writes the staged relay material set and the staged optional external input and output choices together. If a relay material is removed, applying also prunes that material from saved relay-adjacent edge overrides and relay external terminal choices so stale URL state does not imply a flow the relay no longer carries.

The node terminal reset button stages required-only terminal choices for the focused node. It does not move the node, reset terminal side docking, alter connected edges, change relay carried materials, or touch required external terminals. This keeps its semantics parallel to edge material reset: the toolbar can reset the semantic display choices it owns, while spatial graph cleanup remains the job of the graph-level reset and direct canvas controls. The node reset button is disabled when neither the committed state nor the current draft has optional terminal choices.

The connect button puts the focused node into connection-pick mode. In that mode, clicking another compatible node opens a pending edge toolbar. Shift-selecting another node while a node is focused is the shortcut for the same action. Compatibility is directional and material-based: one node must produce at least one item/fluid consumed by the other. If only the reverse direction is compatible, the pending edge uses that reverse producer-to-consumer direction. If neither direction shares a valid product-to-ingredient item, no pending edge is created.

The graph canvas includes a compact keyboard shortcut strip near the bottom-left view controls. It should stay visually secondary and name only interaction accelerators that are hard to discover from the controls themselves. Shift is the only graph modifier key: shift-selecting nodes starts pending connections, and shift-selecting edges builds multi-flow selections.

The pending edge toolbar names the proposed source and target nodes, lists the shared item/fluid toggles, and provides confirm and cancel controls. If the proposed edge has no saved item override, all shared items are selected by default. If the edge already has a saved override, the pending toolbar starts from that saved selection, including the intentionally empty case where the edge is currently hidden. Confirm is disabled while no shared items are selected, because an edge with no active items is not visible flow. Confirming writes the selected item keys to the layout and focuses the resulting edge. Cancel exits pending connection state without changing graph state.

The edge toolbar edits an existing active edge. It shows the source and target node names plus one toggle for every item/fluid that the source can produce and the target can consume. Checked toggles are the staged items for that edge, not immediately persisted graph state. The toolbar also contains a material reset button, a route-through-relay button, and an apply button. Material reset returns the staged selection to the inferred default flow, meaning every shared item/fluid is active and any saved material override for that edge is removed when applied. Apply writes the staged material edit; it is grey and disabled when the staged selection would not change the active flow or clear a saved override.

The focused external input/output terminal toolbar creates a relay from that boundary set. The map terminal itself only focuses the terminal set and exposes side-docking targets. For an external input terminal, the app creates a relay outside the node, connects `relay -> node`, and lets the relay expose the required external input. For an external output terminal, it creates `node -> relay`, lets the relay expose the required external output, and saves empty overrides for compatible relay outgoing edges so the new relay does not auto-connect to downstream consumers. If the original terminal was optional rather than required, the selected optional material choices are removed from the original node so the boundary visibly moves to the relay.

The edge-set toolbar creates a relay from selected active edges. For each selected edge, the app hides the original direct edge by saving an empty material override, then inserts the relay into that selected flow by creating both the source-to-relay ingress edge and the relay-to-original-target egress edge for the materials that were active on the original edge. Other compatible relay outgoing edges start hidden so the relay does not unexpectedly merge into unrelated consumers. A single focused edge uses the same command from the edge toolbar.

Smart link is deliberately separate from recipe addition and relay creation. Pressing it on a focused recipe writes edge material overrides for every compatible producer or consumer around that recipe. Pressing it on a focused relay writes outgoing edge material overrides for every current graph node that can consume one of the relay's carried materials. This recovers automatic linking on demand while keeping newly added recipes and newly created output relays conservative by default. Its hover preview must use the same compatibility rules as the applied command so the preview and committed graph never disagree.

Material edits are batched because edge contents can change the graph's semantic boundary. Turning an item off stages its removal from that edge; turning it on stages its return. If the user applies an empty staged selection, the active edge disappears and the related source output and target input become required external terminals. This is intentional: removing a flow should reveal the newly unsatisfied boundary instead of silently dropping information. The small reset button above a focused routed edge remains a separate canvas control for the edge bend point only; it does not alter edge material.

Toolbar edits must preserve the graph's truthfulness. The app can hide optional visualization details, but it should not imply that an ingredient is supplied or a product is consumed unless an active edge actually carries that item/fluid. Conversely, hiding an edge item must immediately update boundary terminals so the layout still communicates all required imports and exports. This is why terminal inference is based on active edge contents rather than merely on whether another recipe in the layout could theoretically match.

Toolbar state is part of shareable layout state. Edge item overrides are persisted by edge id, optional external terminal choices by terminal id, node positions by graph node id, relay material sets by relay id, and endpoint/bend choices by their existing graph ids. The confirmed graph reset clears these saved graph-editing choices together with relay nodes, node positions, endpoint choices, terminal sides, and bend points, returning the graph to inferred recipe-only active flows and required-only external terminals.

Products that are made by a graph node but not carried by an active outgoing edge remain attached to that node as external output terminals. Ingredients that are consumed but not carried by an active incoming edge remain attached as external input terminals. Editing edge contents can therefore create or remove required boundary terminals. These boundary terminals dock outside the graph node with short dashed stubs and directional arrows, while true node-to-node item flow remains a solid draggable edge.

Clicking a terminal set focuses it and shows the same four side targets used by focused edges, so users can move each input or output terminal set to the side that best fits the graph. This keeps graph semantics close to the underlying bipartite model without forcing users into a full ratio solver.

## Recipe Cards

Recipe inputs and outputs are presented as a compact equation row (`inputs -> outputs`) instead of a two-column mini graph. This keeps common one-input, one-output recipes dense while still allowing multi-item recipes to wrap naturally.

Recipe cards use one compact presentation for scanning: recipe icon and name, add-to-layout control, craft time, icon-only producer/building and surface pills with hover/focus tooltips, and ingredient/result chips. Amounts are shown as icon, times marker, then number.

The layout inspector follows the same metadata vocabulary. Production size and craft time remain text pills because their values need to be read directly, while producers and surfaces should use recognizable icon pills with tooltips rather than long text pills.

No ratio solving is attempted. Amounts are preserved for labels and future calculations.

## Filters

Surface filters include recipes that have no explicit location metadata, because FactorioLab treats those as broadly available in this bootstrap dataset.

Relationship filters are direction-specific. `No byproducts` applies only to `Made by` and keeps recipes where the selected item or fluid is the only output. `No co-inputs` applies only to `Used in` and keeps recipes where the selected item or fluid is the only input.

Recycling and technology recipes are hidden by default to reduce visual noise for common intermediates such as iron plate. Mining and locked recipes are included by default because they are often important for understanding source materials and progression.

The current hidden/internal filter is approximated through FactorioLab recipe flags. A future raw `data.raw.recipe` importer should replace this with real prototype fields such as `hidden`, `hidden_in_factoriopedia`, and related visibility fields.

## Visual Direction

The UI should feel like a dense factory planning surface: compact, scan-friendly, icon-heavy, and restrained. Use the FactorioLab icon atlas for item recognition, keep cards small, and prioritize legibility over spectacle.

Selected rows and pressed controls should avoid extra accent bars, doubled inset borders, or button-like ornamental highlights when the selected border/background already communicates focus. In dense editing surfaces, those extra accents compete with drag handles, graph actions, and item icons, making the interface feel noisier without adding useful state information.

## References

- Factorio command line parameters: <https://wiki.factorio.com/Command_line_parameters>
- Factorio `RecipePrototype` docs: <https://lua-api.factorio.com/latest/prototypes/RecipePrototype.html>
- Factorio `IngredientPrototype` docs: <https://lua-api.factorio.com/latest/types/IngredientPrototype.html>
- Factorio `ProductPrototype` docs: <https://lua-api.factorio.com/latest/types/ProductPrototype.html>
- Factorio `SurfaceCondition` docs: <https://lua-api.factorio.com/latest/types/SurfaceCondition.html>
- FactorioLab repository: <https://github.com/factoriolab/factoriolab>
- FactorioLab Space Age data folder: <https://github.com/factoriolab/factoriolab/tree/main/public/data/spa>
- FactorioLab license: <https://github.com/factoriolab/factoriolab/blob/main/LICENSE>
