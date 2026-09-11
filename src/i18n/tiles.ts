/**
 * Tile naming, per language.
 *
 * English and Indonesian order the parts differently — "Red Five of Bamboo"
 * versus "Lima Bambu Merah" — so each language gets a template over the
 * engine's `TileDescriptor` rather than a shared concatenation. Word order and
 * modifier position are language properties, and this is where they belong.
 */

import { type TileDescriptor } from '../engine/tiles'
import { type Lang } from './types'

type Catalog = Record<string, string>

/**
 * Word order is a language property, which is why each language gets a template
 * rather than the two sharing one concatenation.
 *
 * English puts the modifier first and joins with a connector — "Red Five of
 * Bamboo". Indonesian puts the modifier last and has no connector, so the same
 * tile is "Lima Bambu Merah". `tile.of` is empty in the Indonesian catalog,
 * which is what lets `join` drop the connector without a special case here.
 */
const TEMPLATES: Record<Lang, (d: TileDescriptor, m: Catalog) => string> = {
  en: (d, m) => {
    if (d.kind === 'honor') return m[`tile.honor.${d.honor}`]
    const name = join(m[`tile.rank.${d.rank}`], m['tile.of'], m[`tile.suit.${d.suit}`])
    return d.red ? join(m['tile.red'], name) : name
  },
  id: (d, m) => {
    if (d.kind === 'honor') return m[`tile.honor.${d.honor}`]
    const name = join(m[`tile.rank.${d.rank}`], m['tile.of'], m[`tile.suit.${d.suit}`])
    // The modifier trails the noun it modifies: "Lima Bambu Merah".
    return d.red ? join(name, m['tile.red']) : name
  },
}

/** Joins the parts with single spaces, skipping any the language leaves empty. */
function join(...parts: string[]): string {
  return parts.filter((part) => part !== '').join(' ')
}

export function nameTile(lang: Lang, descriptor: TileDescriptor, messages: Catalog): string {
  return TEMPLATES[lang](descriptor, messages)
}
