import { Hand } from '../components/Hand'
import { Example, Lesson } from '../components/Lesson'
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
    >
      <p>{t.t('lesson.efficiency.p1')}</p>
      <p>
        <strong>{t.t('lesson.efficiency.p2a')}</strong> {t.t('lesson.efficiency.p2b')}
      </p>
      <p>
        <strong>{t.t('lesson.efficiency.p3a')}</strong>
        {t.t('lesson.efficiency.p3b')}
      </p>

      <h3 className="pt-2 font-semibold text-black dark:text-white">
        {t.t('lesson.efficiency.h2Ryanmen')}
      </h3>
      <p>{t.t('lesson.efficiency.ryanmen')}</p>

      <Example title={t.t('lesson.efficiency.exEight')}>
        <Hand tiles={parseTiles('34m')} size="sm" sort={false} />
      </Example>
      <Example title={t.t('lesson.efficiency.exFour')}>
        <Hand tiles={parseTiles('13m')} size="sm" sort={false} />
      </Example>

      <h3 className="pt-2 font-semibold text-black dark:text-white">
        {t.t('lesson.efficiency.h2Order')}
      </h3>
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
