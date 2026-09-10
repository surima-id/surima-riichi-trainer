/**
 * Random hand construction.
 *
 * Drills generate *backwards from the answer*: build a hand that exhibits the
 * concept being taught, then run the engine forward over it to get the answer
 * key. That way a generator can never disagree with the scorer.
 */

import { type Call, type Hand } from '../engine/parse'
import {
  DRAGONS,
  HONOR_START,
  type Tile,
  WINDS,
  isSimple,
  isTerminalOrHonor,
} from '../engine/tiles'
import { scoreHandFull } from '../engine/explain'
import { type WinContext, defaultContext } from '../engine/yaku'
import { type Rng } from './random'

/** A run's lowest tile, for every legal run in the numbered suits. */
const RUN_STARTS: number[] = []
for (let suit = 0; suit < 3; suit++) {
  for (let rank = 0; rank <= 6; rank++) RUN_STARTS.push(suit * 9 + rank)
}

const ALL_FACES = Array.from({ length: 34 }, (_, i) => i)

/** Tracks how many copies of each tile are still available while building. */
export class TileSupply {
  private used = new Array(34).fill(0)

  take(faceIndex: number, count: number): boolean {
    if (this.used[faceIndex] + count > 4) return false
    this.used[faceIndex] += count
    return true
  }

  canTake(faceIndex: number, count: number): boolean {
    return this.used[faceIndex] + count <= 4
  }

  release(faceIndex: number, count: number): void {
    this.used[faceIndex] -= count
  }
}

export interface BuiltHand {
  hand: Hand
  context: WinContext
  dealer: boolean
}

interface BuildOptions {
  /** Constrains every tile in the hand, e.g. to simples for a tanyao drill. */
  tileFilter?: (faceIndex: number) => boolean
  /** Forces this many triplets rather than runs. */
  triplets?: number
  /** Melds to expose as calls, taken from the generated melds. */
  openMelds?: number
  context?: Partial<WinContext>
}

/**
 * Builds a random complete hand: four melds plus a pair, respecting the
 * four-copies-per-tile limit.
 *
 * Returns null when the constraints cannot be satisfied, which the callers
 * handle by retrying with a fresh seed rather than by loosening the rules.
 */
export function buildRandomHand(rng: Rng, options: BuildOptions = {}): BuiltHand | null {
  const { tileFilter = () => true, triplets = -1, openMelds = 0 } = options
  const supply = new TileSupply()

  const tripletCount = triplets >= 0 ? triplets : rng.int(3)
  const meldTiles: Tile[][] = []
  const meldKinds: ('run' | 'triplet')[] = []

  const runStarts = RUN_STARTS.filter((start) =>
    [start, start + 1, start + 2].every(tileFilter),
  )
  const tripletFaces = ALL_FACES.filter(tileFilter)

  for (let i = 0; i < 4; i++) {
    const wantTriplet = i < tripletCount
    let placed = false

    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      if (wantTriplet) {
        const f = rng.pick(tripletFaces)
        if (!supply.canTake(f, 3)) continue
        supply.take(f, 3)
        meldTiles.push([f, f, f])
        meldKinds.push('triplet')
      } else {
        if (runStarts.length === 0) return null
        const start = rng.pick(runStarts)
        if (![0, 1, 2].every((o) => supply.canTake(start + o, 1))) continue
        for (const o of [0, 1, 2]) supply.take(start + o, 1)
        meldTiles.push([start, start + 1, start + 2])
        meldKinds.push('run')
      }
      placed = true
    }
    if (!placed) return null
  }

  // The pair, from whatever is left.
  let pairFace = -1
  for (let attempt = 0; attempt < 60 && pairFace < 0; attempt++) {
    const f = rng.pick(tripletFaces)
    if (supply.canTake(f, 2)) {
      supply.take(f, 2)
      pairFace = f
    }
  }
  if (pairFace < 0) return null

  // Expose the requested number of melds as calls. Runs become chi, triplets pon.
  const calls: Call[] = []
  for (let i = 0; i < openMelds && i < 4; i++) {
    const tiles = meldTiles[i]
    calls.push({
      kind: meldKinds[i] === 'run' ? 'chi' : 'pon',
      tile: tiles[0],
      tiles,
    })
  }

  const concealedMelds = meldTiles.slice(openMelds)
  const concealed: Tile[] = [...concealedMelds.flat(), pairFace, pairFace]

  // The winning tile has to come from the concealed portion, or the hand would
  // have been complete before the win.
  const winTile = concealed[rng.int(concealed.length)]

  const context = defaultContext({ menzen: calls.length === 0, ...options.context })
  return {
    hand: { concealed, calls, winTile },
    context,
    dealer: context.seatWind === WINDS[0],
  }
}

/**
 * Builds a hand that actually scores, retrying with fresh randomness until the
 * engine agrees it is a legal win. Generators call this so a drill never poses
 * a yakuless hand by accident.
 */
export function buildScoringHand(
  rng: Rng,
  options: BuildOptions = {},
  attempts = 60,
): BuiltHand | null {
  for (let i = 0; i < attempts; i++) {
    const built = buildRandomHand(rng, options)
    if (!built) continue
    const scored = scoreHandFull(built.hand, built.context, { dealer: built.dealer })
    if (scored.valid) return built
  }
  return null
}

export const SIMPLE_FACES = ALL_FACES.filter(isSimple)
export const TERMINAL_HONOR_FACES = ALL_FACES.filter(isTerminalOrHonor)
export const HONOR_FACES = ALL_FACES.filter((f) => f >= HONOR_START)
export const YAKUHAI_FACES = [...DRAGONS]
export { ALL_FACES }
