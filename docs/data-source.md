# factorio-facts Data Source

The reliable source for factorio-facts Space Age recipes is Factorio prototype data after prototype loading, not a wiki scrape or a hand-maintained recipe list. This project should use official online docs for the schema and extraction method, then ingest a user-provided JSON dump when recipe data is needed.

## Recommended Source

Official online docs do not appear to publish a complete machine-readable Space Age recipe database. They do document the shape and provenance we need:

- Recipes are `RecipePrototype` entries.
- Recipe inputs use `IngredientPrototype`, a union of item and fluid ingredients.
- Recipe outputs use `ProductPrototype`, a union of item and fluid products.
- Space Age recipes may use `SurfaceCondition`.
- Factorio can export `data.raw` as JSON with `--dump-data`.

When a real recipe corpus is needed, provide a dump made from Factorio with the official Space Age set enabled and unrelated community mods disabled:

```sh
factorio --dump-data
```

Factorio documents `--dump-data` as dumping `data.raw` as JSON to the script output folder and exiting. The recipe collection we want is:

```text
data.raw.recipe
```

Codex should not run Factorio locally for this project unless explicitly asked. The dump should be supplied by the user or generated outside this workflow from the same Factorio version the player is using, with official expansion-related mods such as `space-age`, `quality`, and `elevated-rails` enabled as appropriate for that install.

## Why This Source

Factorio recipes are prototype data. During the data stage, Factorio loads base game and mod prototype definitions into `data.raw`; recipes live under the `"recipe"` prototype type. Exporting after this load step means generated and modified recipes are included in the same form the game uses.

The official prototype docs define `RecipePrototype` as a recipe that can represent crafting, smelting, or custom recipe categories. Its key relationship fields are `ingredients` and `results`, where ingredients and products can be items or fluids. Space Age also adds fields such as `surface_conditions`, which should be preserved for later filtering.

## Project Import Shape

Store local dumps outside git or under an ignored data directory, then point an importer at the JSON file. The TypeScript model in this project intentionally accepts the relevant `RecipePrototype` fields plus unknown extra fields, so the first viewer can stay simple while preserving source fidelity.

Suggested local path:

```text
data/raw/data.raw.json
```

The project should treat generated/imported recipe JSON as rebuildable data unless we deliberately add a tiny fixture for tests.

## FactorioLab Bootstrap Data

FactorioLab can be used as a practical bootstrap source for the first viewer. Its repository contains Space Age data and icon assets under:

```text
public/data/spa/data.json
public/data/spa/icons.webp
```

Use these through a dedicated adapter, not as the internal canonical model. FactorioLab's data is optimized for a calculator and may omit, transform, or synthesize recipe details differently than raw Factorio `RecipePrototype` data. The canonical import path for full fidelity should remain `data.raw.recipe`.

If FactorioLab data or icons are vendored into this repository, include the FactorioLab MIT license notice and keep the upstream source URL in the import metadata. Icons are especially sensitive because they are visually derived from Factorio game assets; keep them acceptable for local development and illustration, but do a licensing review before public distribution.

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

## References

- Factorio command line parameters: <https://wiki.factorio.com/Command_line_parameters>
- Factorio `RecipePrototype` docs: <https://lua-api.factorio.com/latest/prototypes/RecipePrototype.html>
- Factorio `IngredientPrototype` docs: <https://lua-api.factorio.com/latest/types/IngredientPrototype.html>
- Factorio `ProductPrototype` docs: <https://lua-api.factorio.com/latest/types/ProductPrototype.html>
- Factorio `SurfaceCondition` docs: <https://lua-api.factorio.com/latest/types/SurfaceCondition.html>
- FactorioLab repository: <https://github.com/factoriolab/factoriolab>
- FactorioLab Space Age data folder: <https://github.com/factoriolab/factoriolab/tree/main/public/data/spa>
- FactorioLab license: <https://github.com/factoriolab/factoriolab/blob/main/LICENSE>
