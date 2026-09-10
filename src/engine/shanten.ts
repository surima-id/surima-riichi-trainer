/**
 * Shanten (distance from a ready hand) and ukeire (tile acceptance).
 *
 * Shanten counts how many tile swaps stand between a hand and tenpai:
 * -1 means the hand is already complete, 0 means tenpai, 1 means one away.
 * The three winning shapes are computed separately and the best one wins.
 *
 * This drives both the wait/tenpai lessons and the what-to-discard drills.
 */

import { HONOR_START, NUM_FACES, type Tile, face, toCounts } from './tiles'

const KOKUSHI_FACES = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]

/**
 * Best (lowest) shanten for the standard four-melds-plus-pair shape.
 *
 * Searches over meld sets, then over partial sets (pairs and half-runs), scoring
 * each with the usual formula. `melds` counts sets already called.
 */
function standardShanten(counts: number[], calledMelds: number): number {
  let best = 8

  const search = (start: number, melds: number, partials: number, hasPair: boolean): void => {
    // A hand can only use four blocks total; extra partials are dead weight.
    const usable = Math.min(partials, 4 - melds)
    const shanten = 8 - 2 * (melds + calledMelds) - usable - (hasPair && melds + usable < 5 ? 1 : 0)
    if (shanten < best) best = shanten
    if (melds + calledMelds + partials >= 5) return

    for (let i = start; i < NUM_FACES; i++) {
      if (counts[i] === 0) continue

      if (counts[i] >= 3) {
        counts[i] -= 3
        search(i, melds + 1, partials, hasPair)
        counts[i] += 3
      }
      if (i < HONOR_START && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
        counts[i]--
        counts[i + 1]--
        counts[i + 2]--
        search(i, melds + 1, partials, hasPair)
        counts[i]++
        counts[i + 1]++
        counts[i + 2]++
      }
      if (counts[i] >= 2) {
        counts[i] -= 2
        // The first pair found is the hand's pair; later ones are shanpon partials.
        search(i, melds, hasPair ? partials + 1 : partials, true)
        counts[i] += 2
      }
      if (i < HONOR_START && i % 9 <= 7 && counts[i + 1] > 0) {
        counts[i]--
        counts[i + 1]--
        search(i, melds, partials + 1, hasPair)
        counts[i]++
        counts[i + 1]++
      }
      if (i < HONOR_START && i % 9 <= 6 && counts[i + 2] > 0) {
        counts[i]--
        counts[i + 2]--
        search(i, melds, partials + 1, hasPair)
        counts[i]++
        counts[i + 2]++
      }
    }
  }

  search(0, 0, 0, false)
  return best
}

function chiitoitsuShanten(counts: readonly number[]): number {
  let pairs = 0
  let kinds = 0
  for (let i = 0; i < NUM_FACES; i++) {
    if (counts[i] === 0) continue
    kinds++
    if (counts[i] >= 2) pairs++
  }
  // With fewer than seven distinct tiles the hand must first draw new kinds.
  return 6 - pairs + Math.max(0, 7 - kinds)
}

function kokushiShanten(counts: readonly number[]): number {
  let kinds = 0
  let hasPair = false
  for (const f of KOKUSHI_FACES) {
    if (counts[f] > 0) kinds++
    if (counts[f] >= 2) hasPair = true
  }
  return 13 - kinds - (hasPair ? 1 : 0)
}

export interface ShantenBreakdown {
  shanten: number
  standard: number
  chiitoitsu: number
  kokushi: number
}

/**
 * Shanten for a concealed hand, with the per-shape numbers kept for the lesson
 * UI. `calledMelds` is how many sets the player has already called.
 *
 * The two special shapes are closed-only, so they are skipped once anything is
 * called.
 */
export function shantenOf(tiles: Tile[], calledMelds = 0): ShantenBreakdown {
  const counts = toCounts(tiles)
  const standard = standardShanten(counts, calledMelds)
  const closed = calledMelds === 0
  const chiitoi = closed ? chiitoitsuShanten(counts) : 99
  const thirteen = closed ? kokushiShanten(counts) : 99
  return {
    shanten: Math.min(standard, chiitoi, thirteen),
    standard,
    chiitoitsu: chiitoi,
    kokushi: thirteen,
  }
}

export function shanten(tiles: Tile[], calledMelds = 0): number {
  return shantenOf(tiles, calledMelds).shanten
}

export function isTenpai(tiles: Tile[], calledMelds = 0): boolean {
  return shanten(tiles, calledMelds) === 0
}

/**
 * The faces that would bring a hand closer to completion, with how many of each
 * remain unseen.
 *
 * `visible` is every tile the player can see (their own hand plus discards and
 * dora indicators, if the caller wants to model that); each occurrence removes
 * one of the four copies from the count.
 */
export function acceptance(
  tiles: Tile[],
  calledMelds = 0,
  visible: Tile[] = tiles,
): { faces: number[]; tilesLeft: number } {
  const current = shanten(tiles, calledMelds)
  const seen = toCounts(visible)
  const faces: number[] = []
  let tilesLeft = 0

  for (let f = 0; f < NUM_FACES; f++) {
    const remaining = 4 - seen[f]
    if (remaining <= 0) continue
    const next = shanten([...tiles, f], calledMelds)
    if (next < current) {
      faces.push(f)
      tilesLeft += remaining
    }
  }

  return { faces, tilesLeft }
}

/** The tiles that complete a tenpai hand. Empty if the hand is not tenpai. */
export function waits(tiles: Tile[], calledMelds = 0): number[] {
  if (!isTenpai(tiles, calledMelds)) return []
  return acceptance(tiles, calledMelds).faces
}

export interface DiscardOption {
  /** The tile discarded, as a face index. */
  tile: number
  /** Shanten of the hand that remains after the discard. */
  shanten: number
  /** Faces that improve the remaining hand. */
  faces: number[]
  /** How many of those tiles are still unseen — the number players optimize. */
  tilesLeft: number
}

/**
 * Ranks every legal discard from a 14-tile hand by tile acceptance.
 *
 * This is the answer key for the efficiency drills: lowest shanten first, then
 * most tiles accepted. Ties are left in tile order so the UI can group them.
 */
export function discardOptions(
  tiles: Tile[],
  calledMelds = 0,
  visible: Tile[] = tiles,
): DiscardOption[] {
  const options: DiscardOption[] = []
  const tried = new Set<number>()

  for (let i = 0; i < tiles.length; i++) {
    const f = face(tiles[i])
    if (tried.has(f)) continue
    tried.add(f)

    const remaining = [...tiles.slice(0, i), ...tiles.slice(i + 1)]
    const after = shanten(remaining, calledMelds)
    const { faces, tilesLeft } = acceptance(remaining, calledMelds, visible)
    options.push({ tile: f, shanten: after, faces, tilesLeft })
  }

  return options.sort((a, b) => a.shanten - b.shanten || b.tilesLeft - a.tilesLeft || a.tile - b.tile)
}
