# factorio-facts

Static site: https://lighghteeloo.github.io/factorio-facts/

factorio-facts is a local TypeScript workbench for exploring Factorio Space Age recipe dependencies.

Select an item or fluid, inspect the recipes that make it and consume it, collect recipe instances into layouts, edit the focused layout, open that layout as a graph view, and install a layout snapshot as a composite recipe for use in other layouts. The first milestone uses vendored FactorioLab Space Age data and icons while keeping the internal graph model close to Factorio recipe prototypes.

## Commands

```sh
npm install # Install local dependencies.
npm run dev # Start the Vite development server.
npm run check # Run TypeScript verification.
npm run build # Build the app for local/static production output.
npm run build -- --mode github-pages # Build for GitHub Pages at /factorio-facts/.
npm run inspect:factoriolab -- iron-plate # Inspect vendored bootstrap recipe data for one item.
```

## Deployment

`npm run build -- --mode github-pages` builds the static GitHub Pages artifact; `.github/workflows/deploy-pages.yml` runs it on pushes to `main` and publishes `dist`.
