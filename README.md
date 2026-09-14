# Surima Academy — Riichi Mahjong Trainer

A web trainer for new riichi mahjong players, in the spirit of Riichi City's
in-app Academy. It teaches the ladder every beginner has to climb — read tiles →
form a legal hand → recognize yaku → count han → count fu → compute score — plus
tile efficiency, with a generated, auto-graded ten-question quiz at the end of
every lesson.

Available in **Bahasa Indonesia and English**, switchable from the nav.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine + generator test suite
npm run build    # static site into dist/
```

There is no backend. The built output is a static site, and progress lives in
the browser's `localStorage` — nothing leaves the machine.

## How it is put together

The important split is between the **engine** and the **UI**. Everything in
`src/engine/` is pure TypeScript with no React import anywhere, and every lesson,
drill, and explanation is derived from it.

| Module | What it does |
| --- | --- |
| `engine/tiles.ts` | Tile identity, standard notation (`123m456p`), count arrays |
| `engine/parse.ts` | Every valid decomposition of a hand, plus wait shapes |
| `engine/shanten.ts` | Shanten, tile acceptance (ukeire), discard ranking |
| `engine/yaku.ts` | Yaku detection with open-hand reduction and yakuman override |
| `engine/fu.ts` | Fu counting as labeled line items, including the exceptions |
| `engine/score.ts` | Han + fu → payments, limit tiers, honba and riichi sticks |
| `engine/explain.ts` | Picks the best-scoring reading and emits the full trace |
| `i18n/` | Turns engine ids into text, per language |

Three design decisions do most of the work:

**The engine emits ids, never prose.** `src/engine/` returns stable identifiers,
enums and numbers; every word a player reads is assembled in `src/i18n/`. This is
not just tidiness — drill grading compares answers, and while the engine produced
English the grading compared English. Translating the app would have marked every
answer wrong, silently. Two guard tests now make that unreintroducible: a static
scan of the engine source, and a runtime scan that walks real scored results to
catch strings built by concatenation.

**The engine returns reasoning, not just numbers.** `scoreHandFull` emits which
decomposition won, each yaku with its han, each fu component as a line item, and
the arithmetic behind the payment. The UI renders that trace directly, so a wrong
drill answer is explained using the player's own tiles rather than generic prose.

**Drills generate backwards from the answer.** A generator builds a hand that
exhibits the concept being taught, then runs the engine *forward* over it to
produce the answer key — so a generator can never drift out of agreement with the
scorer. Every question is seeded and reproducible, and grading keys off ids so it
is provably identical in both languages.

## Adding a language

`src/i18n/catalog/id.ts` is the source of truth for the key set; `en.ts` is
checked against it with `satisfies Messages`. Adding a key to one and forgetting
the other fails the build rather than rendering blank. The same holds for the
engine: adding a yaku or a fu reason makes it required in both catalogs, because
the sub-maps are typed `Record<YakuId, string>` and `Record<FuReasonKey, string>`.

Word order is a language property, so tile naming is a per-language template over
the engine's `TileDescriptor` rather than shared concatenation — `Red Five of
Bamboo` versus `Lima Bambu Merah`. Mahjong terms (riichi, tanyao, dora, tenpai,
han, fu) stay Japanese in both languages, because that is how players actually
speak.

## Ruleset

Open tanyao (kuitan) allowed, **kiriage mangan on** (4 han 30 fu and 3 han 60 fu
both round up to a mangan and pay 8000, not 7700), counted yakuman at 13 han.
Red fives are on and there are no double yakuman.

Kiriage is a threshold on the raw base rather than two special cases: 30 × 2^6
and 60 × 2^5 are both 1920, and 1920 is the only sub-mangan value the rule
promotes. See `KIRIAGE_BASE` in `engine/score.ts`.

## Tests

`npm test` covers the engine against the cases that are easy to get subtly wrong
and invisible in the UI: pinfu tsumo (20 fu) versus pinfu ron (30 fu), seven
pairs' fixed 25, a triplet completed by ron counting as open, ambiguous hands
that read as either runs or triplets, open-hand han reduction, yakuman
overriding dora, and the counted yakuman threshold. The drill generators are
swept across 120 seeds each, **in both languages**, to catch any question that
could be generated with no gradeable answer or with duplicate options.

Four guards are worth calling out, because they encode bugs that already
happened:

- **No prose in the engine** — a static scan of engine source plus a runtime scan
  of real scored results.
- **Identical grading across languages** — every generator, every seed, compared
  between Indonesian and English. This is the direct regression test for the
  grading-by-display-string bug.
- **Catalog parity** — same keys, no blanks, and matching `{param}` slots, which
  catches an interpolation dropped in translation before it ships as a literal
  `{n}` on the page.
- **Yaku samples** — every example hand on the reference page is run through the
  real detector. Two of the forty-two were wrong when first written; the test
  caught both.

## Credits

Tile artwork from [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles),
released into the public domain under CC0. The license is vendored alongside the
assets in `public/tiles/LICENSE.md`.
