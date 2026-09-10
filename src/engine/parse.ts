/**
 * Hand decomposition.
 *
 * A winning hand is four melds plus a pair, with two special shapes
 * (chiitoitsu, kokushi musou) that follow different rules. Crucially, one set of
 * tiles can often be read as a hand in more than one way — `111222333m` is
 * three triplets *or* three runs, and only one of those readings scores best —
 * so this module returns **every** valid decomposition and leaves the choice to
 * the scorer.
 */

import {
  HONOR_START,
  NUM_FACES,
  type Tile,
  face,
  isHonor,
  isTerminalOrHonor,
  toCounts,
} from './tiles'

export type MeldKind = 'run' | 'triplet' | 'kan'
export type CallKind = 'chi' | 'pon' | 'ankan' | 'minkan'

/** A meld the player called, or a closed kan they declared. */
export interface Call {
  kind: CallKind
  /** Face index; the lowest tile of the run for a chi. */
  tile: number
  /** The actual tiles, kept so red fives still count as dora. */
  tiles: Tile[]
}

export interface Meld {
  kind: MeldKind
  /** Face index; the lowest tile of the run for a run. */
  tile: number
  /** Visible to other players — a chi, pon, or open kan. A closed kan is not open. */
  open: boolean
  /** Came from a `Call` rather than from the concealed portion of the hand. */
  called: boolean
}

export type DecompositionKind = 'standard' | 'chiitoitsu' | 'kokushi'

export interface Decomposition {
  kind: DecompositionKind
  /** Four melds for a standard hand; empty for the two special shapes. */
  melds: Meld[]
  /** Face index of the pair. For kokushi this is the doubled terminal/honor. */
  pair: number
  /** The seven face indices, for chiitoitsu only. */
  pairs?: number[]
}

/** A hand as presented for scoring. `concealed` includes the winning tile. */
export interface Hand {
  concealed: Tile[]
  calls: Call[]
  winTile: Tile
}

export type WaitType = 'ryanmen' | 'penchan' | 'kanchan' | 'shanpon' | 'tanki'

/** One reading of how the winning tile completed the hand. */
export interface WaitInterpretation {
  type: WaitType
  /** Index into `Decomposition.melds`, or -1 when the wait was on the pair. */
  meldIndex: number
}

export function isMenzen(calls: readonly Call[]): boolean {
  return calls.every((call) => call.kind === 'ankan')
}

function callToMeld(call: Call): Meld {
  switch (call.kind) {
    case 'chi':
      return { kind: 'run', tile: call.tile, open: true, called: true }
    case 'pon':
      return { kind: 'triplet', tile: call.tile, open: true, called: true }
    case 'ankan':
      return { kind: 'kan', tile: call.tile, open: false, called: true }
    case 'minkan':
      return { kind: 'kan', tile: call.tile, open: true, called: true }
  }
}

/**
 * Enumerates every way to peel `needed` melds out of `counts`.
 *
 * Always consumes the lowest remaining tile before moving on, which keeps the
 * generated meld lists in a canonical order and bounds the branching.
 */
function collectMelds(
  counts: number[],
  start: number,
  needed: number,
  acc: Meld[],
  out: Meld[][],
): void {
  if (needed === 0) {
    if (counts.every((n) => n === 0)) out.push([...acc])
    return
  }

  let i = start
  while (i < NUM_FACES && counts[i] === 0) i++
  if (i >= NUM_FACES) return

  if (counts[i] >= 3) {
    counts[i] -= 3
    acc.push({ kind: 'triplet', tile: i, open: false, called: false })
    collectMelds(counts, i, needed - 1, acc, out)
    acc.pop()
    counts[i] += 3
  }

  // Runs only exist in the numbered suits, and may not straddle a suit boundary.
  const withinSuit = i < HONOR_START && i % 9 <= 6
  if (withinSuit && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i]--
    counts[i + 1]--
    counts[i + 2]--
    acc.push({ kind: 'run', tile: i, open: false, called: false })
    collectMelds(counts, i, needed - 1, acc, out)
    acc.pop()
    counts[i]++
    counts[i + 1]++
    counts[i + 2]++
  }
}

/** Every standard (4 melds + pair) reading of a concealed count array. */
export function decomposeStandard(counts: number[], neededMelds: number): Decomposition[] {
  const results: Decomposition[] = []
  const seen = new Set<string>()

  for (let pair = 0; pair < NUM_FACES; pair++) {
    if (counts[pair] < 2) continue
    counts[pair] -= 2

    const meldSets: Meld[][] = []
    collectMelds(counts, 0, neededMelds, [], meldSets)
    for (const melds of meldSets) {
      const key = `${pair}|${melds.map((m) => `${m.kind}${m.tile}`).join(',')}`
      if (seen.has(key)) continue
      seen.add(key)
      results.push({ kind: 'standard', melds, pair })
    }

    counts[pair] += 2
  }

  return results
}

