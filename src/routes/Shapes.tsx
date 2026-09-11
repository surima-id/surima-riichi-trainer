import { Hand } from '../components/Hand'
import { Example, Lesson, Notation } from '../components/Lesson'
import { LessonHeading } from '../components/ui'
import { GENERATORS } from '../drills/generators'
import { parseTiles } from '../engine/tiles'
import { useT } from '../i18n'

export function ShapesLesson() {
  const t = useT()
  return (
    <Lesson
      id="shapes"
      title={t.t('lesson.shapes.title')}
      subtitle={t.t('lesson.shapes.subtitle')}
      drills={[GENERATORS.waitIdentification]}
    >
      <p>
        {t.t('lesson.shapes.p1a')} <strong>{t.t('lesson.shapes.p1b')}</strong>
        {t.t('lesson.shapes.p1c')} <strong>{t.t('lesson.shapes.p1run')}</strong>{' '}
        {t.t('lesson.shapes.p1d')} <strong>{t.t('lesson.shapes.p1triplet')}</strong>{' '}
        {t.t('lesson.shapes.p1e')}
      </p>

      <Example title={t.t('lesson.shapes.exComplete')}>
        <Hand tiles={parseTiles('123m456m789m555p22s')} size="sm" sort={false} />
      </Example>

      <p>
        {t.t('lesson.shapes.p2a')} <Notation>891m</Notation> {t.t('lesson.shapes.p2b')}{' '}
        <Notation>9m1p2p</Notation>
        {t.t('lesson.shapes.p2c')}
      </p>

      <LessonHeading>{t.t('lesson.shapes.h2Open')}</LessonHeading>
      <p>
        {t.t('lesson.shapes.open1')} <strong>{t.t('lesson.shapes.openWord')}</strong>{' '}
        {t.t('lesson.shapes.open2')}
      </p>

      <LessonHeading>{t.t('lesson.shapes.h2Waits')}</LessonHeading>
      <p>
        {t.t('lesson.shapes.waits1')} <strong>{t.t('lesson.shapes.waitsTenpai')}</strong>{' '}
        {t.t('lesson.shapes.waits2')} <strong>{t.t('lesson.shapes.waitsWait')}</strong>
        {t.t('lesson.shapes.waits3')}
      </p>

      <Example title={t.t('lesson.shapes.exRyanmen')}>
        <Hand tiles={parseTiles('34m')} size="sm" sort={false} />
      </Example>
      <Example title={t.t('lesson.shapes.exKanchan')}>
        <Hand tiles={parseTiles('13m')} size="sm" sort={false} />
      </Example>
      <Example title={t.t('lesson.shapes.exPenchan')}>
        <Hand tiles={parseTiles('12m')} size="sm" sort={false} />
      </Example>
      <Example title={t.t('lesson.shapes.exShanpon')}>
        <Hand tiles={parseTiles('11m55p')} size="sm" sort={false} />
      </Example>
      <Example title={t.t('lesson.shapes.exTanki')}>
        <Hand tiles={parseTiles('5m')} size="sm" sort={false} />
      </Example>

      <LessonHeading>{t.t('lesson.shapes.h2Special')}</LessonHeading>
      <p>
        <strong>{t.t('lesson.shapes.specialA')}</strong> {t.t('lesson.shapes.specialB')}{' '}
        <strong>{t.t('lesson.shapes.specialC')}</strong> {t.t('lesson.shapes.specialD')}
      </p>

      <Example title={t.t('lesson.shapes.exKokushi')}>
        <Hand tiles={parseTiles('19m19p19s12345677z')} size="sm" sort={false} />
      </Example>
      {/* The prose names both exceptions; without this, only one of them was
          ever shown. The pairs are drawn in suit order so the shape reads as
          seven pairs at a glance rather than as fourteen loose tiles. */}
      <Example title={t.t('lesson.shapes.exChiitoitsu')}>
        <Hand tiles={parseTiles('1133m5577p2299s11z')} size="sm" sort={false} />
      </Example>
    </Lesson>
  )
}
