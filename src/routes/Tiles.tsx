import { Hand } from '../components/Hand'
import { Example, Lesson, Notation } from '../components/Lesson'
import { GENERATORS } from '../drills/generators'
import { parseTiles } from '../engine/tiles'
import { useT } from '../i18n'

export function TilesLesson() {
  const t = useT()
  return (
    <Lesson
      id="tiles"
      title={t.t('module.tiles.title')}
      subtitle={t.t('lesson.tiles.subtitle')}
      drills={[GENERATORS.tileRecognition, GENERATORS.terminalPicker]}
    >
      <p>{t.t('lesson.tiles.p1')}</p>

      <Example title={t.t('lesson.tiles.exMan')}>
        <Hand tiles={parseTiles('123456789m')} size="sm" sort={false} />
      </Example>
      <Example title={t.t('lesson.tiles.exPin')}>
        <Hand tiles={parseTiles('123456789p')} size="sm" sort={false} />
      </Example>
      <Example title={t.t('lesson.tiles.exSou')}>
        <Hand tiles={parseTiles('123456789s')} size="sm" sort={false} />
      </Example>
      <Example title={t.t('lesson.tiles.exHonor')}>
        <Hand tiles={parseTiles('1234567z')} size="sm" sort={false} />
      </Example>

      <p>
        {t.t('lesson.tiles.notation1')} <Notation>123m</Notation> {t.t('lesson.tiles.notation2')}{' '}
        <Notation>1z</Notation> {t.t('lesson.tiles.notation3')}
      </p>

      <h3 className="pt-2 font-semibold text-black dark:text-white">
        {t.t('lesson.tiles.h2Classes')}
      </h3>
      <p>
        {t.t('lesson.tiles.classes1')} <strong>{t.t('lesson.tiles.classesSimples')}</strong>{' '}
        {t.t('lesson.tiles.classes2')}{' '}
        <strong>{t.t('lesson.tiles.classesTerminals')}</strong> {t.t('lesson.tiles.classes3')}
      </p>

      <Example title={t.t('lesson.tiles.exTerminals')}>
        <Hand tiles={parseTiles('19m19p19s1234567z')} size="sm" sort={false} />
      </Example>

      <h3 className="pt-2 font-semibold text-black dark:text-white">
        {t.t('lesson.tiles.h2Dora')}
      </h3>
      <p>
        {t.t('lesson.tiles.dora1')} <strong>{t.t('lesson.tiles.doraIndicator')}</strong>
        {t.t('lesson.tiles.dora2')} <em>{t.t('lesson.tiles.doraNext')}</em>{' '}
        {t.t('lesson.tiles.dora3')}
      </p>
      <p>
        {t.t('lesson.tiles.red1')} <strong>{t.t('lesson.tiles.redFive')}</strong>
        {t.t('lesson.tiles.red2')}
      </p>

      <Example title={t.t('lesson.tiles.exRed')}>
        <Hand tiles={parseTiles('0m0p0s')} size="sm" sort={false} />
      </Example>
    </Lesson>
  )
}
