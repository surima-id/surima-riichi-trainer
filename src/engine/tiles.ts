/**
 * Tile identity, notation, and the count-array representation.
 *
 * A tile is packed into a single number so the hand algorithms (which allocate
 * heavily) stay cheap:
 *
 *   bits 0-5  face index, 0..33
 *   bit  6    red-five flag
 *
 * Face indices are ordered so that a suit's nine tiles are contiguous, which is
 * what makes run detection in parse.ts a simple `i, i+1, i+2` check:
 *
 *   0..8    1m..9m
 *   9..17   1p..9p
 *   18..26  1s..9s
 *   27..33  East, South, West, North, Haku, Hatsu, Chun
 */

export type Tile = number
export type Suit = 'm' | 'p' | 's' | 'z'

export const NUM_FACES = 34
const RED_BIT = 64

export const MAN_START = 0
export const PIN_START = 9
export const SOU_START = 18
export const HONOR_START = 27

export const EAST = 27
export const SOUTH = 28
export const WEST = 29
export const NORTH = 30
export const HAKU = 31
export const HATSU = 32
export const CHUN = 33

/** Wind face indices in seat order, so `WINDS[0]` is East. */
export const WINDS = [EAST, SOUTH, WEST, NORTH] as const
export const DRAGONS = [HAKU, HATSU, CHUN] as const

export type Wind = (typeof WINDS)[number]

/** Strips the red flag, leaving the 0..33 face index. */
export function face(tile: Tile): number {
  return tile & 63
}

export function isRed(tile: Tile): boolean {
  return (tile & RED_BIT) !== 0
}

export function makeTile(faceIndex: number, red = false): Tile {
  return red ? faceIndex | RED_BIT : faceIndex
}

export function suitOf(tile: Tile): Suit {
  const f = face(tile)
  if (f < PIN_START) return 'm'
  if (f < SOU_START) return 'p'
  if (f < HONOR_START) return 's'
  return 'z'
}

/** Rank 1..9 for suited tiles, 1..7 for honors (East=1 .. Chun=7). */
export function rankOf(tile: Tile): number {
  const f = face(tile)
  if (f >= HONOR_START) return f - HONOR_START + 1
  return (f % 9) + 1
}

export function isHonor(tile: Tile): boolean {
  return face(tile) >= HONOR_START
}

export function isWind(tile: Tile): boolean {
  const f = face(tile)
  return f >= EAST && f <= NORTH
}

export function isDragon(tile: Tile): boolean {
  const f = face(tile)
  return f >= HAKU && f <= CHUN
}

/** Terminal = a 1 or 9 of a numbered suit. Honors are *not* terminals. */
export function isTerminal(tile: Tile): boolean {
  if (isHonor(tile)) return false
  const r = rankOf(tile)
  return r === 1 || r === 9
}

/** Terminal-or-honor, the class that scores extra fu and gates chanta/junchan. */
export function isTerminalOrHonor(tile: Tile): boolean {
  return isHonor(tile) || isTerminal(tile)
}

/** Simple = 2..8 of a numbered suit. The tanyao class. */
export function isSimple(tile: Tile): boolean {
  return !isTerminalOrHonor(tile)
}

/** True when `tile` is a green tile, for ryuuiisou. */
export function isGreen(tile: Tile): boolean {
  const f = face(tile)
  if (f === HATSU) return true
  if (f < SOU_START || f >= HONOR_START) return false
  return [2, 3, 4, 6, 8].includes(rankOf(tile))
}

/** The tile a dora indicator points at; wraps within its own suit/group. */
export function doraFromIndicator(indicator: Tile): number {
  const f = face(indicator)
  if (f >= HAKU) return f === CHUN ? HAKU : f + 1
  if (f >= EAST) return f === NORTH ? EAST : f + 1
  const base = Math.floor(f / 9) * 9
  return base + ((f - base + 1) % 9)
}

const SUIT_STARTS: Record<Suit, number> = { m: MAN_START, p: PIN_START, s: SOU_START, z: HONOR_START }

/** Stable ids for the seven honors — the naming key, not the display text. */
export const HONOR_IDS = ['east', 'south', 'west', 'north', 'haku', 'hatsu', 'chun'] as const
export type HonorId = (typeof HONOR_IDS)[number]

/**
 * A tile broken into its naming parts.
 *
 * Languages disagree about word order — "Red Five of Bamboo" versus "Lima
 * Bambu Merah" — so the engine hands out the parts and lets each language's
 * template assemble them. Building the string here would bake English in.
 */
