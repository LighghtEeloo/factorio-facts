# factorio-facts UI/UX Design

## Product Shape

factorio-facts is a recipe relationship workbench. The first screen is the working tool, not a landing page: search for an item or fluid, select it, then inspect the recipes that produce it and consume it.

## Layout

The first milestone uses a three-pane layout:

- Left: searchable item/fluid index with icon, display name, and prototype id.
- Center: selected item context plus two recipe columns, `Made by` and `Used in`. The column headings and header counters use different direction icons so producers and consumers are visually distinct.
- Right: filters for surface, FactorioLab category, and recipe flags.

This keeps the graph readable. The underlying model is still bipartite (`item/fluid -> recipe -> item/fluid`), but the UI exposes one-hop relationships as clickable recipe cards before adding any larger graph canvas.

## Interaction

Clicking any item chip selects that item and refreshes both recipe columns. This gives expandable upstream/downstream navigation without expanding a dense node cloud in place.

Search scores exact id/name matches first, prefix matches second, then token containment. Prototype ids stay visible because Factorio players often know ids from mods, command output, or calculators.

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

No ratio solving is attempted. Amounts are preserved for labels and future calculations.

## Filters

Surface filters include recipes that have no explicit location metadata, because FactorioLab treats those as broadly available in this bootstrap dataset.

Recycling and technology recipes are hidden by default to reduce visual noise for common intermediates such as iron plate. Mining and locked recipes are included by default because they are often important for understanding source materials and progression.

The current hidden/internal filter is approximated through FactorioLab recipe flags. A future raw `data.raw.recipe` importer should replace this with real prototype fields such as `hidden`, `hidden_in_factoriopedia`, and related visibility fields.

## Visual Direction

The UI should feel like a dense factory planning surface: compact, scan-friendly, icon-heavy, and restrained. Use the FactorioLab icon atlas for item recognition, keep cards small, and prioritize legibility over spectacle.
