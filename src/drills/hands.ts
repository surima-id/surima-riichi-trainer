/**
 * Random hand construction.
 *
 * Drills generate *backwards from the answer*: build a hand that exhibits the
 * concept being taught, then run the engine forward over it to get the answer
 * key. That way a generator can never disagree with the scorer.
 */

import { type Call, type Hand, isMenzen } from '../engine/parse'
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

/**
 * Tracks how many copies of each tile are still available while building.
 *
 * `limit` is four by default — the real supply — but drills build with three.
 * See `BuildOptions.maxCopies` for why.
 */
export class TileSupply {
  private used = new Array(34).fill(0)
  private readonly limit: number

  constructor(limit = 4) {
    this.limit = limit
  }

  /**
   * `limit` overrides this supply's usual ceiling for one take, never rising
   * above the four copies that physically exist. A kan is the reason: it needs
   * a fourth copy of its face in a hand that is otherwise capped at three.
   */
  take(faceIndex: number, count: number, limit = this.limit): boolean {
    if (!this.canTake(faceIndex, count, limit)) return false
    this.used[faceIndex] += count
    return true
  }

  canTake(faceIndex: number, count: number, limit = this.limit): boolean {
    return this.used[faceIndex] + count <= Math.min(limit, 4)
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
  /**
   * Melds to declare as kans rather than triplets.
   *
   * A kan is four copies of a tile standing where a meld would, and it is the
   * one shape whose fu a player cannot work out from the triplet rules alone:
   * it quadruples rather than doubles, so a concealed kan of terminals is 32 fu
   * where the triplet is 8. The fu drill asks for hands with one so that number
   * actually gets practised.
   *
   * Whether each kan is closed or open follows `openMelds`, which is also what
   * the rules do: an open kan is a call off another player's discard, a closed
   * one is declared from the hand and leaves it closed.
   */
  kans?: number
  /**
   * The most copies of any one tile a hand may hold. Three by default.
   *
   * Four copies of a tile is legal but is the hardest shape a beginner meets:
   * the fourth tile splits across a triplet and a run (`1112223m` holding four
   * 2m), and the hand has several readings that score differently. Drills are
   * for teaching the ordinary case, so they build from three copies and leave
   * the four-copy puzzle out of the question pool entirely. Raise it to four
   * for a hand that is deliberately about that shape.
   */
  maxCopies?: number
  context?: Partial<WinContext>
}

/**
 * Builds a random complete hand: four melds plus a pair, respecting the
 * per-tile copy limit (`maxCopies`, three by default).
 *
 * Returns null when the constraints cannot be satisfied, which the callers
 * handle by retrying with a fresh seed rather than by loosening the rules.
 */
export function buildRandomHand(rng: Rng, options: BuildOptions = {}): BuiltHand | null {
  const { tileFilter = () => true, triplets = -1, openMelds = 0, kans = 0, maxCopies = 3 } = options
  const supply = new TileSupply(maxCopies)

  // Kans are triplets with a fourth tile, so they come out of the triplet
  // budget; asking for more kans than triplets simply raises that budget.
  const tripletCount = Math.max(triplets >= 0 ? triplets : rng.int(3), kans)
  const meldTiles: Tile[][] = []
  const meldKinds: ('run' | 'triplet' | 'kan')[] = []

  const runStarts = RUN_STARTS.filter((start) =>
    [start, start + 1, start + 2].every(tileFilter),
  )
  const tripletFaces = ALL_FACES.filter(tileFilter)

  for (let i = 0; i < 4; i++) {
    const wantTriplet = i < tripletCount
    // Kans are placed first so they land in the slots `openMelds` exposes,
    // which is what lets a caller ask for an open kan rather than a closed one.
    const wantKan = i < kans
    let placed = false

    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      if (wantKan) {
        // A kan needs all four copies, so it overrides the usual three-copy cap
        // — that fourth tile is the whole point of the shape.
        const f = rng.pick(tripletFaces)
        if (!supply.take(f, 4, 4)) continue
        meldTiles.push([f, f, f, f])
        meldKinds.push('kan')
      } else if (wantTriplet) {
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

  /**
   * Expose melds as calls. Runs become chi and triplets pon, while a kan is
   * always a call whether or not it is open: four tiles cannot sit in the
   * thirteen-tile concealed portion, so even a closed kan is declared on the
   * table as an `ankan` and the hand stays closed around it.
   */
  const calls: Call[] = []
  for (let i = 0; i < 4; i++) {
    const kind = meldKinds[i]
    const open = i < openMelds
    if (kind !== 'kan' && !open) continue
    const tiles = meldTiles[i]
    calls.push({
      kind: kind === 'kan' ? (open ? 'minkan' : 'ankan') : kind === 'run' ? 'chi' : 'pon',
      tile: tiles[0],
      tiles,
    })
  }

  const concealedMelds = meldTiles.filter((_, i) => meldKinds[i] !== 'kan' && i >= openMelds)
  const concealed: Tile[] = [...concealedMelds.flat(), pairFace, pairFace]

  // The winning tile has to come from the concealed portion, or the hand would
  // have been complete before the win.
  const winTile = concealed[rng.int(concealed.length)]

  // Derived rather than assumed: a closed kan is a call but leaves the hand
  // closed, so counting calls would wrongly strip a riichi hand of menzen.
  const context = defaultContext({ menzen: isMenzen(calls), ...options.context })
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
