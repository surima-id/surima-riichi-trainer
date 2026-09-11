/**
 * The bilingual contract.
 *
 * The engine returns ids; everything a human reads is assembled here. Keeping
 * the two apart is what lets a drill be graded identically in both languages —
 * grading compares ids, and only the labels differ.
 */

export const LANGS = ['id', 'en'] as const
export type Lang = (typeof LANGS)[number]

/** Bahasa Indonesia is the default; English is opt-in via the nav toggle. */
export const DEFAULT_LANG: Lang = 'id'

export const LANG_LABELS: Record<Lang, string> = {
  id: 'ID',
  en: 'EN',
}

export type Params = Record<string, string | number>

/**
 * Keys whose value is mahjong terminology rather than prose.
 *
 * These read identically in every language: a player says "Mangan" and
 * "Tanyao" whichever language surrounds them, so translating them would make
 * the Bahasa version harder to read, not easier. Only the surrounding
 * explanation is translated.
 *
 * A test asserts every catalog agrees on these, so a well-meaning translation
 * of one of them cannot slip in unnoticed.
 *
 * Tile names are deliberately *not* here. A rank, a suit and an honor are
 * ordinary nouns rather than jargon — an Indonesian player reads "Lima Bambu",
 * not "Five of Bamboo" — and a separate test asserts the two languages name
 * every tile differently.
 */
export const TERM_KEY_PREFIXES = [
  'yaku.',
  'wait.',
  'limit.',
  'fact.',
  'fu.meld.',
  'fu.source.',
  // The fu lesson's table rows are the same labels the scorer's breakdown
  // prints, and must stay word-for-word identical to it.
  'lesson.fu.row',
] as const

export function isTermKey(key: string): boolean {
  // A `.detail` line explains a term rather than being one, so it is prose.
  if (key.endsWith('Detail') || key.endsWith('.detail')) return false
  return TERM_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
}

/**
 * Strips a parenthetical gloss: `Tsumo (Tarik Sendiri)` -> `Tsumo`.
 *
 * Some labels lead with the Japanese term and follow it with the meaning in
 * brackets, so a learner meets the word they will hear at the table alongside
 * what it means. The term is shared across languages; the gloss is translated.
 * Comparing only the leading term is what lets the terminology guard hold
 * without forbidding the translated half.
 */
export function termOf(value: string): string {
  const open = value.indexOf(' (')
  return open === -1 ? value : value.slice(0, open)
}

/**
 * The key set, derived from the Indonesian catalog. English is checked against
 * it with `satisfies Messages`.
 */
export type Messages = typeof import('./catalog/id').messages
export type MessageKey = keyof Messages
