/**
 * Yaku detection.
 *
 * A hand only scores if it has at least one yaku. This module takes one
 * decomposition plus the full game context and returns the yaku it exhibits,
 * with the han each is worth under that context.
 *
 * Two rules bite every naive implementation, and both are enforced here:
 *
 *  - A yakuman **replaces** everything. When one is present, normal yaku and
 *    dora are discarded, not added to it.
 *  - Opening the hand reduces some yaku by one han and disqualifies others
 *    entirely. That is handled per-yaku via `closedOnly` and `openHan`.
 */

import {
  type Decomposition,
  type Meld,
  type WaitInterpretation,
  decompositionTiles,
  meldFaces,
  meldIsAllTerminalOrHonor,
  meldIsTerminalOrHonor,
} from './parse'
import {
  CHUN,
  DRAGONS,
  EAST,
  HAKU,
  HATSU,
  HONOR_START,
  type Tile,
  type Wind,
  WINDS,
  doraFromIndicator,
  face,
  isGreen,
  isHonor,
  isRed,
  isSimple,
  isTerminal,
  isTerminalOrHonor,
} from './tiles'

/** Everything outside the tiles themselves that can affect the score. */
export interface WinContext {
  seatWind: Wind
  roundWind: Wind
  /** True when the hand has no open melds (a closed kan still counts as closed). */
  menzen: boolean
  tsumo: boolean
  riichi: boolean
  doubleRiichi: boolean
  ippatsu: boolean
  /** Won on the last drawn tile of the wall. */
  haitei: boolean
  /** Won by ron on the last discard. */
  houtei: boolean
  /** Won on the replacement tile after a kan. */
  rinshan: boolean
  /** Won by robbing a tile someone added to an open triplet. */
  chankan: boolean
  /** Dealt into by a discard on the very first uninterrupted go-around. */
  tenhou: boolean
  chiihou: boolean
  doraIndicators: Tile[]
  uraIndicators: Tile[]
}

export function defaultContext(overrides: Partial<WinContext> = {}): WinContext {
  return {
    seatWind: EAST,
    roundWind: EAST,
    menzen: true,
    tsumo: false,
    riichi: false,
    doubleRiichi: false,
    ippatsu: false,
    haitei: false,
    houtei: false,
    rinshan: false,
    chankan: false,
    tenhou: false,
    chiihou: false,
    doraIndicators: [],
    uraIndicators: [],
    ...overrides,
  }
}

export interface YakuResult {
  id: YakuId
  han: number
  /** Yakuman are counted in multiples rather than han. */
  yakuman?: number
}

/** Everything the detectors need about one candidate reading of the hand. */
interface Analysis {
  decomp: Decomposition
  wait: WaitInterpretation
  ctx: WinContext
  melds: Meld[]
  faces: number[]
  runs: Meld[]
  triplets: Meld[]
  /** Triplets and kans that were never exposed — the suuankou / fu-relevant set. */
  concealedTriplets: Meld[]
  suits: Set<string>
  hasHonor: boolean
  hasTerminal: boolean
}

/**
 * A triplet counts as concealed for suuankou and for fu only if the player
 * never revealed it. Completing a triplet by *ron* makes it open, because the
 * final tile came from another player — the single most-missed rule in fu.
 */
function isConcealedTriplet(meld: Meld, wait: WaitInterpretation, index: number, ctx: WinContext): boolean {
  if (meld.open || meld.called) return false
  if (wait.type === 'shanpon' && wait.meldIndex === index && !ctx.tsumo) return false
  return true
}

function analyze(decomp: Decomposition, wait: WaitInterpretation, ctx: WinContext): Analysis {
  const melds = decomp.melds
  const faces = decompositionTiles(decomp)
  const suits = new Set(faces.filter((f) => f < HONOR_START).map((f) => String(Math.floor(f / 9))))
  return {
    decomp,
    wait,
    ctx,
    melds,
    faces,
    runs: melds.filter((m) => m.kind === 'run'),
    triplets: melds.filter((m) => m.kind !== 'run'),
    concealedTriplets: melds.filter(
      (m, i) => m.kind !== 'run' && isConcealedTriplet(m, wait, i, ctx),
    ),
    suits,
    hasHonor: faces.some(isHonor),
    hasTerminal: faces.some(isTerminal),
  }
}

interface YakuDef {
  id: string
  /** Han when closed. Ignored for yakuman. */
  han: number
  /** Han when the hand is open; 0 means the yaku does not survive opening. */
  openHan?: number
  closedOnly?: boolean
  yakuman?: number
  test: (a: Analysis) => boolean
}

const isYakuhaiTile = (f: number, ctx: WinContext): boolean =>
  f === HAKU || f === HATSU || f === CHUN || f === ctx.seatWind || f === ctx.roundWind

