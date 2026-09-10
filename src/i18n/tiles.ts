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
 * Both languages currently name tiles in English, because tile names are
 * terminology rather than prose — an Indonesian player says "Five of Bamboo".
 * The templates stay split anyway: they are the seam where a language that
 * *does* translate tile names would plug in, and `tile.of` being empty is what
 * makes the Indonesian ordering fall out correctly rather than a special case.
 */
const TEMPLATES: Record<Lang, (d: TileDescriptor, m: Catalog) => string> = {
  en: (d, m) => {
    if (d.kind === 'honor') return m[`tile.honor.${d.honor}`]
    const name = join(m[`tile.rank.${d.rank}`], m['tile.of'], m[`tile.suit.${d.suit}`])
    return d.red ? join(m['tile.red'], name) : name
  },
  // Were these translated, Indonesian would put the modifier last and drop the
  // connector: "Lima Bambu Merah".
  id: (d, m) => {
    if (d.kind === 'honor') return m[`tile.honor.${d.honor}`]
    const name = join(m[`tile.rank.${d.rank}`], m['tile.of'], m[`tile.suit.${d.suit}`])
    return d.red ? join(m['tile.red'], name) : name
  },
}

/** Joins the parts with single spaces, skipping any the language leaves empty. */
function join(...parts: string[]): string {
  return parts.filter((part) => part !== '').join(' ')
}

export function nameTile(lang: Lang, descriptor: TileDescriptor, messages: Catalog): string {
  return TEMPLATES[lang](descriptor, messages)
}
