# Living Uganda

A public catalogue and encyclopedia of Uganda's biodiversity, published with
GitHub Pages.

**Live site:** https://arsenebaguma.github.io/living-uganda/

The catalogue currently holds 1,901 species records across nine groups — birds,
plants, mammals, insects, fish, reptiles, amphibians, other invertebrates and
other organisms — assembled from published GBIF datasets and open Uganda
sources. Local-language names, essays, local stories and further accounts are
being added over time.

## How the site is published

This repository *is* the website. GitHub Pages serves the `main` branch from the
repository root, so every file committed to `main` is live within a minute or
two. There is no build step, no server, no database and no API key: the pages are
static HTML, the styles and scripts are in `assets/`, and the catalogue is
`data/species.json`, loaded by the browser.

Two consequences are worth knowing:

- **A commit is a publication.** Anything pushed to `main` is public.
- **`?v=` query strings are not needed.** Pages serves the current file; the
  cache lives for ten minutes.

## What protects `main`

The branch is protected by a ruleset called **Protect main** (Settings → Rules →
Rulesets), active on `refs/heads/main` with no bypass list:

- the branch cannot be deleted;
- force-pushes are refused, so published history cannot be rewritten;
- a branch named `main` cannot be created;
- the `Release check` workflow must pass before a commit reaches `main`.

GitHub applies that last rule to direct pushes too — and a brand-new commit cannot
have a check result yet, so with no exception **nothing could be pushed at all**.
The repository admin is therefore on the ruleset's **bypass list**: your own
publishes go through (GitHub logs `Bypassed rule violations`), while anyone else is
held to the check. `publish.py` is still the gate on your machine, and it refuses a
tree that fails the check before anything is committed.

If a legitimate force-push is ever needed, edit or delete the ruleset first. That
is deliberate: rewriting published history should never be a reflex.

## Before you publish

Run the release check. It is the same check CI runs, and it must pass:

```bash
python .github/ci/check_release.py --site .
```

It verifies page metadata, canonical and social links, the content security
policy, every internal link and `#anchor`, the catalogue's JSON and its headline
counts, the sitemap and `robots.txt`, the 404 page, accidental secrets and
oversized files. Warnings are for review; errors block publication.

## Updating the catalogue

`data/species.json` is the single source of truth. Each record looks like:

```json
{
  "id": "gbif-2429944",
  "scientificName": "Amietia angolensis",
  "acceptedName": "Amietia angolensis",
  "commonName": "Dusky-throated Rana",
  "aliases": ["Rana angolensis"],
  "group": "Amphibians",
  "rank": "species",
  "taxonomy": { "kingdom": "Animalia", "phylum": "Chordata", "class": "Amphibia", "order": "Anura", "family": "Pyxicephalidae", "genus": "Amietia" },
  "gbifKey": 2429944,
  "evidence": [ ... ]
}
```

Optional fields include `description`, `habitat`, `distribution`, `feeding`,
`behaviour`, `breeding`, `conservation`, `localNames` (each with `name`,
`language`, `region`), `review` and `establishment`.

Rules that keep the site honest:

1. Keep `id` and `gbifKey` unique. The release check fails on duplicates.
2. Never invent a local name. Record the language, the region and the source.
3. A record in the catalogue is evidence of a published observation, not proof of
   present occupancy. Do not write an account as if it were.
4. If the catalogue changes, run `python .github/ci/check_release.py --site .` —
   it compares the homepage's stated figures (records, families, orders, common
   names) against the data file and fails if they disagree.

If pages are added or removed, rebuild the sitemap first
(`python ../inventory/build_sitemap.py` in the working copy), then run the check.

## Adding a page

1. Copy an existing page with the same layout, give it a title and a description
   that are unique on the site.
2. Add canonical, Open Graph, Twitter and Content-Security-Policy tags — copy
   them from any page and change the URL.
3. Link it from somewhere. An unlinked page is invisible.
4. Add it to the sitemap generator's page list.
5. Run the release check.

Scripts must be external files in `assets/`; inline `<script>` is blocked by the
site's Content-Security-Policy.

## What lives where

| Path | Purpose |
|---|---|
| `index.html` | Homepage |
| `species.html` | Searchable catalogue |
| `phylogeny.html` | Branches-of-life explorer, per group |
| `living-world.html`, `conservation.html` | Landscapes and conservation narratives |
| `peoples.html`, `research.html`, `about.html` | Context, sources, standards |
| `credits.html`, `*-credits.html` | Photograph and dataset attribution |
| `privacy.html` | What the site does and does not record |
| `404.html` | Shown for unknown addresses; needs absolute paths because it is served at any depth |
| `data/` | Catalogue and tree data |
| `assets/` | Styles, scripts, images, fonts |
| `sitemap.xml`, `robots.txt` | Search-engine files |
| `google60d5a8b72e6a0b14.html` | Google Search Console ownership proof — uploaded verbatim; never edit or delete it, or the property loses verification |
| `.github/workflows/validate.yml` | CI check |

Draft pages (`catalogue.html`, `connections.html`, `species-*.html`) are kept for
the next stage of work. They are `noindex`, absent from the sitemap, and not
linked from the public navigation.

## Licences

Text, design and original compilation: see [`LICENSE`](LICENSE). Photographs keep
their photographers' licences, listed on the credits pages. Datasets keep their
publishers' licences, listed on `dataset-credits.html`. Fonts are under the SIL
Open Font License (`assets/fonts/`).

## Corrections

Open an issue: https://github.com/arsenebaguma/living-uganda/issues

Or write privately to arsenebaguma10@gmail.com (published on the About and privacy pages as
HTML entities, to keep it off simple spam lists).