/** How many yakuhai a triplet is worth — double East as seat *and* round wind is two. */
function yakuhaiValue(meld: Meld, ctx: WinContext): number {
  if (meld.kind === 'run') return 0
  const f = meld.tile
  let value = 0
  if (f === HAKU || f === HATSU || f === CHUN) value += 1
  if (f === ctx.seatWind) value += 1
  if (f === ctx.roundWind) value += 1
  return value
}

/** Runs that appear twice; the count drives iipeiko vs ryanpeikou. */
function identicalRunPairs(runs: Meld[]): number {
  const counts = new Map<number, number>()
  for (const run of runs) counts.set(run.tile, (counts.get(run.tile) ?? 0) + 1)
  let pairs = 0
  for (const n of counts.values()) pairs += Math.floor(n / 2)
  return pairs
}

function hasThreeSuitRuns(runs: Meld[]): boolean {
  const byRank = new Map<number, Set<number>>()
  for (const run of runs) {
    if (run.tile >= HONOR_START) continue
    const rank = run.tile % 9
    const suit = Math.floor(run.tile / 9)
    if (!byRank.has(rank)) byRank.set(rank, new Set())
    byRank.get(rank)!.add(suit)
  }
  return [...byRank.values()].some((suitSet) => suitSet.size === 3)
}

function hasThreeSuitTriplets(triplets: Meld[]): boolean {
  const byRank = new Map<number, Set<number>>()
  for (const meld of triplets) {
    if (meld.tile >= HONOR_START) continue
    const rank = meld.tile % 9
    const suit = Math.floor(meld.tile / 9)
    if (!byRank.has(rank)) byRank.set(rank, new Set())
    byRank.get(rank)!.add(suit)
  }
  return [...byRank.values()].some((suitSet) => suitSet.size === 3)
}

/** 123, 456 and 789 all in one suit. */
function hasStraight(runs: Meld[]): boolean {
  for (let suit = 0; suit < 3; suit++) {
    const base = suit * 9
    if (runs.some((r) => r.tile === base) && runs.some((r) => r.tile === base + 3) && runs.some((r) => r.tile === base + 6)) {
      return true
    }
  }
  return false
}

/**
 * Pinfu: closed, all runs, a non-yakuhai pair, and a two-sided wait. It is the
 * only yaku defined by earning *no* fu beyond the base.
 */
function isPinfu(a: Analysis): boolean {
  if (!a.ctx.menzen) return false
  if (a.decomp.kind !== 'standard') return false
  if (a.melds.some((m) => m.kind !== 'run')) return false
  if (isYakuhaiTile(a.decomp.pair, a.ctx)) return false
  return a.wait.type === 'ryanmen'
}

