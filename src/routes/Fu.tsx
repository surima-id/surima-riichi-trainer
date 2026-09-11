import { Hand } from '../components/Hand'
import { Example, Lesson } from '../components/Lesson'
import { Card, LessonHeading, LineItem } from '../components/ui'
import { GENERATORS } from '../drills/generators'
import { scoreHandFull } from '../engine/explain'
import { type Call } from '../engine/parse'
import { parseTiles } from '../engine/tiles'
import { defaultContext } from '../engine/yaku'
import { useT } from '../i18n'
import { type MessageKey } from '../i18n'

/**
 * The triplet fu table.
 *
 * Rows are keyed by the same catalog entries the scorer's own breakdown uses,
 * so what a learner memorizes here is word-for-word what they see in a result.
 */
const TRIPLET_ROWS: { key: MessageKey; fu: number }[] = [
  { key: 'fu.meld.triplet.open.simple', fu: 2 },
  { key: 'fu.meld.triplet.concealed.simple', fu: 4 },
  { key: 'fu.meld.triplet.open.terminal-honor', fu: 4 },
  { key: 'fu.meld.triplet.concealed.terminal-honor', fu: 8 },
  { key: 'fu.meld.kan.open.simple', fu: 8 },
  { key: 'fu.meld.kan.concealed.simple', fu: 16 },
  { key: 'fu.meld.kan.open.terminal-honor', fu: 16 },
  { key: 'fu.meld.kan.concealed.terminal-honor', fu: 32 },
]

/**
 * The same hand twice, differing only in how its kan was obtained.
 *
 * A kan is the one meld whose fu a player cannot reach from the triplet rules:
 * it quadruples rather than doubles. Showing the closed and open versions side
 * by side isolates that — identical tiles, identical wait, and a 30 fu gap
 * that comes entirely from whether the fourth tile was drawn or claimed.
 */
const KAN_EXAMPLE_TILES = '234p567p345s99s'
const KAN_EXAMPLE_WIN = '3s'

function kanCall(notation: string, kind: 'ankan' | 'minkan'): Call {
  const tiles = parseTiles(notation)
  return { kind, tile: tiles[0], tiles }
}

/**
 * Runs the example through the scorer rather than stating its fu inline, so the
 * number the lesson teaches cannot drift from the number the drill marks right.
 */
function kanExampleFu(kind: 'ankan' | 'minkan'): number {
  const hand = {
    concealed: parseTiles(KAN_EXAMPLE_TILES),
    calls: [kanCall('1111m', kind)],
    winTile: parseTiles(KAN_EXAMPLE_WIN)[0],
  }
  return scoreHandFull(hand, defaultContext({ riichi: kind === 'ankan' })).fu.total
}

function KanExample({ kind }: { kind: 'ankan' | 'minkan' }) {
  return (
    <Hand
      tiles={parseTiles(KAN_EXAMPLE_TILES)}
      calls={[kanCall('1111m', kind)]}
      winTile={parseTiles(KAN_EXAMPLE_WIN)[0]}
      size="sm"
      sort={false}
    />
  )
}

export function FuLesson() {
  const t = useT()
  return (
    <Lesson
      id="fu"
      title={t.t('module.fu.title')}
      subtitle={t.t('lesson.fu.subtitle')}
      drills={[GENERATORS.fuCount]}
    >
      <p>
        <strong>{t.t('lesson.fu.p1a')}</strong> {t.t('lesson.fu.p1b')}
      </p>

      <div className="not-prose">
        <Card>
          <LineItem label={t.t('lesson.fu.rowBase')} value={t.fu(20)} />
          <LineItem
            label={t.t('lesson.fu.rowMenzenRon')}
            value={`+${t.fu(10)}`}
            detail={t.t('fu.menzen-ron.detail')}
          />
          <LineItem
            label={t.t('lesson.fu.rowTsumo')}
            value={`+${t.fu(2)}`}
            detail={t.t('lesson.fu.rowTsumoDetail')}
          />
          <LineItem
            label={t.t('lesson.fu.rowWait')}
            value={`+${t.fu(2)}`}
            detail={t.t('lesson.fu.rowWaitDetail')}
          />
          <LineItem label={t.t('lesson.fu.rowPair')} value={`+${t.fu(2)}`} />
        </Card>
      </div>

      <LessonHeading>{t.t('lesson.fu.h2Triplets')}</LessonHeading>
      <p>{t.t('lesson.fu.triplets')}</p>

      <div className="not-prose">
        <Card>
          {TRIPLET_ROWS.map((row) => (
            <LineItem key={row.key} label={t.t(row.key)} value={t.fu(row.fu)} />
          ))}
        </Card>
      </div>

      <p className="pt-2">
        {t.t('lesson.fu.ronRule1')} <strong>{t.t('lesson.fu.ronRuleBold')}</strong>{' '}
        {t.t('lesson.fu.ronRule2')}
      </p>

      <LessonHeading>{t.t('lesson.fu.h2Special')}</LessonHeading>
      <p>
        <strong>{t.t('lesson.fu.specialA')}</strong> {t.t('lesson.fu.specialB')}{' '}
        <strong>{t.t('lesson.fu.specialC')}</strong> {t.t('lesson.fu.specialD')}{' '}
        <strong>{t.t('lesson.fu.specialE')}</strong> {t.t('lesson.fu.specialF')}
      </p>

      <Example title={t.t('lesson.fu.exPinfu')}>
        <Hand tiles={parseTiles('234m22p345678s567s')} size="sm" sort={false} />
      </Example>

      <LessonHeading>{t.t('lesson.fu.h2Kan')}</LessonHeading>
      <p>{t.t('lesson.fu.kanIntro')}</p>

      <Example title={t.t('lesson.fu.exAnkan', { fu: t.fu(kanExampleFu('ankan')) })}>
        <KanExample kind="ankan" />
        <p className="mt-2.5 text-sm text-black/60 dark:text-white/60">
          {t.t('lesson.fu.exAnkanNote')}
        </p>
      </Example>

      <Example title={t.t('lesson.fu.exMinkan', { fu: t.fu(kanExampleFu('minkan')) })}>
        <KanExample kind="minkan" />
        <p className="mt-2.5 text-sm text-black/60 dark:text-white/60">
          {t.t('lesson.fu.exMinkanNote')}
        </p>
      </Example>

      <p>{t.t('lesson.fu.floor')}</p>
    </Lesson>
  )
}
