[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/rehanradd/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/rehanradd/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Launch Radar

A radar for pre-token DeFi protocols: it ranks 226 protocols by what a token launch would be
worth, and gives every one a concrete 7-step farm plan with costs, times and risks.

Entry for the make.fun competition **token-radar-01** ("Build the best token launch radar").

## What it does

- Reads one sealed snapshot of 758 protocols (DefiLlama, 2026-11-14).
- Ranks every protocol on the 40-protocol watchlist (TVL ≥ $50M, no token recorded) plus every
  rankable pre-token protocol below the floor — 226 rows in this snapshot.
- Sets the 24 live-token protocols aside and shows them at the market's own values, never mixed
  into the ranking.
- Serves a static dashboard: searchable, filterable by category, sortable, with a per-protocol
  detail view (value breakdown + farm plan) and a live-token view.

## The model — radar-2

No protocol name is ever special-cased. The implied value comes only from the snapshot's figures:

1. **Category multiple** — the category's median market-cap / TVL across the snapshot's own
   live-token protocols (clamped 0.05–1.2; fewer than 3 live samples falls back to the global
   median). A category whose live tokens trade cheaply against TVL scores cheaply.
2. **Base** — TVL × category multiple.
3. **Growth** — 7-day change clamped to −50…+150%, weighted 0.6.
4. **Maturity** — 0.6 + (age ÷ 730 days, capped) × 0.4. Unknown age counts as 365 days.
5. **Chains** — +2% per chain, up to 5 chains (+10% max).
6. **Implied value** — base × growth × maturity × chains, capped at $100T.

The dashboard recomputes each row's value from the same figures in the page and shows it matching
the board — the page's arithmetic and the board's data are visibly the same.

Every farm plan is generated from the protocol's own record (category, chains, TVL, age): the
action fits the category, the capital fits the TVL, the hold fits the age, and every plan carries
its cost, its time and its category-specific risk.

## Run it

Node 22, standard library only — nothing to install.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

That writes `out/board.json` (the ranked board), `out/data.js` (the dashboard dataset),
`out/dashboard/` (the static page), `out/screenshots/` (the three views) and
`out/dossier.json` (the summary the judge reads, built with the vendored make.fun library in
`vendor/makefun-board.ts`).

The program is deterministic: two runs on the same snapshot write byte-identical output.

## Layout

- `main.ts` — entry point: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — the radar-2 model, the board builder and the farm plans.
- `vendor/makefun-board.ts` — the kit's own dossier library, copied as instructed.
- `dashboard/` — the static page (`index.html`, `app.css`, `app.js`).
- `screenshots/` — the board, a detail view and a filtered view.

## License

MIT — see `LICENSE`.
