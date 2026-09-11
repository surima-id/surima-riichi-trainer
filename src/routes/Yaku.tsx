/**
 * The yaku reference and quiz.
 *
 * Everything on this page is derived from `YAKU_LIST` in the engine, so the
 * reference a learner memorizes and the scorer that grades them can never
 * disagree. Names lead with the romaji, because that is what players say at the
 * table, with the translated meaning in brackets.
 */

import { useMemo, useState } from 'react'
import { Hand } from '../components/Hand'
import { Lesson } from '../components/Lesson'
import { Badge, Card, stagger } from '../components/ui'
import { YAKU_SAMPLES } from '../content/yakuSamples'
import { GENERATORS } from '../drills/generators'
import { parseTiles } from '../engine/tiles'
import { YAKU_LIST, type YakuId } from '../engine/yaku'
import { useT, type MessageKey } from '../i18n'

type Filter = 'all' | 'closed' | 'open' | 'yakuman'

const FILTERS: { id: Filter; key: 'yakuPage.filterAll' | 'yakuPage.filterClosed' | 'yakuPage.filterOpen' | 'yakuPage.filterYakuman' }[] = [
  { id: 'all', key: 'yakuPage.filterAll' },
  { id: 'closed', key: 'yakuPage.filterClosed' },
  { id: 'open', key: 'yakuPage.filterOpen' },
  { id: 'yakuman', key: 'yakuPage.filterYakuman' },
]

/**
 * Situational yaku depend on how and when you won rather than on the tiles, so
 * they sit apart from the shape-based ones instead of being scattered through
 * the han groups where their example hands would look identical.
 */
const SITUATIONAL = new Set<YakuId>([
  'riichi',
  'double-riichi',
  'ippatsu',
  'menzen-tsumo',
  'haitei',
  'houtei',
  'rinshan',
  'chankan',
])

/**
 * Yaku that show no example hand.
 *
 * These are defined by *when* you won rather than by what you held, so every
 * sample is the same filler hand — riichi, ippatsu and haitei would each print
 * an identical 234m567m22p345678s that illustrates nothing and invites the
 * reader to hunt for a pattern that is not there. Tenhou and chiihou are the
 * same case wearing a yakuman's badge: the shape is irrelevant, only the timing
 * of the draw matters.
 *
 * Kept separate from `SITUATIONAL` above, which decides *grouping*. The two
 * lists agree except for those yakuman, and merging them would file tenhou
 * under "situational" rather than among the yakuman, where a reader looks for
 * it.
 */
const NO_SAMPLE = new Set<YakuId>([...SITUATIONAL, 'tenhou', 'chiihou'])

type Entry = (typeof YAKU_LIST)[number]

interface Group {
  id: string
  title: string
  note?: string
  entries: Entry[]
}

/**
 * The five yakuhai are one concept, not five.
 *
 * The engine scores them separately because each has its own trigger and they
 * stack — East as both seat and round wind is two han — but as a reference
 * entry, five near-identical rows saying "1 han, triplet of a dragon" is worse
 * than one row that shows all five triplets side by side.
 */
const YAKUHAI_IDS: YakuId[] = [
  'yakuhai-haku',
  'yakuhai-hatsu',
  'yakuhai-chun',
  'yakuhai-seat',
  'yakuhai-round',
]
const YAKUHAI_SET = new Set<YakuId>(YAKUHAI_IDS)

