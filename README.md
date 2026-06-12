# factorio-facts

factorio-facts is a local TypeScript workbench for exploring Factorio Space Age recipe dependencies.

Select an item or fluid, then inspect the recipes that make it and the recipes that consume it. The first milestone uses vendored FactorioLab Space Age data and icons while keeping the internal graph model close to Factorio recipe prototypes.

## Commands

```sh
npm install
npm run dev
npm run check
npm run build
npm run inspect:factoriolab -- iron-plate
```

## Deployment

The app is deployed as a static GitHub Pages site from the `main` branch with
`.github/workflows/deploy-pages.yml`. The workflow installs dependencies with
`npm ci`, runs `npm run build -- --mode github-pages`, uploads `dist`, and
publishes it through GitHub Pages.

Repository Pages should use `Settings` -> `Pages` -> `Build and deployment` ->
`Source` -> `GitHub Actions`.

The `github-pages` Vite mode sets the public base path to `/factorio-facts/`.
Local development and the default production build continue to use `/`.
