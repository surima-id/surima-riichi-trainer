/**
 * Yaku names in romaji.
 *
 * These are the same in both languages — riichi players say "tanyao" whether
 * they are speaking English or Indonesian — but they are still display text, so
 * they live on the UI side of the line rather than inside the engine.
 */

import { type YakuId } from '../../engine/yaku'

export const YAKU_ROMAJI: Record<YakuId, string> = {
  'kokushi': 'Kokushi Musou',
  'suuankou': 'Suuankou',
  'daisangen': 'Daisangen',
  'shousuushii': 'Shousuushii',
  'daisuushii': 'Daisuushii',
  'tsuuiisou': 'Tsuuiisou',
  'chinroutou': 'Chinroutou',
  'ryuuiisou': 'Ryuuiisou',
  'chuuren': 'Chuuren Poutou',
  'suukantsu': 'Suukantsu',
  'tenhou': 'Tenhou',
  'chiihou': 'Chiihou',
  'riichi': 'Riichi',
  'double-riichi': 'Daburu Riichi',
  'ippatsu': 'Ippatsu',
  'menzen-tsumo': 'Menzen Tsumo',
  'haitei': 'Haitei Raoyue',
  'houtei': 'Houtei Raoyui',
  'rinshan': 'Rinshan Kaihou',
  'chankan': 'Chankan',
  'pinfu': 'Pinfu',
  'tanyao': 'Tanyao',
  'yakuhai-haku': 'Haku',
  'yakuhai-hatsu': 'Hatsu',
  'yakuhai-chun': 'Chun',
  'yakuhai-seat': 'Jikaze',
  'yakuhai-round': 'Bakaze',
  'iipeiko': 'Iipeiko',
  'chiitoitsu': 'Chiitoitsu',
  'sanshoku': 'Sanshoku Doujun',
  'ittsuu': 'Ittsuu',
  'chanta': 'Chanta',
  'junchan': 'Junchan',
  'toitoi': 'Toitoi',
  'sanankou': 'Sanankou',
  'sankantsu': 'Sankantsu',
  'sanshoku-doukou': 'Sanshoku Doukou',
  'shousangen': 'Shousangen',
  'honroutou': 'Honroutou',
  'ryanpeikou': 'Ryanpeikou',
  'honitsu': 'Honitsu',
  'chinitsu': 'Chinitsu',
}
