/**
 * Hand recipes: build options that reliably produce a named yaku.
 *
 * The plain builder deals four random melds, which is fine for a 1-2 han hand
 * and hopeless above it. Measured over 1500 seeds it produced tanyao, pinfu,
 * iipeiko and the yakuhai and little else — chanta, ittsuu, toitoi, sanankou,
 * honitsu and chinitsu each landed under 1% of the time, and junchan,
 * ryanpeikou and every yakuman literally never. Nearly half of all hands came
 * out at 1 han and 87% never reached even a mangan. A player drilling han
 * counting therefore practised "1 or 2" and met the same three hands wearing
 * different tiles.
 *
 * So the shapes chance will not deal are asked for. Each recipe constrains the
 * builder just enough to make its yaku near-certain and leaves the rest random,
 * so two hands from one recipe still differ. Nothing here asserts what a hand
 * is worth: the recipe biases the tiles and the engine scores whatever comes
 * out, so a chinitsu recipe that also happens to deal ittsuu is a better
 * question rather than a broken one.
 */

import {
  DRAGONS,
  HONOR_START,
  SOU_START,
  WINDS,
  isGreen,
  isSimple,
  isTerminal,
  isTerminalOrHonor,
} from '../engine/tiles'
import { type BuildOptions, RUN_STARTS } from './hands'
import { type Rng } from './random'

const SUIT_STARTS = [0, 9, 18]
const inSuit = (suit: number) => (f: number) => f >= SUIT_STARTS[suit] && f < SUIT_STARTS[suit] + 9

/** A run contains a terminal exactly when it starts at 1 or at 7. */
const isTerminalRunStart = (start: number) => start % 9 === 0 || start % 9 === 6

export interface Recipe {
  id: string
  /** Options, given the rng so a recipe can pick its own suit, rank or dragon. */
  build: (rng: Rng) => BuildOptions
  /** Yaku that do not survive being opened, so the hand must stay closed. */
  closedOnly?: boolean
  /**
   * The yaku ids this recipe is claiming to produce, when they are not just
   * `id`. The test suite asserts each recipe actually lands one of these often
   * enough to be worth having — a recipe that silently stopped working would
   * otherwise show up only as the han distribution quietly sagging again.
   */
  yaku?: string[]
}

/** The yaku a recipe claims, for the test that checks it delivers them. */
export function recipeYaku(recipe: Recipe): string[] {
  return recipe.yaku ?? [recipe.id]
}

/**
 * The ordinary yaku, grouped by roughly what they are worth closed.
 *
 * The bands are what the counting drills sample from, so a session walks the
 * whole range instead of clustering at the bottom. They are a rough guide and
 * not a promise: dora, riichi and a self-draw ride on top, and a hand often
 * carries a second yaku the recipe never asked for.
 */
