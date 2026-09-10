/**
 * Turning han and fu into points.
 *
 * Base points are `fu × 2^(2 + han)`, capped once the hand reaches mangan
 * territory, and each individual payment rounds up to the next 100. The dealer
 * pays and receives more: ×6 where a non-dealer is ×4.
 *
 * Ruleset: Tenhou / Riichi City standard — no kiriage mangan (a 4-han 30-fu
 * hand pays 7700, not 8000), kazoe yakuman at 13 han, no double yakuman.
 */

export type LimitName =
  | 'none'
  | 'mangan'
  | 'haneman'
  | 'baiman'
  | 'sanbaiman'
  | 'yakuman'
  | 'kazoe'

export interface ScoreInput {
  han: number
  fu: number
  dealer: boolean
  tsumo: boolean
  /** Multiples of yakuman; overrides han and fu entirely when above zero. */
  yakuman?: number
  honba?: number
  riichiSticks?: number
}

export interface ScoreResult {
  /** What the winner collects, including honba and riichi sticks. */
  total: number
  /** Ron: the single payment. Tsumo: 0 — see the two tsumo fields. */
  ronPayment: number
  /** Tsumo, non-dealer winner: what each non-dealer pays. */
  tsumoFromNonDealer: number
  /** Tsumo: what the dealer pays (0 when the dealer is the winner). */
  tsumoFromDealer: number
  basePoints: number
  limit: LimitName
  honbaBonus: number
  riichiBonus: number
}

/** Rounds a payment up to the next 100, as every riichi ruleset requires. */
function roundUp100(points: number): number {
  return Math.ceil(points / 100) * 100
}

/**
 * Base points before the dealer/tsumo multipliers.
 *
 * The named tiers replace the formula once a hand is big enough: mangan caps
 * the raw calculation at 2000, and each tier above is a fixed base.
 */
export function basePointsFor(han: number, fu: number): { base: number; limit: LimitName } {
  if (han >= 13) return { base: 8000, limit: 'kazoe' }
  if (han >= 11) return { base: 6000, limit: 'sanbaiman' }
  if (han >= 8) return { base: 4000, limit: 'baiman' }
  if (han >= 6) return { base: 3000, limit: 'haneman' }

  const raw = fu * Math.pow(2, 2 + han)
  if (han === 5 || raw >= 2000) return { base: 2000, limit: 'mangan' }
  return { base: raw, limit: 'none' }
}

export function scoreHand(input: ScoreInput): ScoreResult {
  const { han, fu, dealer, tsumo, honba = 0, riichiSticks = 0 } = input
  const yakuman = input.yakuman ?? 0

  const { base, limit } =
    yakuman > 0 ? { base: 8000 * yakuman, limit: 'yakuman' as LimitName } : basePointsFor(han, fu)

  let ronPayment = 0
  let tsumoFromNonDealer = 0
  let tsumoFromDealer = 0

  if (tsumo) {
    if (dealer) {
      // Each of the three opponents pays the same.
      tsumoFromNonDealer = roundUp100(base * 2)
    } else {
      tsumoFromNonDealer = roundUp100(base)
      tsumoFromDealer = roundUp100(base * 2)
    }
  } else {
    ronPayment = roundUp100(base * (dealer ? 6 : 4))
  }

  // Honba is 300 per counter, split three ways on a self-draw.
  const honbaBonus = honba * 300
  const riichiBonus = riichiSticks * 1000

  if (tsumo) {
    const perPlayer = honba * 100
    tsumoFromNonDealer += perPlayer
    if (tsumoFromDealer > 0) tsumoFromDealer += perPlayer
  } else {
    ronPayment += honbaBonus
  }

  const collected = tsumo
    ? dealer
      ? tsumoFromNonDealer * 3
      : tsumoFromNonDealer * 2 + tsumoFromDealer
    : ronPayment

  return {
    total: collected + riichiBonus,
    ronPayment,
    tsumoFromNonDealer,
    tsumoFromDealer,
    basePoints: base,
    limit,
    honbaBonus,
    riichiBonus,
  }
}

/**
 * The payment as structured data. A dealer self-draw reads "{n} all" in English
 * and "{n} semua" in Indonesian, so the joining word belongs to the UI.
 */
export type Payment =
  | { kind: 'ron'; amount: number }
  | { kind: 'tsumo-dealer'; each: number }
  | { kind: 'tsumo-nondealer'; each: number; fromDealer: number }

export function paymentOf(result: ScoreResult, tsumo: boolean, dealer: boolean): Payment {
  if (!tsumo) return { kind: 'ron', amount: result.ronPayment }
  if (dealer) return { kind: 'tsumo-dealer', each: result.tsumoFromNonDealer }
  return {
    kind: 'tsumo-nondealer',
    each: result.tsumoFromNonDealer,
    fromDealer: result.tsumoFromDealer,
  }
}

/** The han/fu grid the score lesson renders. */
export const FU_STEPS = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110] as const
export const HAN_STEPS = [1, 2, 3, 4] as const
