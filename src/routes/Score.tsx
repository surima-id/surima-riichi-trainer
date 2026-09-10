/**
 * The scoring lesson.
 *
 * The han/fu grid is computed from `scoreHand` rather than transcribed, so the
 * table a learner memorizes is guaranteed to be the table the engine applies.
 */

import { Lesson } from '../components/Lesson'
import { Card } from '../components/ui'
import { GENERATORS } from '../drills/generators'
import { paymentOf, scoreHand } from '../engine/score'
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
            <th className="py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
              {t.t('lesson.score.tableHan')}
            </th>
            {FU_COLUMNS.map((fu) => (
              <th key={fu} className="px-2 py-2 text-right text-xs font-medium text-black/45 dark:text-white/45">
                {t.t('lesson.score.tableFu', { n: fu })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HAN_ROWS.map((han) => (
            <tr key={han} className="border-b border-black/5 last:border-0 dark:border-white/5">
              <td className="py-2 pr-3 font-medium">{han}</td>
              {FU_COLUMNS.map((fu) => {
                // 20 fu only exists as a pinfu self-draw, and 25 fu only as
                // seven pairs, so the impossible cells are blanked out.
                const impossible = (fu === 20 && !tsumo) || (fu === 25 && han === 1)
                if (impossible) {
                  return (
                    <td key={fu} className="px-2 py-2 text-right text-black/25 dark:text-white/25">
                      —
                    </td>
                  )
                }
                const result = scoreHand({ han, fu, dealer, tsumo })
                return (
                  <td key={fu} className="px-2 py-2 text-right font-mono tabular-nums">
                    {t.payment(paymentOf(result, tsumo, dealer))}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr>
            <td className="py-2 pr-3 font-medium">5+</td>
            <td colSpan={FU_COLUMNS.length} className="px-2 py-2 text-right font-mono tabular-nums">
              {t.t('lesson.score.tableManganRow', {
                payment: t.payment(paymentOf(scoreHand({ han: 5, fu: 30, dealer, tsumo }), tsumo, dealer)),
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
      drills={[GENERATORS.scoreCount]}
    >
      <p>
        {t.t('lesson.score.p1a')} <strong>{t.t('lesson.score.p1base')}</strong>:
      </p>
      <p className="rounded-lg bg-black/[0.04] px-4 py-3 text-center font-mono text-sm dark:bg-white/[0.06]">
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

      <h3 className="pt-2 font-semibold text-black dark:text-white">
        {t.t('lesson.score.h2Limits')}
      </h3>
      <p>{t.t('lesson.score.limits')}</p>

      <h3 className="pt-2 font-semibold text-black dark:text-white">
        {t.t('lesson.score.tableNonDealerRon')}
      </h3>
      <div className="not-prose">
        <Card>
          <ScoreTable dealer={false} tsumo={false} />
        </Card>
      </div>

      <h3 className="pt-2 font-semibold text-black dark:text-white">
        {t.t('lesson.score.tableNonDealerTsumo')}
      </h3>
      <p className="text-sm">{t.t('lesson.score.tableNonDealerTsumoNote')}</p>
      <div className="not-prose">
        <Card>
          <ScoreTable dealer={false} tsumo />
        </Card>
      </div>

      <h3 className="pt-2 font-semibold text-black dark:text-white">
        {t.t('lesson.score.tableDealerRon')}
      </h3>
      <div className="not-prose">
        <Card>
          <ScoreTable dealer tsumo={false} />
        </Card>
      </div>

      <h3 className="pt-2 font-semibold text-black dark:text-white">
        {t.t('lesson.score.tableDealerTsumo')}
      </h3>
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