export const RECIPES: Record<'small' | 'medium' | 'large', Recipe[]> = {
  // 1-2 han before dora and the situational yaku.
  small: [
    { id: 'tanyao', build: () => ({ tileFilter: isSimple, triplets: 0 }) },
    {
      id: 'pinfu',
      build: () => ({
        triplets: 0,
        // A yakuhai pair disqualifies pinfu; a simple pair never can.
        pairFilter: isSimple,
      }),
    },
    {
      id: 'yakuhai',
      build: (rng) => ({ fixedTriplets: [rng.pick(DRAGONS)], triplets: 1 }),
      // The engine names this by which dragon it is, not by the family.
      yaku: ['yakuhai-haku', 'yakuhai-hatsu', 'yakuhai-chun'],
    },
    {
      id: 'iipeiko',
      build: (rng) => {
        // The same run, named twice. The other two melds stay random, so the
        // hand is a normal one that happens to hold a repeated run rather than
        // an obviously manufactured shape.
        const start = rng.pick(RUN_STARTS)
        return { triplets: 0, fixedRuns: [start, start] }
      },
      closedOnly: true,
    },
  ],

  // 2-4 han: the shape yaku a player has to look for deliberately.
  medium: [
    {
      id: 'sanshoku',
      build: (rng) => {
        // The same three ranks in all three suits, named outright. A rank
        // filter would have allowed the builder to take the same suit twice,
        // which is three runs and no sanshoku.
        const rank = rng.int(7)
        return { triplets: 1, fixedRuns: [rank, rank + 9, rank + 18] }
      },
    },
    {
      id: 'ittsuu',
      build: (rng) => {
        const base = SUIT_STARTS[rng.int(3)]
        // 123, 456 and 789 of one suit, named: a filter over those three starts
        // would let the builder take 123 twice and never reach the straight.
        return { triplets: 1, fixedRuns: [base, base + 3, base + 6] }
      },
    },
    {
      id: 'toitoi',
      // Simples only. Unconstrained, four random triplets kept drifting into
      // honors and terminals and coming out a honitsu or honroutou worth nine
      // han, which is a fine hand but not the one this band is for.
      build: () => ({ triplets: 4, tileFilter: isSimple }),
    },
    {
      id: 'sanankou',
      build: () => ({ triplets: 3, openMelds: 0 }),
      closedOnly: true,
    },
    {
      id: 'chanta',
      build: () => ({
        // Every meld must *contain* a terminal or honor. For a run that means
        // starting at 1 or 7; for a triplet and the pair, being one outright.
        triplets: 2,
        runStartFilter: isTerminalRunStart,
        tripletFilter: isTerminalOrHonor,
        pairFilter: isTerminalOrHonor,
      }),
    },
    {
      id: 'junchan',
      build: () => ({
        // Chanta with the honors taken away, which is the whole difference.
        triplets: 2,
        runStartFilter: isTerminalRunStart,
        tripletFilter: isTerminal,
        pairFilter: isTerminal,
      }),
    },
    {
      id: 'honitsu',
      build: (rng) => {
        const suit = rng.int(3)
        const ok = (f: number) => inSuit(suit)(f) || f >= HONOR_START
        return {
          triplets: 2,
          tileFilter: ok,
          tripletFilter: ok,
          pairFilter: ok,
          runStartFilter: (s) => inSuit(suit)(s) && s % 9 <= 6,
        }
      },
    },
    {
      id: 'shousangen',
      build: (rng) => {
        // Two dragon triplets with the third as the pair: the little three
        // dragons, which also carries both of those dragons' own yakuhai.
        const [a, b, c] = rng.shuffle([...DRAGONS])
        return { fixedTriplets: [a, b], fixedPair: c, triplets: 2 }
      },
    },
    {
      id: 'sanshoku-doukou',
      build: (rng) => {
        // One rank as a triplet in each suit, named for the same reason.
        const rank = rng.int(9)
        return { triplets: 3, fixedTriplets: [rank, rank + 9, rank + 18] }
      },
    },
  ],

  // 5 han and up, as far as the counted yakuman.
  large: [
    {
      id: 'chinitsu',
      build: (rng) => {
        const ok = inSuit(rng.int(3))
        return {
          triplets: rng.int(3),
          tileFilter: ok,
          tripletFilter: ok,
          pairFilter: ok,
          runStartFilter: (s) => ok(s) && s % 9 <= 6,
        }
      },
    },
    {
      id: 'ryanpeikou',
      build: (rng) => {
        // Two runs, each held twice — every meld slot spoken for.
        const [a, b] = rng.shuffle(RUN_STARTS).slice(0, 2)
        return { triplets: 0, fixedRuns: [a, a, b, b] }
      },
      closedOnly: true,
    },
    {
      id: 'honroutou',
      build: () => ({
        // Terminals and honors only, necessarily all in triplets — honroutou
        // never comes alone, it arrives welded to toitoi and usually sanankou,
        // which is why it sits in this band rather than at its nominal 2 han.
        triplets: 4,
        tileFilter: isTerminalOrHonor,
        tripletFilter: isTerminalOrHonor,
        pairFilter: isTerminalOrHonor,
      }),
      yaku: ['honroutou', 'toitoi'],
    },
    {
      id: 'chinroutou-near',
      build: () => ({
        // All terminals: chinroutou when it lands, and honroutou stacked with
        // toitoi and sanankou when the pair falls on an honor instead. Either
        // way a haneman or better, which is what this band is for.
        triplets: 4,
        tripletFilter: isTerminal,
        pairFilter: isTerminal,
      }),
      yaku: ['chinroutou', 'toitoi'],
    },
    {
      id: 'honitsu-toitoi',
      build: (rng) => {
        // One suit plus honors, all in triplets: honitsu and toitoi together,
        // usually with sanankou and often honroutou on top.
        const suit = rng.int(3)
        const ok = (f: number) => inSuit(suit)(f) || f >= HONOR_START
        return { triplets: 4, tileFilter: ok, tripletFilter: ok, pairFilter: ok }
      },
      yaku: ['honitsu', 'toitoi'],
    },
  ],
}

/**
 * The yakuman, each named tile by tile.
 *
 * These are the hands randomness cannot reach: "all four winds" and "all three
 * dragons" are single points in a space of millions, and the drills went their
 * whole life never once showing one. A learner who has read the yakuman chapter
 * should meet them, so they are constructed outright rather than waited for.
 *
 * Kokushi and chuuren are absent: neither is four melds and a pair, so the meld
 * builder cannot express them. `buildThirteenOrphans` handles kokushi.
 */
export const YAKUMAN_RECIPES: Recipe[] = [
  { id: 'daisangen', build: () => ({ fixedTriplets: [...DRAGONS], triplets: 3 }) },
  { id: 'daisuushii', build: () => ({ fixedTriplets: [...WINDS], triplets: 4 }) },
  {
    id: 'shousuushii',
    build: (rng) => {
      const winds = rng.shuffle([...WINDS])
      return { fixedTriplets: winds.slice(0, 3), fixedPair: winds[3], triplets: 3 }
    },
  },
  {
    id: 'tsuuiisou',
    build: () => {
      // All honors. Seven honor faces, four melds and a pair — necessarily
      // toitoi shaped, since honors cannot form runs.
      const ok = (f: number) => f >= HONOR_START
      return { triplets: 4, tileFilter: ok, tripletFilter: ok, pairFilter: ok }
    },
  },
  {
    id: 'chinroutou',
    build: () => ({
      triplets: 4,
      tileFilter: isTerminal,
      tripletFilter: isTerminal,
      pairFilter: isTerminal,
    }),
  },
  {
    id: 'ryuuiisou',
    build: (rng) => ({
      // The green tiles: 2,3,4,6,8 of bamboo, plus Hatsu. Only 234 and 678 lie
      // wholly inside that set, and with just five green ranks and a three-copy
      // cap the triplets crowd the runs out — so the runs are named and the
      // rest left to fill in around them.
      triplets: 2,
      fixedRuns: rng.next() < 0.5 ? [SOU_START + 1] : [SOU_START + 5],
      tileFilter: isGreen,
      tripletFilter: isGreen,
      pairFilter: isGreen,
    }),
  },
  {
    id: 'suuankou',
    build: () => ({ triplets: 4, openMelds: 0 }),
    closedOnly: true,
  },
]