/** The merged yakuhai entry: one card, the five qualifying triplets shown together. */
function YakuhaiCard() {
  const t = useT()

  return (
    <div className="border-b border-black/5 py-4 last:border-0 dark:border-white/5">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className="font-semibold">{t.t('yakuPage.yakuhaiName')}</h4>
        <span className="text-sm text-black/55 dark:text-white/55">
          ({t.t('yakuPage.yakuhaiGloss')})
        </span>
        <span className="ml-auto flex gap-1.5">
          <Badge tone="neutral">
            {t.t('yakuPage.closed')} {t.han(1)}
          </Badge>
          <Badge tone="neutral">
            {t.t('yakuPage.open')} {t.han(1)}
          </Badge>
        </span>
      </div>
      <p className="mb-3 text-sm text-black/60 dark:text-white/60">
        {t.t('yakuPage.yakuhaiNote')}
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {YAKUHAI_IDS.map((id) => (
          <div key={id}>
            <p className="mb-1.5 text-xs font-medium text-black/60 dark:text-white/60">
              {t.romaji(id)} <span className="text-black/35 dark:text-white/35">({t.yaku(id)})</span>
            </p>
            <Hand tiles={parseTiles(TRIPLETS[id])} size="xs" sort={false} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Just the scoring triplet for each yakuhai — the rest of the hand is noise here. */
const TRIPLETS: Record<string, string> = {
  'yakuhai-haku': '555z',
  'yakuhai-hatsu': '666z',
  'yakuhai-chun': '777z',
  'yakuhai-seat': '111z',
  'yakuhai-round': '111z',
}

function YakuCard({ entry }: { entry: Entry }) {
  const t = useT()
  const sample = YAKU_SAMPLES[entry.id]
  const tiles = useMemo(() => parseTiles(sample.hand), [sample.hand])
  const winTile = useMemo(() => parseTiles(sample.win)[0], [sample.win])

  const showsHand = !NO_SAMPLE.has(entry.id)

  /**
   * The tiles that carry the yaku, or undefined when the whole hand does.
   *
   * `Hand` turns everything else face-down, so a reader sees `223344m` and four
   * tile backs rather than a full fourteen-tile hand with the double run buried
   * in it. The filler still has to exist — the sample is run through the real
   * detector — it just does not have to be read.
   */
  const defining = useMemo(
    () => (sample.defining ? parseTiles(sample.defining) : undefined),
    [sample.defining],
  )

  return (
    <div className="-mx-2 rounded-xl border-b border-black/5 px-2 py-4 transition-colors last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h4 className="text-lg font-semibold tracking-tight">{t.romaji(entry.id)}</h4>
        <span className="text-sm text-black/55 dark:text-white/55">({t.yaku(entry.id)})</span>
        <span className="ml-auto flex gap-1.5">
          {entry.yakuman > 0 ? (
            <Badge tone="good">
              {entry.yakuman > 1
                ? t.t('unit.yakumanMultiple', { n: entry.yakuman })
                : t.t('unit.yakuman')}
            </Badge>
          ) : (
            <>
              <Badge tone="neutral">
                {t.t('yakuPage.closed')} {t.han(entry.han)}
              </Badge>
              {entry.openHan > 0 ? (
                <Badge tone="neutral">
                  {t.t('yakuPage.open')} {t.han(entry.openHan)}
                </Badge>
              ) : (
                <Badge tone="info">{t.t('yakuPage.filterClosed')}</Badge>
              )}
            </>
          )}
        </span>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-black/65 dark:text-white/65">
        {t.t(`yakuDesc.${entry.id}` as MessageKey)}
      </p>
      {showsHand && (
        <div>
          <Hand
            tiles={tiles}
            calls={sample.calls}
            // Most yaku are a composition, so the winning tile stays in the row
            // rather than being drawn apart; only the samples where the agari is
            // part of the claim pull it out and label it.
            winTile={sample.showAgari ? winTile : undefined}
            size="xs"
            showAgari={sample.showAgari}
            revealFaces={defining}
          />
        </div>
      )}
    </div>
  )
}

function YakuReference() {
  const t = useT()
  const [filter, setFilter] = useState<Filter>('all')

  const groups = useMemo<Group[]>(() => {
    const visible = YAKU_LIST.filter((y) => {
      switch (filter) {
        case 'closed':
          return y.closedOnly && y.yakuman === 0
        case 'open':
          return !y.closedOnly && y.yakuman === 0
        case 'yakuman':
          return y.yakuman > 0
        default:
          return true
      }
    })

    // Keep one yakuhai as the anchor for the merged card and drop the rest.
    const merged = visible.filter(
      (y) => !YAKUHAI_SET.has(y.id) || y.id === YAKUHAI_IDS[0],
    )

    const yakuman = merged.filter((y) => y.yakuman > 0)
    const situational = merged.filter((y) => y.yakuman === 0 && SITUATIONAL.has(y.id))
    const shape = merged.filter((y) => y.yakuman === 0 && !SITUATIONAL.has(y.id))

    const byHan = new Map<number, Entry[]>()
    for (const entry of shape) {
      const list = byHan.get(entry.han) ?? []
      list.push(entry)
      byHan.set(entry.han, list)
    }

    const result: Group[] = [...byHan.keys()]
      .sort((a, b) => a - b)
      .map((han) => ({
        id: `han-${han}`,
        title: t.t('yakuPage.group.han', { n: han }),
        entries: byHan.get(han)!,
      }))

    if (situational.length > 0) {
      result.push({
        id: 'situational',
        title: t.t('yakuPage.group.situational'),
        note: t.t('yakuPage.situationalNote'),
        entries: situational,
      })
    }
    if (yakuman.length > 0) {
      result.push({
        id: 'yakuman',
        title: t.t('yakuPage.group.yakuman'),
        entries: yakuman,
      })
    }
    return result
  }, [filter, t])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium transition duration-200 ${
              filter === f.id
                ? 'bg-felt-700 text-white shadow-sm dark:bg-felt-100 dark:text-felt-900'
                : 'bg-black/5 text-black/70 hover:-translate-y-0.5 hover:bg-black/10 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15'
            }`}
          >
            {t.t(f.key)}
          </button>
        ))}
      </div>

      {groups.map((group, i) => (
        <section key={group.id} className="anim-fade-up" style={stagger(i, 50)}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
            {group.title}
          </h3>
          {group.note && (
            <p className="mb-2 text-sm text-black/55 dark:text-white/55">{group.note}</p>
          )}
          <Card>
            {group.entries.map((entry) =>
              entry.id === YAKUHAI_IDS[0] ? (
                <YakuhaiCard key="yakuhai" />
              ) : (
                <YakuCard key={entry.id} entry={entry} />
              ),
            )}
          </Card>
        </section>
      ))}

      <p className="pt-2 text-xs text-black/45 dark:text-white/45">
        <a
          href="https://riichi.wiki/List_of_yaku"
          className="underline underline-offset-2 transition hover:text-black dark:hover:text-white"
          target="_blank"
          rel="noreferrer"
        >
          {t.t('yakuPage.credit')}
        </a>
      </p>
    </div>
  )
}

export function YakuLesson() {
  const t = useT()
  return (
    <Lesson
      id="yaku"
      title={t.t('module.yaku.title')}
      subtitle={t.t('lesson.yaku.subtitle')}
      drills={[GENERATORS.yakuIdentification, GENERATORS.yakuCompletion]}
    >
      <p>
        {t.t('lesson.yaku.p1a')} <strong>{t.t('lesson.yaku.p1yaku')}</strong>{' '}
        {t.t('lesson.yaku.p1b')}
      </p>
      <p>
        {t.t('lesson.yaku.p2a')} <strong>{t.t('lesson.yaku.p2han')}</strong>
        {t.t('lesson.yaku.p2b')}
      </p>
      <p>{t.t('lesson.yaku.p3')}</p>

      <div className="not-prose pt-2">
        <YakuReference />
      </div>
    </Lesson>
  )
}