export type TileDescriptor =
  | { kind: 'honor'; honor: HonorId }
  | { kind: 'suited'; suit: 'm' | 'p' | 's'; rank: number; red: boolean }

export function honorIdOf(tile: Tile): HonorId {
  return HONOR_IDS[face(tile) - HONOR_START]
}

export function describeTile(tile: Tile): TileDescriptor {
  if (isHonor(tile)) return { kind: 'honor', honor: honorIdOf(tile) }
  return {
    kind: 'suited',
    suit: suitOf(tile) as 'm' | 'p' | 's',
    rank: rankOf(tile),
    red: isRed(tile),
  }
}

/**
 * Parses standard notation: digits followed by a suit letter, e.g.
 * `123m456p789s11z`. A `0` in a numbered suit is the red five, matching the
 * Tenhou convention (`0m` = red 5m).
 *
 * Throws on malformed input; callers that take user text should catch.
 */
export type NotationErrorCode =
  | 'unexpected-char'
  | 'suit-without-digits'
  | 'honor-out-of-range'
  | 'trailing-digits'
  | 'expected-one-tile'

/**
 * A notation problem, carrying a code rather than a message. The UI turns the
 * code into text in the reader's language.
 */
export class NotationError extends Error {
  readonly code: NotationErrorCode
  readonly params: Record<string, string | number>

  constructor(code: NotationErrorCode, params: Record<string, string | number> = {}) {
    super(code)
    this.name = 'NotationError'
    this.code = code
    this.params = params
  }
}

export function parseTiles(notation: string): Tile[] {
  const tiles: Tile[] = []
  let pending: number[] = []

  for (const ch of notation) {
    if (ch === ' ' || ch === ',' || ch === '-') continue
    if (ch >= '0' && ch <= '9') {
      pending.push(ch.charCodeAt(0) - 48)
      continue
    }
    if (ch !== 'm' && ch !== 'p' && ch !== 's' && ch !== 'z') {
      throw new NotationError('unexpected-char', { char: ch })
    }
    if (pending.length === 0) {
      throw new NotationError('suit-without-digits', { char: ch })
    }
    const suit = ch as Suit
    for (const digit of pending) {
      if (suit === 'z') {
        if (digit < 1 || digit > 7) throw new NotationError('honor-out-of-range', { digit })
        tiles.push(HONOR_START + digit - 1)
      } else if (digit === 0) {
        tiles.push(makeTile(SUIT_STARTS[suit] + 4, true))
      } else {
        tiles.push(SUIT_STARTS[suit] + digit - 1)
      }
    }
    pending = []
  }

  if (pending.length > 0) throw new NotationError('trailing-digits')
  return tiles
}

/** Formats a single tile, e.g. `5m` or `0m` for the red five. */
export function formatTile(tile: Tile): string {
  const suit = suitOf(tile)
  if (suit === 'z') return `${rankOf(tile)}z`
  return `${isRed(tile) ? 0 : rankOf(tile)}${suit}`
}

/** Inverse of `parseTiles`, grouping runs of the same suit: `123m456p`. */
export function formatTiles(tiles: Tile[]): string {
  let out = ''
  let digits = ''
  let currentSuit: Suit | null = null

  for (const tile of tiles) {
    const suit = suitOf(tile)
    if (suit !== currentSuit) {
      if (currentSuit !== null) out += digits + currentSuit
      digits = ''
      currentSuit = suit
    }
    digits += isRed(tile) ? '0' : String(rankOf(tile))
  }
  if (currentSuit !== null) out += digits + currentSuit
  return out
}

/** Builds the 34-slot count array every hand algorithm consumes. */
export function toCounts(tiles: Tile[]): number[] {
  const counts = new Array<number>(NUM_FACES).fill(0)
  for (const tile of tiles) counts[face(tile)]++
  return counts
}

/** Expands a count array back into face indices, ascending. Red flags are lost. */
export function fromCounts(counts: readonly number[]): Tile[] {
  const tiles: Tile[] = []
  for (let i = 0; i < NUM_FACES; i++) {
    for (let n = 0; n < counts[i]; n++) tiles.push(i)
  }
  return tiles
}

/** Sorts by face index, with red fives placed before their normal twins. */
export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => face(a) - face(b) || (isRed(b) ? 1 : 0) - (isRed(a) ? 1 : 0))
}

export const ALL_FACES: number[] = Array.from({ length: NUM_FACES }, (_, i) => i)
