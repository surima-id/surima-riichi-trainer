/**
 * Fu counting.
 *
 * Fu are the "minor points" that, together with han, set a hand's value. The
 * rules are a pile of small additions with a handful of hard-coded exceptions,
 * and those exceptions are exactly what the fu lesson has to teach — so this
 * module returns every addition as a labeled line item rather than a bare total.
 */

import { type Decomposition, type Meld, type WaitInterpretation, type WaitType } from './parse'
import { type WinContext } from './yaku'
import { HONOR_START, isTerminalOrHonor } from './tiles'

/**
 * Why a fu line item exists, as data rather than a sentence.
 *
 * The UI turns these into text, so the same breakdown reads correctly in any
 * language and the "detail" line is composed from the very same parameters
 * instead of being duplicated as prose.
 */
export type FuReason =
  | { key: 'base' }
  | { key: 'menzen-ron' }
  | { key: 'tsumo' }
  | { key: 'chiitoitsu' }
  | { key: 'kokushi' }
  | { key: 'pinfu-tsumo' }
  | {
      key: 'meld'
      meld: 'triplet' | 'kan'
      concealed: boolean
      tileClass: 'simple' | 'terminal-honor'
      /** Face index, so the UI can name the tile. */
      tile: number
    }
  | {
      key: 'value-pair'
      tile: number
      /** Why the pair scores — a double wind carries two entries. */
      sources: ReadonlyArray<'dragon' | 'seat-wind' | 'round-wind'>
    }
  | { key: 'wait'; wait: WaitType }

export type FuReasonKey = FuReason['key']

export interface FuItem {
  reason: FuReason
  fu: number
}

export interface FuResult {
  /** Rounded up to the next 10, except chiitoitsu's fixed 25. */
  total: number
  /** Before rounding, so the lesson can show the rounding step. */
  raw: number
  items: FuItem[]
}

const BASE_FU = 20
const CHIITOITSU_FU = 25

function meldFu(meld: Meld, concealed: boolean): FuItem {
  const terminalOrHonor = isTerminalOrHonor(meld.tile)

  // Base 2 for an open simple triplet; concealed doubles it, terminal/honor
  // doubles it, and a kan quadruples it.
  let fu = 2
  if (concealed) fu *= 2
  if (terminalOrHonor) fu *= 2
  if (meld.kind === 'kan') fu *= 4

  return {
    fu,
    reason: {
      key: 'meld',
      meld: meld.kind === 'kan' ? 'kan' : 'triplet',
      concealed,
      tileClass: terminalOrHonor ? 'terminal-honor' : 'simple',
      tile: meld.tile,
    },
  }
}

/**
 * A triplet counts as concealed only if the player never revealed it. Winning
 * a shanpon (dual-triplet) wait by *ron* makes that triplet open, because the
 * last tile came from someone else.
 */
function tripletIsConcealed(
  meld: Meld,
  index: number,
  wait: WaitInterpretation,
  ctx: WinContext,
): boolean {
  if (meld.open || (meld.called && meld.kind !== 'kan')) return false
  if (meld.called && meld.kind === 'kan') return true // declared closed kan
  if (wait.type === 'shanpon' && wait.meldIndex === index && !ctx.tsumo) return false
  return true
}

/**
 * Fu for one reading of the hand.
 *
 * `pinfu` must be passed in because pinfu is defined *by* its fu (a hand that
 * earns nothing beyond the base), so the yaku and the fu count are mutually
 * dependent and the caller resolves the cycle.
 */
export function countFu(
  decomp: Decomposition,
  wait: WaitInterpretation,
  ctx: WinContext,
  pinfu: boolean,
): FuResult {
  // Seven pairs is a flat 25 and never rounds.
  if (decomp.kind === 'chiitoitsu') {
    return {
      total: CHIITOITSU_FU,
      raw: CHIITOITSU_FU,
      items: [{ reason: { key: 'chiitoitsu' }, fu: CHIITOITSU_FU }],
    }
  }

  // Thirteen orphans is scored as a yakuman, so its fu never reaches a payment
  // table. 25 keeps the display honest without implying a han/fu lookup.
  if (decomp.kind === 'kokushi') {
    return {
      total: CHIITOITSU_FU,
      raw: CHIITOITSU_FU,
      items: [{ reason: { key: 'kokushi' }, fu: CHIITOITSU_FU }],
    }
  }

  // Pinfu is pinned by rule: 20 on a self-draw, 30 on a discard. Left to the
  // general rules it would come out as 22 and 30.
  if (pinfu) {
    if (ctx.tsumo) {
      return {
        total: 20,
        raw: 20,
        items: [{ reason: { key: 'pinfu-tsumo' }, fu: 20 }],
      }
    }
    return {
      total: 30,
      raw: 30,
      items: [
        { reason: { key: 'base' }, fu: BASE_FU },
        { reason: { key: 'menzen-ron' }, fu: 10 },
      ],
    }
  }

  const items: FuItem[] = [{ reason: { key: 'base' }, fu: BASE_FU }]

  if (ctx.menzen && !ctx.tsumo) {
    items.push({ reason: { key: 'menzen-ron' }, fu: 10 })
  }
  if (ctx.tsumo) {
    items.push({ reason: { key: 'tsumo' }, fu: 2 })
  }

  decomp.melds.forEach((meld, index) => {
    if (meld.kind === 'run') return
    items.push(meldFu(meld, tripletIsConcealed(meld, index, wait, ctx)))
  })

  const pair = pairFu(decomp.pair, ctx)
  if (pair.fu > 0) {
    items.push({
      reason: { key: 'value-pair', tile: decomp.pair, sources: pair.sources },
      fu: pair.fu,
    })
  }

  if (wait.type !== 'ryanmen' && wait.type !== 'shanpon') {
    items.push({ reason: { key: 'wait', wait: wait.type }, fu: 2 })
  }

  const raw = items.reduce((sum, item) => sum + item.fu, 0)
  let total = Math.ceil(raw / 10) * 10

  // An open hand that happens to be all-runs earns nothing beyond the base but
  // cannot claim pinfu, so it is floored at 30 rather than paying out at 20.
  if (!ctx.menzen && total === 20) total = 30

  return { total, raw, items }
}

/**
 * The pair scores 2 fu for a dragon or a wind that matches the seat or round.
 * A double wind (East seat in East round) is 4 under the Tenhou rules used
 * here, so the sources are returned alongside the value — that is what lets the
 * lesson say *why* a pair was worth 4 rather than 2.
 */
function pairFu(
  pairFace: number,
  ctx: WinContext,
): { fu: number; sources: ReadonlyArray<'dragon' | 'seat-wind' | 'round-wind'> } {
  if (pairFace < HONOR_START) return { fu: 0, sources: [] }
  const sources: Array<'dragon' | 'seat-wind' | 'round-wind'> = []
  if (pairFace >= HONOR_START + 4) sources.push('dragon')
  if (pairFace === ctx.seatWind) sources.push('seat-wind')
  if (pairFace === ctx.roundWind) sources.push('round-wind')
  return { fu: sources.length * 2, sources }
}
