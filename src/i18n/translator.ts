/**
 * Turns engine ids into text.
 *
 * `createTranslator` is a plain function, not a hook, so drill generators and
 * tests use it without React. That is what makes it possible to generate the
 * same question in both languages and assert the grading is identical.
 */

import { type FuItem } from '../engine/fu'
import { type InvalidReason } from '../engine/explain'
import { type WaitType } from '../engine/parse'
import { type LimitName, type Payment } from '../engine/score'
import {
  type NotationError,
  type Suit,
  type Tile,
  describeTile,
  formatTiles,
  suitOf,
} from '../engine/tiles'
import { type YakuId } from '../engine/yaku'
import { messages as idMessages } from './catalog/id'
import { messages as enMessages } from './catalog/en'
import { YAKU_ROMAJI } from './catalog/romaji'
import { interpolate } from './format'
import { nameTile } from './tiles'
import { type Lang, type MessageKey, type Params } from './types'

const CATALOGS: Record<Lang, Record<string, string>> = {
  id: idMessages,
  en: enMessages,
}

export interface Translator {
  readonly lang: Lang
  t(key: MessageKey, params?: Params): string
  tile(tile: Tile): string
  suit(suit: Suit): string
  yaku(id: YakuId): string
  romaji(id: YakuId): string
  fuItem(item: FuItem): { label: string; detail?: string }
  wait(type: WaitType, form?: 'short' | 'long'): string
  limit(limit: LimitName): string
  payment(payment: Payment): string
  invalidReason(reason: InvalidReason): string
  notationError(error: NotationError): string
  han(n: number): string
  fu(n: number): string
  notation(tiles: Tile[]): string
}

export function createTranslator(lang: Lang): Translator {
  const m = CATALOGS[lang]
  const t = (key: MessageKey, params?: Params) => interpolate(m[key as string] ?? String(key), params)

  const tile = (value: Tile) => nameTile(lang, describeTile(value), m)

  /**
   * Hand notation for display, with the honors spelled out.
   *
   * The engine's `formatTiles` emits strict notation — `1z` for East, `5z` for
   * the White Dragon — which is the right thing for a parser and the wrong
   * thing for a beginner, who has no way to know that 5z is white rather than,
   * say, the fifth wind. Numbered suits keep their compact form because the
   * digit *is* the tile ("3m" is the three of characters, plainly), but the
   * honors are named.
   *
   * Display-only. Anything compared, graded or re-parsed keeps using
   * `formatTiles`, which is stable and language-independent.
   */
  const notation = (tiles: Tile[]): string => {
    const parts: string[] = []
    let run: Tile[] = []

    const flush = () => {
      if (run.length > 0) parts.push(formatTiles(run))
      run = []
    }

    for (const value of tiles) {
      if (suitOf(value) === 'z') {
        flush()
        parts.push(tile(value))
      } else {
        run.push(value)
      }
    }
    flush()
    return parts.join(' ')
  }

  return {
    lang,
    t,
    tile,
    suit: (suit) => m[`tile.suit.${suit}`],
    yaku: (id) => m[`yaku.${id}`],
    romaji: (id) => YAKU_ROMAJI[id],
    wait: (type, form = 'short') => m[`wait.${type}.${form}`],
    limit: (limit) => m[`limit.${limit}`],
    invalidReason: (reason) => m[`invalid.${reason}`],
    notationError: (error) => interpolate(m[`error.${error.code}`], error.params),
    han: (n) => t('unit.han', { n }),
    fu: (n) => t('unit.fu', { n }),
    notation,

    payment: (payment) => {
      switch (payment.kind) {
        case 'ron':
          return t('payment.ron', { n: payment.amount })
        case 'tsumo-dealer':
          return t('payment.tsumoDealer', { n: payment.each })
        case 'tsumo-nondealer':
          return t('payment.tsumoNonDealer', {
            each: payment.each,
            dealer: payment.fromDealer,
          })
      }
    },

    /**
     * A fu line and its explanatory sub-line. Both come from the same reason
     * object, so the detail can never contradict the label.
     */
    fuItem: (item) => {
      const r = item.reason
      switch (r.key) {
        case 'meld':
          return {
            label: m[`fu.meld.${r.meld}.${r.concealed ? 'concealed' : 'open'}.${r.tileClass}`],
            detail: tile(r.tile),
          }
        case 'value-pair':
          return {
            label: m['fu.value-pair'],
            // A double wind lists both reasons, which is what explains the 4.
            detail: `${tile(r.tile)} — ${r.sources.map((s) => m[`fu.source.${s}`]).join(' + ')}`,
          }
        case 'wait':
          return { label: m[`wait.${r.wait}.short`] }
        default:
          return { label: m[`fu.${r.key}`], detail: m[`fu.${r.key}.detail`] }
      }
    },
  }
}
