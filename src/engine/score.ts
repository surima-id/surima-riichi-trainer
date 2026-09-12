/**
 * Turning han and fu into points.
 *
 * Base points are `fu × 2^(2 + han)`, capped once the hand reaches mangan
 * territory, and each individual payment rounds up to the next 100. The dealer
 * pays and receives more: ×6 where a non-dealer is ×4.
 *
 * Ruleset: kiriage mangan is on — a hand whose raw base reaches 1920 rounds up
 * to a full mangan, so 4 han 30 fu and 3 han 60 fu pay 8000 rather than 7700.
 * Kazoe yakuman at 13 han, no double yakuman.
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
 * The raw base at which kiriage mangan rounds a hand up.
 *
 * Only two cells in the whole table land on 1920 — 4 han 30 fu and 3 han 60 fu,
 * since 30 × 2^6 and 60 × 2^5 are the same number — and they are exactly the two
 * kiriage promotes. The next cells down (4 han 25 fu and 3 han 50 fu) sit at
 * 1600 and are left alone, which is why this is a threshold rather than a pair
 * of special cases.
 */
export const KIRIAGE_BASE = 1920

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
  if (han === 5 || raw >= KIRIAGE_BASE) return { base: 2000, limit: 'mangan' }
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

/** What the winner collects in total, used to rank payments against each other. */
export function paymentValue(payment: Payment): number {
  switch (payment.kind) {
    case 'ron':
      return payment.amount
    case 'tsumo-dealer':
      return payment.each * 3
    case 'tsumo-nondealer':
      return payment.each * 2 + payment.fromDealer
  }
}

/** Identity for a payment, so two rows that pay the same are one row. */
export function paymentKey(payment: Payment): string {
  switch (payment.kind) {
    case 'ron':
      return `r${payment.amount}`
    case 'tsumo-dealer':
      return `d${payment.each}`
    case 'tsumo-nondealer':
      return `n${payment.each}/${payment.fromDealer}`
  }
}

/**
 * Whether a (han, fu) pair is a cell that exists on the scoring table.
 *
 * The low-fu corner is mostly empty. 20 fu is the pinfu shape, which earns no
 * fu at all beyond the base — and pinfu is closed, worth a han itself, and adds
 * a second on a self-draw, so the cell never appears below 2 han. 25 fu belongs
 * to chiitoitsu, which is 2 han before anything else is counted. Above 4 han
 * the fu stops mattering: every cell in the row is a mangan or better.
 */
function cellExists(han: number, fu: number): boolean {
  if (fu === 20 || fu === 25) return han >= 2
  return han >= 1
}

/**
 * Every payment that actually appears on the scoring table, ascending.
 *
 * This is the pool the scoring drill draws its wrong answers from. Scaling the
 * right answer by a factor was the obvious way to do it and the wrong one: a
 * quarter of 1300 rounds to "300/400", and a quarter of a small tsumo lands on
 * "100/100" — figures no hand pays and no player has ever said out loud, so an
 * option carrying one is eliminated without reading the hand. Every row here is
 * a cell a real hand can land on, which is what makes the wrong ones tempting.
 */
export function paymentTable(dealer: boolean, tsumo: boolean): Payment[] {
  const rows: Payment[] = []
  const seen = new Set<string>()

  const add = (input: Omit<ScoreInput, 'dealer' | 'tsumo'>) => {
    const payment = paymentOf(scoreHand({ ...input, dealer, tsumo }), tsumo, dealer)
    const key = paymentKey(payment)
    if (seen.has(key)) return
    seen.add(key)
    rows.push(payment)
  }

  // Up to kazoe. Above 4 han the fu is irrelevant, but the loop is left to run
  // over it anyway — those rows collapse onto one another and `seen` drops them.
  for (let han = 1; han <= 13; han++) {
    for (const fu of FU_STEPS) {
      if (!cellExists(han, fu)) continue
      add({ han, fu })
    }
  }
  // A true yakuman, and the double the four big winds pays.
  for (const yakuman of [1, 2]) add({ han: 0, fu: 0, yakuman })

  return rows.sort((a, b) => paymentValue(a) - paymentValue(b))
}

/**
 * The table rows on either side of `payment`, nearest first.
 *
 * Neighbours rather than random rows: a miscount of a han or a fu step lands a
 * player one or two rows away, so these are the answers a hand that was read
 * *almost* right produces.
 */
export function neighbourPayments(payment: Payment, dealer: boolean, tsumo: boolean): Payment[] {
  const target = paymentValue(payment)
  const key = paymentKey(payment)
  return paymentTable(dealer, tsumo)
    .filter((row) => paymentKey(row) !== key)
    .sort((a, b) => Math.abs(paymentValue(a) - target) - Math.abs(paymentValue(b) - target))
}