const YAKU = [
  // ---- Yakuman ----
  {
    id: 'kokushi',
    han: 13,
    yakuman: 1,
    closedOnly: true,
    test: (a) => a.decomp.kind === 'kokushi',
  },
  {
    id: 'suuankou',
    han: 13,
    yakuman: 1,
    closedOnly: true,
    test: (a) => a.decomp.kind === 'standard' && a.concealedTriplets.length === 4,
  },
  {
    id: 'daisangen',
    han: 13,
    yakuman: 1,
    test: (a) => DRAGONS.every((d) => a.triplets.some((m) => m.tile === d)),
  },
  {
    id: 'shousuushii',
    han: 13,
    yakuman: 1,
    test: (a) =>
      WINDS.filter((w) => a.triplets.some((m) => m.tile === w)).length === 3 &&
      (WINDS as readonly number[]).includes(a.decomp.pair),
  },
  {
    id: 'daisuushii',
    han: 13,
    yakuman: 2,
    test: (a) => WINDS.every((w) => a.triplets.some((m) => m.tile === w)),
  },
  {
    id: 'tsuuiisou',
    han: 13,
    yakuman: 1,
    test: (a) => a.faces.every(isHonor),
  },
  {
    id: 'chinroutou',
    han: 13,
    yakuman: 1,
    test: (a) => a.faces.every(isTerminal),
  },
  {
    id: 'ryuuiisou',
    han: 13,
    yakuman: 1,
    test: (a) => a.faces.every(isGreen),
  },
  {
    id: 'chuuren',
    han: 13,
    yakuman: 1,
    closedOnly: true,
    test: (a) => {
      if (a.decomp.kind !== 'standard' || a.suits.size !== 1 || a.hasHonor) return false
      const counts = new Array(9).fill(0)
      for (const f of a.faces) counts[f % 9]++
      const required = [3, 1, 1, 1, 1, 1, 1, 1, 3]
      let extra = 0
      for (let i = 0; i < 9; i++) {
        if (counts[i] < required[i]) return false
        extra += counts[i] - required[i]
      }
      return extra === 1
    },
  },
  {
    id: 'suukantsu',
    han: 13,
    yakuman: 1,
    test: (a) => a.melds.filter((m) => m.kind === 'kan').length === 4,
  },
  {
    id: 'tenhou',
    han: 13,
    yakuman: 1,
    closedOnly: true,
    test: (a) => a.ctx.tenhou,
  },
  {
    id: 'chiihou',
    han: 13,
    yakuman: 1,
    closedOnly: true,
    test: (a) => a.ctx.chiihou,
  },

  // ---- Situational ----
  { id: 'riichi', han: 1, closedOnly: true, test: (a) => a.ctx.riichi && !a.ctx.doubleRiichi },
  { id: 'double-riichi', han: 2, closedOnly: true, test: (a) => a.ctx.doubleRiichi },
  { id: 'ippatsu', han: 1, closedOnly: true, test: (a) => a.ctx.ippatsu && (a.ctx.riichi || a.ctx.doubleRiichi) },
  { id: 'menzen-tsumo', han: 1, closedOnly: true, test: (a) => a.ctx.tsumo },
  { id: 'haitei', han: 1, openHan: 1, test: (a) => a.ctx.haitei && a.ctx.tsumo },
  { id: 'houtei', han: 1, openHan: 1, test: (a) => a.ctx.houtei && !a.ctx.tsumo },
  { id: 'rinshan', han: 1, openHan: 1, test: (a) => a.ctx.rinshan },
  { id: 'chankan', han: 1, openHan: 1, test: (a) => a.ctx.chankan },

  // ---- Hand-shape yaku ----
  { id: 'pinfu', han: 1, closedOnly: true, test: isPinfu },
  {
    id: 'tanyao',
    han: 1,
    openHan: 1,
    test: (a) => a.faces.every(isSimple),
  },
  {
    id: 'yakuhai-haku',
    han: 1,
    openHan: 1,
    test: (a) => a.triplets.some((m) => m.tile === HAKU),
  },
  {
    id: 'yakuhai-hatsu',
    han: 1,
    openHan: 1,
    test: (a) => a.triplets.some((m) => m.tile === HATSU),
  },
  {
    id: 'yakuhai-chun',
    han: 1,
    openHan: 1,
    test: (a) => a.triplets.some((m) => m.tile === CHUN),
  },
  {
    id: 'yakuhai-seat',
    han: 1,
    openHan: 1,
    test: (a) => a.triplets.some((m) => m.tile === a.ctx.seatWind),
  },
  {
    id: 'yakuhai-round',
    han: 1,
    openHan: 1,
    test: (a) => a.triplets.some((m) => m.tile === a.ctx.roundWind),
  },
  {
    id: 'iipeiko',
    han: 1,
    closedOnly: true,
    test: (a) => identicalRunPairs(a.runs) === 1,
  },
  {
    id: 'chiitoitsu',
    han: 2,
    closedOnly: true,
    test: (a) => a.decomp.kind === 'chiitoitsu',
  },
  {
    id: 'sanshoku',
    han: 2,
    openHan: 1,
    test: (a) => hasThreeSuitRuns(a.runs),
  },
  {
    id: 'ittsuu',
    han: 2,
    openHan: 1,
    test: (a) => hasStraight(a.runs),
  },
  {
    id: 'chanta',
    han: 2,
    openHan: 1,
    test: (a) =>
      a.decomp.kind === 'standard' &&
      a.hasHonor &&
      isTerminalOrHonor(a.decomp.pair) &&
      a.melds.every(meldIsTerminalOrHonor),
  },
  {
    id: 'junchan',
    han: 3,
    openHan: 2,
    test: (a) =>
      a.decomp.kind === 'standard' &&
      !a.hasHonor &&
      isTerminal(a.decomp.pair) &&
      a.melds.every(meldIsTerminalOrHonor),
  },
  {
    id: 'toitoi',
    han: 2,
    openHan: 2,
    test: (a) => a.decomp.kind === 'standard' && a.triplets.length === 4,
  },
  {
    id: 'sanankou',
    han: 2,
    openHan: 2,
    test: (a) => a.concealedTriplets.length === 3,
  },
  {
    id: 'sankantsu',
    han: 2,
    openHan: 2,
    test: (a) => a.melds.filter((m) => m.kind === 'kan').length === 3,
  },
  {
    id: 'sanshoku-doukou',
    han: 2,
    openHan: 2,
    test: (a) => hasThreeSuitTriplets(a.triplets),
  },
  {
    id: 'shousangen',
    han: 2,
    openHan: 2,
    test: (a) =>
      DRAGONS.filter((d) => a.triplets.some((m) => m.tile === d)).length === 2 &&
      (DRAGONS as readonly number[]).includes(a.decomp.pair),
  },
  {
    id: 'honroutou',
    han: 2,
    openHan: 2,
    test: (a) => a.faces.every(isTerminalOrHonor) && !a.faces.every(isTerminal),
  },
  {
    id: 'ryanpeikou',
    han: 3,
    closedOnly: true,
    test: (a) => identicalRunPairs(a.runs) === 2,
  },
  {
    id: 'honitsu',
    han: 3,
    openHan: 2,
    test: (a) => a.suits.size === 1 && a.hasHonor,
  },
  {
    id: 'chinitsu',
    han: 6,
    openHan: 5,
    test: (a) => a.suits.size === 1 && !a.hasHonor,
  },
] as const satisfies readonly YakuDef[]

