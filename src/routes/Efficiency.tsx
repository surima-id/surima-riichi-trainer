import { Hand } from '../components/Hand'
import { Example, Lesson } from '../components/Lesson'
import { LessonHeading } from '../components/ui'
import { UkeireCalculator } from '../components/Ukeire'
import { GENERATORS } from '../drills/generators'
import { parseTiles } from '../engine/tiles'
import { useT } from '../i18n'

export function EfficiencyLesson() {
  const t = useT()
  return (
    <Lesson
      id="efficiency"
      title={t.t('module.efficiency.title')}
      subtitle={t.t('lesson.efficiency.subtitle')}
      drills={[GENERATORS.efficiencyDrill]}
      /* The calculator sits below the drill rather than inside the lesson body,
         which `Lesson` withdraws once a quiz starts. A reference tool is the one
         thing worth keeping on screen while practising: a player who has just
         been told their discard was wrong wants to try the alternative. */
      after={<UkeireCalculator />}
    >
      <p>{t.t('lesson.efficiency.p1')}</p>
      <p>
        <strong>{t.t('lesson.efficiency.p2a')}</strong> {t.t('lesson.efficiency.p2b')}
      </p>
      <p>
        <strong>{t.t('lesson.efficiency.p3a')}</strong>
        {t.t('lesson.efficiency.p3b')}
      </p>

      <LessonHeading>{t.t('lesson.efficiency.h2Ryanmen')}</LessonHeading>
      <p>{t.t('lesson.efficiency.ryanmen')}</p>

      <Example title={t.t('lesson.efficiency.exEight')}>
        <Hand tiles={parseTiles('34m')} size="sm" sort={false} />
      </Example>
      <Example title={t.t('lesson.efficiency.exFour')}>
        <Hand tiles={parseTiles('13m')} size="sm" sort={false} />
      </Example>

      <LessonHeading>{t.t('lesson.efficiency.h2Order')}</LessonHeading>
      <ol className="list-decimal space-y-1 pl-5">
        <li>{t.t('lesson.efficiency.order1')}</li>
        <li>{t.t('lesson.efficiency.order2')}</li>
        <li>{t.t('lesson.efficiency.order3')}</li>
        <li>{t.t('lesson.efficiency.order4')}</li>
      </ol>

      <p>{t.t('lesson.efficiency.closing')}</p>
    </Lesson>
  )
}
