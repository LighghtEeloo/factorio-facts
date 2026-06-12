# factorio-facts UI/UX Design

## Product Shape

factorio-facts is a recipe relationship workbench. The first screen is the working tool, not a landing page: select an item or fluid, inspect the recipes that produce it and consume it, then collect useful recipe instances into layouts.

## Layout

The app uses a three-pane layout:

- Left: item selector entry point plus layout management.
- Center: selected item context plus two recipe columns, `Made by` and `Used in`. The column headings and header counters use different direction icons so producers and consumers are visually distinct.
- Right: filters for surface, FactorioLab category, and recipe flags.

This keeps the graph readable. The underlying model is still bipartite (`item/fluid -> recipe -> item/fluid`), but the UI exposes one-hop relationships as clickable recipe cards before adding any larger graph canvas.

## Interaction

Clicking any item chip selects that item and refreshes both recipe columns. This gives expandable upstream/downstream navigation without expanding a dense node cloud in place.

Search scores exact id/name matches first, prefix matches second, then token containment. Prototype ids stay visible because Factorio players often know ids from mods, command output, or calculators.

Popups use a shared header pattern with close and fullscreen controls. Fullscreen mode lets dense surfaces such as the item selector and layout graph fill the viewport without changing the underlying app state.

## Layouts

Layouts are lightweight recipe collections for planning a factory subsection. There is always one focused layout; if the URL does not provide any layout state, the app creates an empty unnamed layout automatically.

Each layout is an ordered list of recipe instances, not a set of recipe ids. The same recipe can appear multiple times to represent multiple copies of the same factory step. Recipe card add buttons always append another instance to the focused layout. Layout recipe row numbers act as drag handles for reordering the sidebar list. When the recipe already appears in the focused layout, the button keeps working but shows a duplicate-count hint.

The left panel lets users create, focus, rename, collapse, and graph populated layouts. Empty layouts show delete in the same action slot where populated layouts show graph. Collapsed layouts keep their recipes but hide the list for scanning.

Layout state is serialized into the URL once it differs from the default empty layout. The URL stores layout ids, entry ids, names, collapsed flags, focused layout id, ordered recipe entries, graph node positions, graph edge endpoint choices, and graph edge bend points so duplicate recipe instances and manual graph cleanup survive reloads.

## Layout Graphs

A layout graph popup renders recipe instances as vertices using React Flow (`@xyflow/react`). Edges are item/fluid flows inferred from products of one recipe instance that match ingredients of another recipe instance in the same layout, and they attach to explicit vertex handles so arrows describe recipe-to-recipe flow without implying extra intermediate machinery.

Graph rendering treats the layout contents as a multiset of recipe instances. The sidebar list order is useful for managing entries, but it does not determine graph geometry; vertices are ranked from inferred producer-to-consumer relationships and sorted by stable recipe identity within each rank.

Users can drag recipe vertices in the graph. Dragged positions are stored by layout entry id in the URL, so manual graph arrangement survives reloads and sharing. Edges can be focused from the line or item-flow label; dragging the item-flow label creates or moves a Bezier bend point for that edge while preserving the source and target handle tangents. A small reset button above a focused routed edge clears only that edge's bend point. When an edge is focused, its source and target nodes show clickable endpoint targets on all four sides so users can choose where the edge starts and ends. The graph popup reset button clears saved positions, edge endpoint choices, and bend points, returning the layout to automatic graph placement and default right-to-left edge routing.

Products that are made by a recipe instance but not consumed by another layout recipe remain attached to that recipe vertex as dangling outputs. Ingredients that are consumed but not made inside the layout remain attached as dangling inputs. This keeps graph semantics close to the underlying bipartite model without forcing users into a full ratio solver.

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

Recycling and technology recipes are hidden by default to reduce visual noise for common intermediates such as iron plate. Mining and locked recipes are included by default because they are often important for understanding source materials and progression.

The current hidden/internal filter is approximated through FactorioLab recipe flags. A future raw `data.raw.recipe` importer should replace this with real prototype fields such as `hidden`, `hidden_in_factoriopedia`, and related visibility fields.

## Visual Direction

The UI should feel like a dense factory planning surface: compact, scan-friendly, icon-heavy, and restrained. Use the FactorioLab icon atlas for item recognition, keep cards small, and prioritize legibility over spectacle.
