/**
 * The scoring lesson.
 *
 * The han/fu grid is computed from `scoreHand` rather than transcribed, so the
 * table a learner memorizes is guaranteed to be the table the engine applies.
 */

import { Lesson } from '../components/Lesson'
import { Card, LessonHeading } from '../components/ui'
import { GENERATORS } from '../drills/generators'
import { KIRIAGE_BASE, paymentOf, scoreHand } from '../engine/score'
import { useT } from '../i18n'

const FU_COLUMNS = [20, 25, 30, 40, 50, 60, 70] as const
const HAN_ROWS = [1, 2, 3, 4] as const

function ScoreTable({ dealer, tsumo }: { dealer: boolean; tsumo: boolean }) {
  const t = useT()
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10">
            <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
              {t.t('lesson.score.tableHan')}
            </th>
            {FU_COLUMNS.map((fu) => (
              <th
                key={fu}
                className="px-2 py-2 text-right text-xs font-semibold text-black/45 dark:text-white/45"
              >
                {t.t('lesson.score.tableFu', { n: fu })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HAN_ROWS.map((han) => (
            <tr
              key={han}
              className="border-b border-black/5 transition-colors hover:bg-black/[0.03] last:border-0 dark:border-white/5 dark:hover:bg-white/[0.04]"
            >
              <td className="py-2.5 pr-3 font-semibold">{han}</td>
              {FU_COLUMNS.map((fu) => {
                // 20 fu only exists as a pinfu self-draw, and 25 fu only as
                // seven pairs, so the impossible cells are blanked out.
                const impossible = (fu === 20 && !tsumo) || (fu === 25 && han === 1)
                if (impossible) {
                  return (
                    <td key={fu} className="px-2 py-2.5 text-right text-black/25 dark:text-white/25">
                      —
                    </td>
                  )
                }
                const result = scoreHand({ han, fu, dealer, tsumo })
                // Gold marks the cells kiriage actually promoted, which is a
                // narrower set than "mangan below 5 han": 4 han 40 fu reaches
                // the cap on the plain formula and was never rounded. Testing
                // the raw base against the threshold is what tells the two
                // apart.
                const rounded = fu * Math.pow(2, 2 + han) === KIRIAGE_BASE
                return (
                  <td
                    key={fu}
                    className={`px-2 py-2.5 text-right font-mono tabular-nums ${
                      rounded ? 'font-bold text-gold-500 dark:text-gold-400' : ''
                    }`}
                  >
                    {t.payment(paymentOf(result, tsumo, dealer))}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr>
            <td className="py-2.5 pr-3 font-semibold">5+</td>
            <td
              colSpan={FU_COLUMNS.length}
              className="px-2 py-2.5 text-right font-mono tabular-nums"
            >
              {t.t('lesson.score.tableManganRow', {
                payment: t.payment(
                  paymentOf(scoreHand({ han: 5, fu: 30, dealer, tsumo }), tsumo, dealer),
                ),
              })}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function ScoreLesson() {
  const t = useT()
  return (
    <Lesson
      id="score"
      title={t.t('module.score.title')}
      subtitle={t.t('lesson.score.subtitle')}
      /**
       * Two tracks rather than one mixed quiz.
       *
       * Both ask the same question — what does this hand pay — but one offers
       * four payments to choose between and the other wants the figures typed.
       * Interleaving them made a quiz whose score meant nothing in particular,
       * and gave a learner no way to stay on the easier reading until the
       * payment table was familiar.
       */
      tracks={[
        { key: 'quiz.track.simple', drills: [GENERATORS.scorePick] },
        { key: 'quiz.track.advanced', drills: [GENERATORS.scoreCount] },
      ]}
    >
      <p>
        {t.t('lesson.score.p1a')} <strong>{t.t('lesson.score.p1base')}</strong>:
      </p>
      <p className="rounded-xl border border-black/5 bg-black/[0.04] px-4 py-4 text-center font-mono text-lg font-medium dark:border-white/10 dark:bg-white/[0.06]">
        base = fu × 2<sup>(2 + han)</sup>
      </p>
      <p>
        {t.t('lesson.score.p2a')} <strong>{t.t('lesson.score.p2x4')}</strong>{' '}
        {t.t('lesson.score.p2b')} <strong>{t.t('lesson.score.p2x6')}</strong>
        {t.t('lesson.score.p2c')} <em>{t.t('lesson.score.p2up')}</em> {t.t('lesson.score.p2d')}
      </p>
      <p>
        {t.t('lesson.score.p3a')} <strong>{t.t('lesson.score.p3mangan')}</strong>{' '}
        {t.t('lesson.score.p3b')}
      </p>

      <LessonHeading>{t.t('lesson.score.h2Kiriage')}</LessonHeading>
      <p>
        {t.t('lesson.score.kiriage1')} <strong>{t.t('lesson.score.kiriageTerm')}</strong>
        {t.t('lesson.score.kiriage2')}
      </p>
      <p>{t.t('lesson.score.kiriage3')}</p>

      <LessonHeading>{t.t('lesson.score.h2Limits')}</LessonHeading>
      <p>{t.t('lesson.score.limits')}</p>

      <LessonHeading>{t.t('lesson.score.tableNonDealerRon')}</LessonHeading>
      <div className="not-prose">
        <Card>
          <ScoreTable dealer={false} tsumo={false} />
        </Card>
      </div>

      <LessonHeading>{t.t('lesson.score.tableNonDealerTsumo')}</LessonHeading>
      <p className="text-sm">{t.t('lesson.score.tableNonDealerTsumoNote')}</p>
      <div className="not-prose">
        <Card>
          <ScoreTable dealer={false} tsumo />
        </Card>
      </div>

      <LessonHeading>{t.t('lesson.score.tableDealerRon')}</LessonHeading>
      <div className="not-prose">
        <Card>
          <ScoreTable dealer tsumo={false} />
        </Card>
      </div>

      <LessonHeading>{t.t('lesson.score.tableDealerTsumo')}</LessonHeading>
      <p className="text-sm">{t.t('lesson.score.tableDealerTsumoNote')}</p>
      <div className="not-prose">
        <Card>
          <ScoreTable dealer tsumo />
        </Card>
      </div>

      <p className="pt-2">{t.t('lesson.score.closing')}</p>
    </Lesson>
  )
}
