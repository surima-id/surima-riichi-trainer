/**
 * The seven chapters, in teaching order.
 *
 * One list, because the order is the pedagogy and four separate places now need
 * to agree on it: the nav, the course map, the mastery totals, and the lesson
 * pages themselves. Titles and blurbs are not here — they live in the catalogs
 * under `module.${id}.title`, so copy stays in one place and this stays a map.
 *
 * The routes in `App.tsx` are deliberately left spelled out rather than generated
 * from this: each one mounts a different component, and a lookup table of
 * components would be the same number of lines while being a step less direct.
 */

import { type MessageKey } from '../i18n'

export interface Chapter {
  /** Also the lesson id and the `module.*` catalog prefix. */
  id: string
  path: string
  navKey: MessageKey
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 'tiles', path: '/tiles', navKey: 'nav.tiles' },
  { id: 'shapes', path: '/shapes', navKey: 'nav.shapes' },
  { id: 'yaku', path: '/yaku', navKey: 'nav.yaku' },
  { id: 'han', path: '/han', navKey: 'nav.han' },
  { id: 'fu', path: '/fu', navKey: 'nav.fu' },
  { id: 'score', path: '/score', navKey: 'nav.score' },
  { id: 'efficiency', path: '/efficiency', navKey: 'nav.efficiency' },
]

/** Chapter ids alone, for the mastery denominators. */
export const CHAPTER_IDS: readonly string[] = CHAPTERS.map((c) => c.id)
