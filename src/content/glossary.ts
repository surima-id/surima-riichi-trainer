/**
 * The glossary's terms, in reading order within each group.
 *
 * The term itself lives here rather than in the catalogs, for the same reason
 * the yaku romaji does: "furiten" is "furiten" in both languages, so a pair of
 * catalog entries would be two copies of one string plus a test to keep them
 * equal. Only the definition is translated, under `glossary.<slug>`.
 *
 * Grouped by when a player meets the word rather than alphabetically. Someone
 * opening this page has usually just heard an unfamiliar word at the table and
 * knows roughly what kind of thing it was — a call, a way of winning, a scoring
 * term — which narrows the search faster than an A-to-Z run does. The page
 * offers a search box for the other case.
 */

import { type MessageKey } from '../i18n'

export interface GlossaryTerm {
  /** Also the `glossary.<slug>` catalog key holding the definition. */
  slug: string
  /** The word as a player says it. Shared across languages. */
  term: string
  /** The Japanese, where seeing it helps. */
  jp?: string
  /** Chapter path that teaches this term, when one does. */
  chapter?: string
}

export interface GlossaryGroup {
  id: string
  /** Catalog key for the group heading. */
  titleKey: MessageKey
  terms: readonly GlossaryTerm[]
}

export const GLOSSARY: readonly GlossaryGroup[] = [
  {
    id: 'flow',
    titleKey: 'glossary.group.flow',
    terms: [
      { slug: 'hanchan', term: 'Hanchan', jp: '半荘' },
      { slug: 'tonpuusen', term: 'Tonpuusen', jp: '東風戦' },
      { slug: 'kyoku', term: 'Kyoku', jp: '局' },
      { slug: 'bakaze', term: 'Bakaze', jp: '場風' },
      { slug: 'jikaze', term: 'Jikaze', jp: '自風' },
      { slug: 'oya', term: 'Oya', jp: '親' },
      { slug: 'ko', term: 'Ko', jp: '子' },
      { slug: 'renchan', term: 'Renchan', jp: '連荘' },
      { slug: 'ryuukyoku', term: 'Ryuukyoku', jp: '流局' },
      { slug: 'honba', term: 'Honba', jp: '本場' },
      { slug: 'kyoutaku', term: 'Kyoutaku', jp: '供託' },
    ],
  },
  {
    id: 'tiles',
    titleKey: 'glossary.group.tiles',
    terms: [
      { slug: 'manzu', term: 'Manzu', jp: '萬子', chapter: '/tiles' },
      { slug: 'pinzu', term: 'Pinzu', jp: '筒子', chapter: '/tiles' },
      { slug: 'souzu', term: 'Souzu', jp: '索子', chapter: '/tiles' },
      { slug: 'jihai', term: 'Jihai', jp: '字牌', chapter: '/tiles' },
      { slug: 'kazehai', term: 'Kazehai', jp: '風牌', chapter: '/tiles' },
      { slug: 'sangenpai', term: 'Sangenpai', jp: '三元牌', chapter: '/tiles' },
      { slug: 'yaochuuhai', term: 'Yaochuuhai', jp: '么九牌', chapter: '/tiles' },
      { slug: 'tanyaohai', term: 'Tanyaohai', jp: '断么九牌', chapter: '/tiles' },
      { slug: 'dora', term: 'Dora', jp: 'ドラ' },
      { slug: 'uradora', term: 'Uradora', jp: '裏ドラ' },
      { slug: 'akadora', term: 'Akadora', jp: '赤ドラ' },
    ],
  },
  {
    id: 'shapes',
    titleKey: 'glossary.group.shapes',
    terms: [
      { slug: 'mentsu', term: 'Mentsu', jp: '面子', chapter: '/shapes' },
      { slug: 'shuntsu', term: 'Shuntsu', jp: '順子', chapter: '/shapes' },
      { slug: 'koutsu', term: 'Koutsu', jp: '刻子', chapter: '/shapes' },
      { slug: 'kantsu', term: 'Kantsu', jp: '槓子', chapter: '/shapes' },
      { slug: 'jantou', term: 'Jantou', jp: '雀頭', chapter: '/shapes' },
      { slug: 'tatsu', term: 'Tatsu', jp: '塔子', chapter: '/efficiency' },
      { slug: 'tenpai', term: 'Tenpai', jp: '聴牌', chapter: '/shapes' },
      { slug: 'shanten', term: 'Shanten', jp: '向聴', chapter: '/efficiency' },
      { slug: 'machi', term: 'Machi', jp: '待ち', chapter: '/shapes' },
      { slug: 'ryanmen', term: 'Ryanmen', jp: '両面', chapter: '/shapes' },
      { slug: 'penchan', term: 'Penchan', jp: '辺張', chapter: '/shapes' },
      { slug: 'kanchan', term: 'Kanchan', jp: '嵌張', chapter: '/shapes' },
      { slug: 'shanpon', term: 'Shanpon', jp: '双碰', chapter: '/shapes' },
      { slug: 'tanki', term: 'Tanki', jp: '単騎', chapter: '/shapes' },
    ],
  },
  {
    id: 'calls',
    titleKey: 'glossary.group.calls',
    terms: [
      { slug: 'naki', term: 'Naki', jp: '鳴き' },
      { slug: 'chii', term: 'Chii', jp: 'チー' },
      { slug: 'pon', term: 'Pon', jp: 'ポン' },
      { slug: 'kan', term: 'Kan', jp: 'カン', chapter: '/fu' },
      { slug: 'ankan', term: 'Ankan', jp: '暗槓', chapter: '/fu' },
      { slug: 'minkan', term: 'Minkan', jp: '明槓', chapter: '/fu' },
      { slug: 'shouminkan', term: 'Shouminkan', jp: '小明槓' },
      { slug: 'menzen', term: 'Menzen', jp: '門前', chapter: '/han' },
      { slug: 'kuisagari', term: 'Kuisagari', jp: '喰い下がり', chapter: '/han' },
      { slug: 'rinshanpai', term: 'Rinshanpai', jp: '嶺上牌' },
    ],
  },
  {
    id: 'winning',
    titleKey: 'glossary.group.winning',
    terms: [
      { slug: 'agari', term: 'Agari', jp: '和了' },
      { slug: 'tsumo', term: 'Tsumo', jp: '自摸' },
      { slug: 'ron', term: 'Ron', jp: '栄和' },
      { slug: 'riichi', term: 'Riichi', jp: '立直', chapter: '/yaku' },
      { slug: 'damaten', term: 'Damaten', jp: '黙聴' },
      { slug: 'furiten', term: 'Furiten', jp: '振聴' },
      { slug: 'yaku', term: 'Yaku', jp: '役', chapter: '/yaku' },
      { slug: 'yakuhai', term: 'Yakuhai', jp: '役牌', chapter: '/yaku' },
      { slug: 'chombo', term: 'Chombo', jp: '錯和' },
      { slug: 'nagashi-mangan', term: 'Nagashi Mangan', jp: '流し満貫' },
    ],
  },
  {
    id: 'scoring',
    titleKey: 'glossary.group.scoring',
    terms: [
      { slug: 'han', term: 'Han', jp: '飜', chapter: '/han' },
      { slug: 'fu', term: 'Fu', jp: '符', chapter: '/fu' },
      { slug: 'mangan', term: 'Mangan', jp: '満貫', chapter: '/score' },
      { slug: 'haneman', term: 'Haneman', jp: '跳満', chapter: '/score' },
      { slug: 'baiman', term: 'Baiman', jp: '倍満', chapter: '/score' },
      { slug: 'sanbaiman', term: 'Sanbaiman', jp: '三倍満', chapter: '/score' },
      { slug: 'yakuman', term: 'Yakuman', jp: '役満', chapter: '/score' },
      { slug: 'kiriage-mangan', term: 'Kiriage Mangan', jp: '切り上げ満貫' },
      { slug: 'tenpai-ryou', term: 'Tenpai Ryou', jp: '聴牌料' },
    ],
  },
  {
    id: 'play',
    titleKey: 'glossary.group.play',
    terms: [
      { slug: 'pai-kouritsu', term: 'Pai Kouritsu', jp: '牌効率', chapter: '/efficiency' },
      { slug: 'ukeire', term: 'Ukeire', jp: '受け入れ', chapter: '/efficiency' },
      { slug: 'betaori', term: 'Betaori', jp: 'ベタ降り' },
      { slug: 'suji', term: 'Suji', jp: '筋' },
      { slug: 'kabe', term: 'Kabe', jp: '壁' },
      { slug: 'anpai', term: 'Anpai', jp: '安牌' },
      { slug: 'oshi-hiki', term: 'Oshi Hiki', jp: '押し引き' },
      { slug: 'tedashi', term: 'Tedashi', jp: '手出し' },
      { slug: 'tsumogiri', term: 'Tsumogiri', jp: 'ツモ切り' },
    ],
  },
]

/** Every term, flattened, for searching and for the count. */
export const GLOSSARY_TERMS: readonly (GlossaryTerm & { group: string })[] = GLOSSARY.flatMap(
  (group) => group.terms.map((term) => ({ ...term, group: group.id })),
)

/**
 * Whether a term matches a search query.
 *
 * The definition is searched as well as the term, so a player who only knows
 * the concept ("the tile I can't win on") can still find the word for it. The
 * Japanese is matched too, for anyone reading a Japanese client's UI.
 */
export function matchesQuery(
  term: GlossaryTerm,
  definition: string,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return (
    term.term.toLowerCase().includes(needle) ||
    (term.jp ?? '').includes(needle) ||
    definition.toLowerCase().includes(needle)
  )
}