/**
 * The literal union of every yaku id. Deriving it from the array rather than
 * writing it out means a new yaku automatically becomes required in both
 * message catalogs — a missing translation fails the build, not the page.
 */
export type YakuId = (typeof YAKU)[number]['id']

/**
 * `as const` narrows each entry to exactly the fields it writes, which is what
 * gives us `YakuId` — but it also means optional fields vanish from entries
 * that omit them. Reading through a widened view restores them as optional.
 */
const YAKU_DEFS: readonly (Omit<YakuDef, 'id'> & { id: YakuId })[] = YAKU

export const YAKU_LIST = YAKU_DEFS.map(({ id, han, openHan, closedOnly, yakuman }) => ({
  id,
  han,
  openHan: closedOnly ? 0 : (openHan ?? 0),
  closedOnly: Boolean(closedOnly),
  yakuman: yakuman ?? 0,
}))

/**
 * Yaku that are strictly implied by a bigger one in the same hand. Scoring both
 * would double-count the same tiles.
 */
const SUPERSEDED: Partial<Record<YakuId, YakuId[]>> = {
  ryanpeikou: ['iipeiko', 'chiitoitsu'],
  junchan: ['chanta'],
  chinitsu: ['honitsu'],
  chinroutou: ['honroutou', 'toitoi'],
  tsuuiisou: ['honroutou', 'honitsu'],
  daisuushii: ['shousuushii'],
  suuankou: ['sanankou', 'toitoi'],
  daisangen: ['shousangen'],
  suukantsu: ['sankantsu'],
  'double-riichi': ['riichi'],
}

/** Dora, red fives, and ura dora. Never a yaku on its own. */
export function countDora(tiles: Tile[], ctx: WinContext): { dora: number; red: number; ura: number } {
  const doraFaces = ctx.doraIndicators.map(doraFromIndicator)
  const uraFaces = ctx.uraIndicators.map(doraFromIndicator)
  let dora = 0
  let red = 0
  let ura = 0
  for (const tile of tiles) {
    const f = face(tile)
    dora += doraFaces.filter((d) => d === f).length
    ura += uraFaces.filter((d) => d === f).length
    if (isRed(tile)) red++
  }
  return { dora, red, ura }
}

/**
 * Yaku for one specific reading of the hand.
 *
 * A hand with any yakuman scores *only* its yakuman; the caller must not add
 * dora on top.
 */
export function detectYaku(
  decomp: Decomposition,
  wait: WaitInterpretation,
  ctx: WinContext,
): YakuResult[] {
  const a = analyze(decomp, wait, ctx)
  const found: YakuResult[] = []

  for (const def of YAKU_DEFS) {
    if (def.closedOnly && !ctx.menzen) continue
    if (!def.test(a)) continue

    if (def.yakuman) {
      found.push({ id: def.id, han: 0, yakuman: def.yakuman })
      continue
    }

    const han = ctx.menzen ? def.han : (def.openHan ?? 0)
    if (han <= 0) continue

    // Yakuhai stack: East as both seat and round wind is worth two han, and the
    // two definitions above each fire once, which is exactly right.
    found.push({ id: def.id, han })
  }

  const yakumanPresent = found.some((y) => y.yakuman)
  let result = yakumanPresent ? found.filter((y) => y.yakuman) : found

  const ids = new Set(result.map((y) => y.id))
  const removed = new Set<YakuId>()
  for (const id of ids) {
    for (const lesser of SUPERSEDED[id] ?? []) removed.add(lesser)
  }
  result = result.filter((y) => !removed.has(y.id))

  return result
}

export function totalHan(yaku: YakuResult[]): number {
  return yaku.reduce((sum, y) => sum + y.han, 0)
}

export function totalYakuman(yaku: YakuResult[]): number {
  return yaku.reduce((sum, y) => sum + (y.yakuman ?? 0), 0)
}

export { yakuhaiValue, isYakuhaiTile, meldFaces, meldIsAllTerminalOrHonor }
