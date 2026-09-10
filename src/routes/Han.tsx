import { Hand } from '../components/Hand'
import { Example, Lesson } from '../components/Lesson'
import { GENERATORS } from '../drills/generators'
import { parseTiles } from '../engine/tiles'
import { useT } from '../i18n'

export function HanLesson() {
  const t = useT()
  return (
    <Lesson
      id="han"
      title={t.t('module.han.title')}
      subtitle={t.t('lesson.han.subtitle')}
      drills={[GENERATORS.hanCount]}
    >
      <p>
        <strong>{t.t('lesson.han.p1a')}</strong> {t.t('lesson.han.p1b')}
      </p>

      <ol className="list-decimal space-y-1 pl-5">
        <li>{t.t('lesson.han.step1')}</li>
        <li>{t.t('lesson.han.step2')}</li>
      </ol>

      <p>
        {t.t('lesson.han.p2a')} <strong>{t.t('lesson.han.p2b')}</strong>
        {t.t('lesson.han.p2c')}
      </p>

      <h3 className="pt-2 font-semibold text-black dark:text-white">{t.t('lesson.han.h2Open')}</h3>
      <p>{t.t('lesson.han.open')}</p>

      <Example title={t.t('lesson.han.exClosed')}>
        <Hand tiles={parseTiles('234m22p345678s567s')} size="sm" sort={false} />
      </Example>

      <p>{t.t('lesson.han.exNote')}</p>

      <h3 className="pt-2 font-semibold text-black dark:text-white">{t.t('lesson.han.h2Stops')}</h3>
      <p>
        {t.t('lesson.han.stops1')} <strong>{t.t('lesson.han.stopsMangan')}</strong>{' '}
        {t.t('lesson.han.stops2')}
      </p>
    </Lesson>
  )
}