function chiitoitsu(counts: readonly number[]): Decomposition | null {
  const pairs: number[] = []
  for (let i = 0; i < NUM_FACES; i++) {
    if (counts[i] === 0) continue
    // Four of a kind is two pairs by count, but chiitoitsu requires seven
    // *distinct* pairs, so it disqualifies the hand.
    if (counts[i] !== 2) return null
    pairs.push(i)
  }
  return pairs.length === 7 ? { kind: 'chiitoitsu', melds: [], pair: pairs[0], pairs } : null
}

const KOKUSHI_FACES = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]

function kokushi(counts: readonly number[]): Decomposition | null {
  let doubled = -1
  for (let i = 0; i < NUM_FACES; i++) {
    if (counts[i] === 0) continue
    if (!KOKUSHI_FACES.includes(i)) return null
    if (counts[i] === 2) {
      if (doubled !== -1) return null
      doubled = i
    } else if (counts[i] !== 1) {
      return null
    }
  }
  if (doubled === -1) return null
  const distinct = KOKUSHI_FACES.every((f) => counts[f] > 0)
  return distinct ? { kind: 'kokushi', melds: [], pair: doubled } : null
}

/**
 * Every valid reading of a complete hand, or an empty array if the tiles do not
 * form a winning shape.
 */
export function decompose(hand: Hand): Decomposition[] {
  const counts = toCounts(hand.concealed)
  const callMelds = hand.calls.map(callToMeld)
  const neededMelds = 4 - callMelds.length
  if (neededMelds < 0) return []

  const expectedConcealed = neededMelds * 3 + 2
  if (hand.concealed.length !== expectedConcealed) return []

  const results: Decomposition[] = []

  for (const decomp of decomposeStandard(counts, neededMelds)) {
    results.push({ ...decomp, melds: [...callMelds, ...decomp.melds] })
  }

  // The special shapes are closed-hand-only by definition.
  if (callMelds.length === 0) {
    const seven = chiitoitsu(counts)
    if (seven) results.push(seven)
    const thirteen = kokushi(counts)
    if (thirteen) results.push(thirteen)
  }

  return results
}

export function isWinningHand(hand: Hand): boolean {
  return decompose(hand).length > 0
}

/**
 * How the winning tile could have completed this decomposition.
 *
 * A hand often admits several readings — `234m` waiting on 2 or 5 with the 3m
 * and 4m already down — and they can differ in fu, so the scorer tries each.
 */
export function waitInterpretations(
  decomp: Decomposition,
  winTile: Tile,
): WaitInterpretation[] {
  const win = face(winTile)
  const results: WaitInterpretation[] = []
  const seen = new Set<string>()

  const add = (type: WaitType, meldIndex: number) => {
    const key = `${type}:${meldIndex}`
    if (seen.has(key)) return
    seen.add(key)
    results.push({ type, meldIndex })
  }

  if (decomp.kind === 'chiitoitsu' || decomp.kind === 'kokushi') {
    return [{ type: 'tanki', meldIndex: -1 }]
  }

  if (decomp.pair === win) add('tanki', -1)

  decomp.melds.forEach((meld, index) => {
    // A called meld was completed before the win, so it can never be the wait.
    if (meld.called) return

    if (meld.kind === 'triplet' && meld.tile === win) {
      add('shanpon', index)
      return
    }
    if (meld.kind !== 'run') return

    const offset = win - meld.tile
    if (offset === 1) {
      add('kanchan', index)
    } else if (offset === 0 || offset === 2) {
      const rank = (meld.tile % 9) + 1
      // 123 waiting on the 3, and 789 waiting on the 7, are closed at one end.
      const penchan = (rank === 1 && offset === 2) || (rank === 7 && offset === 0)
      add(penchan ? 'penchan' : 'ryanmen', index)
    }
  })

  return results
}

/** All tiles in a decomposition, expanded — used for dora and tile-class checks. */
export function decompositionTiles(decomp: Decomposition): number[] {
  if (decomp.kind === 'chiitoitsu') {
    return (decomp.pairs ?? []).flatMap((f) => [f, f])
  }
  if (decomp.kind === 'kokushi') {
    return [...KOKUSHI_FACES, decomp.pair]
  }
  const tiles: number[] = [decomp.pair, decomp.pair]
  for (const meld of decomp.melds) {
    if (meld.kind === 'run') {
      tiles.push(meld.tile, meld.tile + 1, meld.tile + 2)
    } else {
      const n = meld.kind === 'kan' ? 4 : 3
      for (let i = 0; i < n; i++) tiles.push(meld.tile)
    }
  }
  return tiles
}

/** The distinct face indices a meld covers. */
export function meldFaces(meld: Meld): number[] {
  return meld.kind === 'run' ? [meld.tile, meld.tile + 1, meld.tile + 2] : [meld.tile]
}

export function meldIsTerminalOrHonor(meld: Meld): boolean {
  return meldFaces(meld).some(isTerminalOrHonor)
}

export function meldIsAllTerminalOrHonor(meld: Meld): boolean {
  return meldFaces(meld).every(isTerminalOrHonor)
}

export function meldHasHonor(meld: Meld): boolean {
  return meldFaces(meld).some(isHonor)
}
