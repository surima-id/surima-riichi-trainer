/**
 * One canonical example hand per yaku, for the reference page.
 *
 * These are hand-authored rather than generated: a generator cannot reliably
 * produce a daisuushii, and an example that changes on every reload is no use
 * as a reference. The trade-off is that a hand-written sample can be wrong — so
 * `__tests__/yakuSamples.test.ts` runs every one through the detector and fails
 * if it does not actually exhibit the yaku it claims to.
 *
 * Compositions follow Riichi Wiki's list of yaku, which draws each yaku as the
 * tiles that constitute it rather than as a full fourteen-tile hand.
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
  /**
   * The tiles that actually constitute the yaku, in notation.
   *
   * A yaku is usually a claim about part of a hand: iipeiko is `223344m`, and
   * the other seven tiles are filler that has to be legal but teaches nothing.
   * Naming the defining tiles lets the reference draw the rest face-down, so
   * the eye lands on the pattern rather than hunting a full hand for it.
   *
   * Omitted where the yaku *is* the whole hand — chinitsu, chiitoitsu, kokushi
   * and the like — in which case every tile is shown.
   *
   * The full `hand` is still what the detector runs against, so this is a
   * display hint and can never change what the page claims a hand scores.
   */
  defining?: string
  /**
   * Marks the winning tile, drawn apart from the rest and labelled.
   *
   * Off by default, following the wiki: for most yaku the composition is the
   * point and which tile completed it is incidental, so setting one apart only
   * invites the reader to wonder why that tile is special. Worth showing where
   * the agari is part of the claim — a triplet completed by ron counts as open,
   * so it decides sanankou against suuankou — or where the wait is the shape
   * being taught.
   */
  showAgari?: boolean
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
  // These render no hand at all on the reference page (see `NO_SAMPLE` there);
  // the entries exist because the detector test scores every yaku.
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
  // Pinfu is a claim about the whole hand — all runs, a valueless pair, and a
  // two-sided wait — so it shows everything, and the wait is the point.
  pinfu: { hand: '234m22p345567678s', win: '8s', showAgari: true },
  tanyao: { hand: '234m567m22p345678s', win: '8s' },
  'yakuhai-haku': { hand: '555z234m567m22p234s', win: '4s', defining: '555z' },
  'yakuhai-hatsu': { hand: '666z234m567m22p234s', win: '4s', defining: '666z' },
  'yakuhai-chun': { hand: '777z234m567m22p234s', win: '4s', defining: '777z' },
  'yakuhai-seat': { hand: '111z234m567m22p234s', win: '4s', defining: '111z' },
  'yakuhai-round': { hand: '111z234m567m22p234s', win: '4s', defining: '111z' },
  iipeiko: { hand: '223344m567p22s678p', win: '8p', defining: '223344m' },

  // ---- 2 han ----
  chiitoitsu: { hand: '1133m5577p2299s11z', win: '1z', showAgari: true },
  sanshoku: { hand: '234m234p234s55z678m', win: '8m', defining: '234m234p234s' },
  ittsuu: { hand: '123456789m22p234s', win: '4s', defining: '123456789m' },
  chanta: { hand: '123m789p123s99m111z', win: '1z' },
  // Two melds called, so the shape reads as toitoi rather than as suuankou:
  // four *concealed* triplets would be the yakuman, and which sets were claimed
  // is exactly the difference.
  toitoi: {
    hand: '111m99s',
    win: '1m',
    calls: [pon('555m'), pon('333p'), pon('222z')],
    context: { menzen: false },
  },
  // Three concealed triplets plus one called run. The called set is what keeps
  // this sanankou rather than suuankou, and the agari matters for the same
  // reason: a triplet finished by ron would count as open.
  sanankou: {
    hand: '111m555m333p99s',
    win: '3p',
    calls: [chi('234s')],
    context: { tsumo: true, menzen: false },
    defining: '111m555m333p',
    showAgari: true,
  },
  // Three kans and one ordinary run. Four would be suukantsu, so the count is
  // the whole distinction and the non-kan set has to be visible.
  sankantsu: {
    hand: '234m99p',
    win: '4m',
    calls: [kan('1111m', true), kan('5555p', false), kan('9999s', false)],
    context: { menzen: false },
  },
  'sanshoku-doukou': { hand: '333m333p333s55z234m', win: '4m', defining: '333m333p333s' },
  shousangen: { hand: '555z666z77z234m234s', win: '4s', defining: '555z666z77z' },
  honroutou: { hand: '111m999m111p99s222z', win: '2z' },

  // ---- 3 han ----
  junchan: { hand: '123m789m123p99s789s', win: '9s' },
  ryanpeikou: { hand: '223344m556677p11s', win: '1s' },
  honitsu: { hand: '123m456m789m11m111z', win: '1z' },

  // ---- 6 han ----
  chinitsu: { hand: '234567m345m99m111m', win: '7m' },

  // ---- Yakuman ----
  // The pair is the wait on both of these, so the agari is the shape.
  kokushi: { hand: '19m19p19s12345677z', win: '7z', showAgari: true },
  suuankou: { hand: '111m555m333p999s11z', win: '1z', context: { tsumo: true }, showAgari: true },
  daisangen: { hand: '555z666z777z234m11p', win: '4m', defining: '555z666z777z' },
  shousuushii: { hand: '111z222z333z44z234m', win: '4m', defining: '111z222z333z44z' },
  daisuushii: { hand: '111z222z333z444z11m', win: '1m', defining: '111z222z333z444z' },
  tsuuiisou: { hand: '111z222z333z444z55z', win: '5z' },
  chinroutou: { hand: '111m999m111p999p11s', win: '1s' },
  ryuuiisou: { hand: '222s333s444s666s66z', win: '6z' },
  // The nine-gates wait covers all nine tiles of the suit, which is the yaku.
  chuuren: { hand: '11123456789999m', win: '5m', showAgari: true },
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
