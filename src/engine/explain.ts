/**
 * Scoring a hand end to end, with a trace of how the answer was reached.
 *
 * This is the module the whole app talks to. A hand often has several valid
 * readings that score differently, so this tries every (decomposition, wait)
 * pair and keeps the one worth the most — which is what the rules require, and
 * also what makes drills honest: the answer key is whatever the player could
 * legitimately claim.
 *
 * The returned `ScoredHand` carries the reasoning, not just the number, so the
 * UI can explain a wrong answer using the player's own tiles.
 */

import {
  type Decomposition,
  type Hand,
  type WaitInterpretation,
  decompose,
  isMenzen,
  waitInterpretations,
} from './parse'
import { type FuResult, countFu } from './fu'
import { type ScoreResult, scoreHand } from './score'
import {
  type WinContext,
  type YakuResult,
  countDora,
  detectYaku,
  totalHan,
  totalYakuman,
} from './yaku'
import { type Tile, EAST, doraFromIndicator, face } from './tiles'

export interface DoraBreakdown {
  dora: number
  red: number
  ura: number
  total: number
}

/** Why a hand does not score. A code, so the UI can say it in any language. */
export type InvalidReason = 'incomplete' | 'no-yaku'

export interface ScoredHand {
  /** False when the tiles do not form a winning shape, or the hand has no yaku. */
  valid: boolean
  /** Why the hand does not score, when `valid` is false. */
  reason?: InvalidReason
  decomposition: Decomposition
  wait: WaitInterpretation
  yaku: YakuResult[]
  dora: DoraBreakdown
  /** Yaku han plus dora. Zero when the hand is a yakuman. */
  han: number
  yakuman: number
  fu: FuResult
  score: ScoreResult
  context: WinContext
}

function emptyResult(reason: InvalidReason, ctx: WinContext): ScoredHand {
  return {
    valid: false,
    reason,
    decomposition: { kind: 'standard', melds: [], pair: 0 },
    wait: { type: 'tanki', meldIndex: -1 },
    yaku: [],
    dora: { dora: 0, red: 0, ura: 0, total: 0 },
    han: 0,
    yakuman: 0,
    fu: { total: 0, raw: 0, items: [] },
    score: scoreHand({ han: 0, fu: 0, dealer: false, tsumo: false }),
    context: ctx,
  }
}

/** Every tile in the hand, including those inside called melds. */
export function allTiles(hand: Hand): Tile[] {
  return [...hand.concealed, ...hand.calls.flatMap((call) => call.tiles)]
}

/**
 * Scores a hand. `dealer` is separate from the context's seat wind because a
 * lesson may want to pose a dealer hand without committing to East seat.
 */
export function scoreHandFull(
  hand: Hand,
  ctx: WinContext,
  options: { dealer?: boolean; honba?: number; riichiSticks?: number } = {},
): ScoredHand {
  const dealer = options.dealer ?? ctx.seatWind === EAST
  const decompositions = decompose(hand)
  if (decompositions.length === 0) {
    return emptyResult('incomplete', ctx)
  }

  // The context's `menzen` is derived from the calls rather than trusted, so a
  // caller cannot accidentally claim closed-only yaku on an open hand.
  const context: WinContext = { ...ctx, menzen: isMenzen(hand.calls) }
  const tiles = allTiles(hand)
  const doraCount = countDora(tiles, context)
  const uraCount = context.riichi || context.doubleRiichi ? doraCount.ura : 0
  const dora: DoraBreakdown = {
    dora: doraCount.dora,
    red: doraCount.red,
    ura: uraCount,
    total: doraCount.dora + doraCount.red + uraCount,
  }

  let best: ScoredHand | null = null

  for (const decomp of decompositions) {
    for (const wait of waitInterpretations(decomp, hand.winTile)) {
      const candidate = scoreCandidate(decomp, wait, context, dora, dealer, options)
      if (!candidate.valid) continue
      if (!best || isBetter(candidate, best)) best = candidate
    }
  }

  if (!best) {
    return emptyResult('no-yaku', context)
  }
  return best
}

function scoreCandidate(
  decomp: Decomposition,
  wait: WaitInterpretation,
  ctx: WinContext,
  dora: DoraBreakdown,
  dealer: boolean,
  options: { honba?: number; riichiSticks?: number },
): ScoredHand {
  const yaku = detectYaku(decomp, wait, ctx)
  if (yaku.length === 0) {
    return { ...emptyResult('no-yaku', ctx), decomposition: decomp, wait }
  }

  const yakuman = totalYakuman(yaku)
  const pinfu = yaku.some((y) => y.id === 'pinfu')
  const fu = countFu(decomp, wait, ctx, pinfu)

  // Dora ride on top of a normal hand but are irrelevant to a yakuman.
  const han = yakuman > 0 ? 0 : totalHan(yaku) + dora.total

  const score = scoreHand({
    han,
    fu: fu.total,
    dealer,
    tsumo: ctx.tsumo,
    yakuman,
    honba: options.honba,
    riichiSticks: options.riichiSticks,
  })

  return {
    valid: true,
    decomposition: decomp,
    wait,
    yaku,
    dora,
    han,
    yakuman,
    fu,
    score,
    context: ctx,
  }
}

/**
 * Ranks two readings of the same tiles. Total value decides; fu breaks a tie,
 * which matters for hands that score the same han in two different shapes.
 */
function isBetter(a: ScoredHand, b: ScoredHand): boolean {
  if (a.yakuman !== b.yakuman) return a.yakuman > b.yakuman
  if (a.score.total !== b.score.total) return a.score.total > b.score.total
  if (a.han !== b.han) return a.han > b.han
  return a.fu.total > b.fu.total
}

/** Convenience for lessons and tests that work in notation rather than objects. */
export function buildHand(concealed: Tile[], winTile: Tile, calls: Hand['calls'] = []): Hand {
  return { concealed, calls, winTile }
}

/** True when `tile` is one of the hand's dora, for highlighting in the UI. */
export function isDoraTile(tile: Tile, ctx: WinContext): boolean {
  const f = face(tile)
  return ctx.doraIndicators.some((indicator) => doraFromIndicator(indicator) === f)
}
