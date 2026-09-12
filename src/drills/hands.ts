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
  face,
  isSimple,
  isTerminalOrHonor,
  makeTile,
} from '../engine/tiles'
import { scoreHandFull } from '../engine/explain'
import { type WinContext, defaultContext } from '../engine/yaku'
import { type Rng } from './random'

/** A run's lowest tile, for every legal run in the numbered suits. */
export const RUN_STARTS: number[] = []
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

export interface BuildOptions {
  /** Constrains every tile in the hand, e.g. to simples for a tanyao drill. */
  tileFilter?: (faceIndex: number) => boolean
  /**
   * Per-slot constraints, applied on top of `tileFilter`.
   *
   * Chanta is why these exist. It wants every meld to *contain* a terminal or
   * honor, which permits the runs 123 and 789 — but a `tileFilter` of
   * terminal-or-honor rejects the 2 in the middle of 123 and so bans runs
   * outright, turning every chanta attempt into honroutou. Constraining the
   * run by its starting rank, and the triplets and pair by their own tile,
   * expresses the actual rule.
   */
  runStartFilter?: (startFace: number) => boolean
  tripletFilter?: (faceIndex: number) => boolean
  pairFilter?: (faceIndex: number) => boolean
  /**
   * Runs that must appear, each named by its lowest tile and placed before
   * anything random. Repeat a start to ask for that run twice.
   *
   * A filter cannot express these. Iipeiko is "the same run twice", and
   * confining every run to one start says "as many copies of one run as there
   * are run slots" — four, which needs four copies of each tile and so never
   * built at all. Sanshoku wants one rank across three *different* suits, and a
   * rank filter lets the builder pick the same suit twice. Both are a list of
   * runs rather than a property of a run.
   */
  fixedRuns?: number[]
  /**
   * Faces that must appear as triplets, placed before anything random.
   *
   * The big-honor yakuman are defined by naming specific tiles — all three
   * dragons, all four winds — and no amount of filtered randomness reliably
   * deals them. See `YAKUMAN_RECIPES`.
   */
  fixedTriplets?: number[]
  /** The face the pair must be, for the shapes that specify it (shousuushii). */
  fixedPair?: number
  /**
   * How many fives to turn red, supply permitting.
   *
   * A red five is a dora that is not read off an indicator, and it is the most
   * common way a real hand gains a han. Leaving it out of the generated hands
   * meant the dora line of a breakdown only ever moved for one reason.
   */
  redFives?: number
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
  const {
    tileFilter = () => true,
    triplets = -1,
    openMelds = 0,
    kans = 0,
    maxCopies = 3,
    fixedTriplets = [],
    fixedRuns = [],
    fixedPair = -1,
    redFives = 0,
  } = options
  const supply = new TileSupply(maxCopies)

  // Named triplets come out of the triplet budget, as kans do: all three are a
  // meld slot that is not a run.
  const wantedTriplets = triplets >= 0 ? triplets : rng.int(3)
  const tripletCount = Math.max(wantedTriplets, kans, fixedTriplets.length)
  if (tripletCount + fixedRuns.length > 4) return null
  const meldTiles: Tile[][] = []
  const meldKinds: ('run' | 'triplet' | 'kan')[] = []

  // Slot filters narrow `tileFilter` rather than replacing it, so a recipe can
  // say "simples, and the pair specifically a dragon" without restating both.
  const runStartOk = options.runStartFilter
    ?? ((start: number) => [start, start + 1, start + 2].every(tileFilter))
  const tripletOk = options.tripletFilter ?? tileFilter
  const pairOk = options.pairFilter ?? tileFilter

  const runStarts = RUN_STARTS.filter(runStartOk)
  const tripletFaces = ALL_FACES.filter(tripletOk)
  const pairFaces = ALL_FACES.filter(pairOk)

  /**
   * The named triplets are reserved up front, before any random meld can spend
   * their tiles. Daisuushii needs all four winds and `maxCopies` is three, so a
   * random triplet that happened to take a wind would leave the recipe
   * unsatisfiable — and the retry loop would simply burn its attempts.
   */
  for (const f of fixedTriplets) {
    if (!supply.take(f, 3)) return null
  }
  for (const start of fixedRuns) {
    if (![0, 1, 2].every((o) => supply.take(start + o, 1))) return null
  }
  if (fixedPair >= 0 && !supply.take(fixedPair, 2)) return null

