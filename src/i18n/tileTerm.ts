/**
 * The Japanese name for a tile.
 *
 * The same in both languages, like the yaku names in `catalog/romaji.ts`: a
 * player at a table says "Hatsu" whichever language surrounds them, so this is
 * terminology rather than prose and lives outside the catalogs.
 *
 * It exists because the drill teaches two things at once. "Naga Hijau" is what
 * the tile *is*, and it belongs in the reader's language; "Hatsu" is what
 * someone will call it in a real game, and no amount of translated practice
 * teaches that. The answer labels carry both, which is the same device the yaku
 * drill already uses — there with the Japanese term leading and the meaning in
 * brackets, here the other way round, because the tile's picture is the question
 * and its name is the answer.
 *
 * Deliberately *not* wired into `t.tile()`. That name is used for every tile's
 * tooltip, for the seat and round winds, and inside explanation prose, none of
 * which wants a parenthetical. A test also asserts the two languages name every
 * tile differently, and a shared Japanese suffix on both would collide.
 */

import { type HonorId, type Tile, describeTile } from '../engine/tiles'

/**
 * Keyed by the engine's honor id rather than by position, so a reordering of
 * `HONOR_IDS` cannot silently rename every wind.
 *
 * These are the names the tile art files already use, which is not a
 * coincidence worth breaking.
 */
const HONOR_TERMS: Record<HonorId, string> = {
  east: 'Ton',
  south: 'Nan',
  west: 'Shaa',
  north: 'Pei',
  haku: 'Haku',
  hatsu: 'Hatsu',
  chun: 'Chun',
}

/** Suit names as they are spoken: 9-man, 5-pin, 3-sou. */
const SUIT_TERMS = { m: 'man', p: 'pin', s: 'sou' } as const

export function tileTerm(tile: Tile): string {
  const d = describeTile(tile)
  if (d.kind === 'honor') return HONOR_TERMS[d.honor]
  const name = `${d.rank}-${SUIT_TERMS[d.suit]}`
  // "aka" is what players call the red five — more use than the `0p` notation,
  // which the notation line already shows anyway.
  return d.red ? `${name} aka` : name
}
