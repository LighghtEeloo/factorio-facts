# FactorioLab Vendor Data for factorio-facts

This directory contains bootstrap data vendored from FactorioLab.

## Upstream

- Repository: <https://github.com/factoriolab/factoriolab>
- License: MIT, copied in `data/vendor/factoriolab/LICENSE`
- Branch: `main`
- Commit at download time: `f8c3f16e7e6cb631974ec14e77b1365c72087166`

## Files

- `spa/data.json`
  - Upstream path: `public/data/spa/data.json`
  - Git blob SHA: `c9a5c0172dcd0cbb04598578efb68824f7710fe0`
- `spa/defaults.json`
  - Upstream path: `public/data/spa/defaults.json`
  - Git blob SHA: `7aa1873b95aedeb8e754c49132fa6257fc2594fd`
- `spa/hash.json`
  - Upstream path: `public/data/spa/hash.json`
  - Git blob SHA: `338e460c02cb5b016ab84fd060f8187790d87de5`
- `spa/icons.webp`
  - Upstream path: `public/data/spa/icons.webp`
  - Git blob SHA: `68dad73ae05513011d24b103be93ce94d3ba215c`

## Notes

FactorioLab is an upstream factory-calculator project, not factorio-facts. Import its vendored public data through `src/factoriolab/adapter.ts` rather than treating that app-specific schema as canonical `data.raw.recipe`.
