/**
 * One canonical example hand per yaku, for the reference page.
 *
 * These are hand-authored rather than generated: a generator cannot reliably
 * produce a daisuushii, and an example that changes on every reload is no use
 * as a reference. The trade-off is that a hand-written sample can be wrong — so
 * `__tests__/yakuSamples.test.ts` runs every one through the detector and fails
 * if it does not actually exhibit the yaku it claims to.
 */

import { type Call } from '../engine/parse'
import { parseTiles } from '../engine/tiles'
import { type WinContext, type YakuId } from '../engine/yaku'

export interface YakuSample {
  /** The concealed hand in standard notation, including the winning tile. */
  hand: string
  /** The winning tile. */
  win: string
  /** Called melds, for yaku that need an open hand. */
  calls?: Call[]
  /** Context the yaku depends on — riichi, tsumo, seat wind, and so on. */
  context?: Partial<WinContext>
}

const chi = (notation: string): Call => {
  const tiles = parseTiles(notation)
  return { kind: 'chi', tile: tiles[0], tiles }
}
const pon = (notation: string): Call => {
  const tiles = parseTiles(notation)
  return { kind: 'pon', tile: tiles[0], tiles }
}
const kan = (notation: string, open: boolean): Call => {
  const tiles = parseTiles(notation)
  return { kind: open ? 'minkan' : 'ankan', tile: tiles[0], tiles }
}

export const YAKU_SAMPLES: Record<YakuId, YakuSample> = {
  // ---- Situational ----
  riichi: { hand: '234m567m22p345678s', win: '8s', context: { riichi: true } },
  'double-riichi': { hand: '234m567m22p345678s', win: '8s', context: { doubleRiichi: true } },
  ippatsu: {
    hand: '234m567m22p345678s',
    win: '8s',
    context: { riichi: true, ippatsu: true },
  },
  'menzen-tsumo': { hand: '234m567m22p345678s', win: '8s', context: { tsumo: true } },
  haitei: { hand: '234m567m22p345678s', win: '8s', context: { tsumo: true, haitei: true } },
  houtei: { hand: '234m567m22p345678s', win: '8s', context: { houtei: true } },
  rinshan: { hand: '234m567m22p345678s', win: '8s', context: { tsumo: true, rinshan: true } },
  chankan: { hand: '234m567m22p345678s', win: '8s', context: { chankan: true } },

  // ---- 1 han ----
  pinfu: { hand: '234m22p345567678s', win: '8s' },
  tanyao: { hand: '234m567m22p345678s', win: '8s' },
  'yakuhai-haku': { hand: '555z234m567m22p234s', win: '4s' },
  'yakuhai-hatsu': { hand: '666z234m567m22p234s', win: '4s' },
  'yakuhai-chun': { hand: '777z234m567m22p234s', win: '4s' },
  'yakuhai-seat': { hand: '111z234m567m22p234s', win: '4s' },
  'yakuhai-round': { hand: '111z234m567m22p234s', win: '4s' },
  iipeiko: { hand: '223344m567p22s678p', win: '8p' },

  // ---- 2 han ----
  chiitoitsu: { hand: '1133m5577p2299s11z', win: '1z' },
  sanshoku: { hand: '234m234p234s55z678m', win: '8m' },
  ittsuu: { hand: '123456789m22p234s', win: '4s' },
  chanta: { hand: '123m789p123s99m111z', win: '1z' },
  toitoi: { hand: '111m555m333p99s222z', win: '2z' },
  sanankou: { hand: '111m555m333p99s234s', win: '4s', context: { tsumo: true } },
  sankantsu: {
    hand: '234m99p',
    win: '4m',
    calls: [kan('1111m', false), kan('5555p', false), kan('9999s', false)],
  },
  'sanshoku-doukou': { hand: '333m333p333s55z234m', win: '4m' },
  shousangen: { hand: '555z666z77z234m234s', win: '4s' },
  honroutou: { hand: '111m999m111p99s222z', win: '2z' },

  // ---- 3 han ----
  junchan: { hand: '123m789m123p99s789s', win: '9s' },
  ryanpeikou: { hand: '223344m556677p11s', win: '1s' },
  honitsu: { hand: '123m456m789m11m111z', win: '1z' },

  // ---- 6 han ----
  chinitsu: { hand: '234567m345m99m111m', win: '7m' },

  // ---- Yakuman ----
  kokushi: { hand: '19m19p19s12345677z', win: '7z' },
  suuankou: { hand: '111m555m333p999s11z', win: '1z', context: { tsumo: true } },
  daisangen: { hand: '555z666z777z234m11p', win: '4m' },
  shousuushii: { hand: '111z222z333z44z234m', win: '4m' },
  daisuushii: { hand: '111z222z333z444z11m', win: '1m' },
  tsuuiisou: { hand: '111z222z333z444z55z', win: '5z' },
  chinroutou: { hand: '111m999m111p999p11s', win: '1s' },
  ryuuiisou: { hand: '222s333s444s666s66z', win: '6z' },
  chuuren: { hand: '11123456789999m', win: '5m' },
  suukantsu: {
    hand: '11m',
    win: '1m',
    calls: [kan('1111p', false), kan('5555p', false), kan('9999s', false), kan('2222z', false)],
  },
  tenhou: { hand: '234m567m22p345678s', win: '8s', context: { tsumo: true, tenhou: true } },
  chiihou: { hand: '234m567m22p345678s', win: '8s', context: { tsumo: true, chiihou: true } },
}

/** Yaku whose sample needs called melds to demonstrate the open form. */
export const OPEN_SAMPLES: Partial<Record<YakuId, YakuSample>> = {
  tanyao: { hand: '234m22p345678s', win: '8s', calls: [chi('567m')], context: { menzen: false } },
  toitoi: { hand: '111m555m99s', win: '5m', calls: [pon('333p'), pon('222z')], context: { menzen: false } },
}
