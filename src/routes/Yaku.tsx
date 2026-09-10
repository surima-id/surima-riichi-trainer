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
import { Badge, Card } from '../components/ui'
import { YAKU_SAMPLES } from '../content/yakuSamples'
import { GENERATORS } from '../drills/generators'
import { parseTiles } from '../engine/tiles'
import { YAKU_LIST, type YakuId } from '../engine/yaku'
import { useT } from '../i18n'

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

type Entry = (typeof YAKU_LIST)[number]

interface Group {
  id: string
  title: string
  note?: string
  entries: Entry[]
}

function YakuCard({ entry }: { entry: Entry }) {
  const t = useT()
  const sample = YAKU_SAMPLES[entry.id]
  const tiles = useMemo(() => parseTiles(sample.hand), [sample.hand])
  const winTile = useMemo(() => parseTiles(sample.win)[0], [sample.win])

  return (
    <div className="border-b border-black/5 py-4 last:border-0 dark:border-white/5">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className="font-semibold">{t.romaji(entry.id)}</h4>
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
      <div className="overflow-x-auto">
        <Hand tiles={tiles} calls={sample.calls} winTile={winTile} size="xs" />
      </div>
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

    const yakuman = visible.filter((y) => y.yakuman > 0)
    const situational = visible.filter((y) => y.yakuman === 0 && SITUATIONAL.has(y.id))
    const shape = visible.filter((y) => y.yakuman === 0 && !SITUATIONAL.has(y.id))

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
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              filter === f.id
                ? 'bg-felt-700 text-white dark:bg-felt-100 dark:text-felt-900'
                : 'bg-black/5 text-black/70 hover:bg-black/10 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15'
            }`}
          >
            {t.t(f.key)}
          </button>
        ))}
      </div>

      {groups.map((group) => (
        <section key={group.id}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
            {group.title}
          </h3>
          {group.note && (
            <p className="mb-2 text-sm text-black/55 dark:text-white/55">{group.note}</p>
          )}
          <Card>
            {group.entries.map((entry) => (
              <YakuCard key={entry.id} entry={entry} />
            ))}
          </Card>
        </section>
      ))}
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
      drills={[GENERATORS.yakuIdentification]}
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