  for (let i = 0; i < 4; i++) {
    // Slot order is: named triplets, then kans, then random triplets, then
    // runs. Kans sit ahead of the random triplets so they land in the slots
    // `openMelds` exposes, which is what lets a caller ask for an open kan.
    const fixed = i < fixedTriplets.length ? fixedTriplets[i] : -1
    // Named runs fill the slots at the far end, so they never collide with the
    // triplets, kans and calls that all count from the front.
    const fixedRun = i >= 4 - fixedRuns.length ? fixedRuns[i - (4 - fixedRuns.length)] : -1
    const wantKan = fixed < 0 && fixedRun < 0 && i < fixedTriplets.length + kans
    const wantTriplet = fixedRun < 0 && i < tripletCount
    let placed = false

    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      if (fixed >= 0) {
        // Already reserved above, so this slot cannot fail.
        meldTiles.push([fixed, fixed, fixed])
        meldKinds.push('triplet')
      } else if (fixedRun >= 0) {
        meldTiles.push([fixedRun, fixedRun + 1, fixedRun + 2])
        meldKinds.push('run')
      } else if (wantKan) {
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
  let pairFace = fixedPair
  for (let attempt = 0; attempt < 60 && pairFace < 0; attempt++) {
    const f = rng.pick(pairFaces)
    if (supply.canTake(f, 2)) {
      supply.take(f, 2)
      pairFace = f
    }
  }
  if (pairFace < 0) return null

  /**
   * Flip fives to red.
   *
   * Done here, over the finished meld list, rather than while placing tiles:
   * only three red fives exist — one per suit — so the choice is "which fives
   * in this hand", which is not known until the hand is built. Each suit can
   * give up at most one, and the flip is by reference into `meldTiles` so the
   * same tile is red wherever it is read from.
   *
   * The pair is left out: it is stored as one face drawn twice, so flipping it
   * would deal two red fives of the same suit, and only one of each exists.
   */
  if (redFives > 0) {
    const fiveSlots: [number, number][] = []
    meldTiles.forEach((tiles, meld) => {
      tiles.forEach((tile, i) => {
        if (face(tile) % 9 === 4 && face(tile) < HONOR_START) fiveSlots.push([meld, i])
      })
    })
    const usedSuits = new Set<number>()
    let flipped = 0
    for (const [meld, i] of rng.shuffle(fiveSlots)) {
      if (flipped >= redFives) break
      const suit = Math.floor(face(meldTiles[meld][i]) / 9)
      if (usedSuits.has(suit)) continue
      usedSuits.add(suit)
      meldTiles[meld][i] = makeTile(face(meldTiles[meld][i]), true)
      flipped++
    }
  }

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
      // A face index, never the tile: `tiles[0]` may be a red five, and the red
      // bit set here would make the meld parse as a face that does not exist.
      tile: face(tiles[0]),
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

/** The thirteen terminals and honors kokushi is built from. */
const KOKUSHI_FACES = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]

/**
 * Thirteen orphans, which the meld builder cannot express.
 *
 * Every other hand in the app is four melds and a pair, and this is thirteen
 * singles with one of them doubled — there is no meld in it at all. It is built
 * directly rather than by constraining the general builder, because there is
 * nothing to constrain: the tile list is fixed and the only free choice is
 * which orphan is the pair.
 */
export function buildThirteenOrphans(rng: Rng, context: Partial<WinContext> = {}): BuiltHand {
  const doubled = rng.pick(KOKUSHI_FACES)
  const concealed = [...KOKUSHI_FACES, doubled]
  const ctx = defaultContext({ menzen: true, ...context })
  return {
    hand: { concealed, calls: [], winTile: doubled },
    context: ctx,
    dealer: ctx.seatWind === WINDS[0],
  }
}

export const SIMPLE_FACES = ALL_FACES.filter(isSimple)
export const TERMINAL_HONOR_FACES = ALL_FACES.filter(isTerminalOrHonor)
export const HONOR_FACES = ALL_FACES.filter((f) => f >= HONOR_START)
export const YAKUHAI_FACES = [...DRAGONS]
export { ALL_FACES }
