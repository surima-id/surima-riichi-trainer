/**
 * Renders the engine's scoring trace.
 *
 * This is the payoff of `explain.ts`: the same component explains a sandbox
 * hand and a wrong drill answer, always using the player's own tiles.
 */

import { type ScoredHand } from '../engine/explain'
import { paymentOf } from '../engine/score'
import { useT } from '../i18n'
import { Badge, LineItem, SectionTitle } from './ui'

export function Breakdown({ scored, dealer }: { scored: ScoredHand; dealer: boolean }) {
  const t = useT()

  if (!scored.valid) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
        {scored.reason && t.invalidReason(scored.reason)}
      </div>
    )
  }

  const { score, fu, yaku, dora, han, yakuman } = scored
  const tsumo = scored.context.tsumo

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>{t.t('breakdown.yaku')}</SectionTitle>
        <div>
          {yaku.map((y) => (
            <LineItem
              key={y.id}
              label={t.romaji(y.id)}
              detail={t.yaku(y.id)}
              value={
                y.yakuman
                  ? y.yakuman > 1
                    ? t.t('unit.yakumanMultiple', { n: y.yakuman })
                    : t.t('unit.yakuman')
                  : t.han(y.han)
              }
            />
          ))}
          {yakuman === 0 && dora.dora > 0 && (
            <LineItem label={t.t('breakdown.dora')} value={t.han(dora.dora)} />
          )}
          {yakuman === 0 && dora.red > 0 && (
            <LineItem label={t.t('breakdown.red')} value={t.han(dora.red)} />
          )}
          {yakuman === 0 && dora.ura > 0 && (
            <LineItem label={t.t('breakdown.ura')} value={t.han(dora.ura)} />
          )}
        </div>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          {yakuman > 0
            ? t.t('breakdown.yakumanReplaces')
            : t.t('breakdown.total', { n: t.han(han) })}
        </p>
      </section>

      {yakuman === 0 && (
        <section>
          <SectionTitle>{t.t('breakdown.fu')}</SectionTitle>
          <div>
            {fu.items.map((item, i) => {
              const { label, detail } = t.fuItem(item)
              return <LineItem key={i} label={label} detail={detail} value={t.fu(item.fu)} />
            })}
          </div>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            {fu.raw === fu.total
              ? t.t('breakdown.total', { n: t.fu(fu.total) })
              : t.t('breakdown.fuRounded', { raw: fu.raw, total: t.fu(fu.total) })}
          </p>
          <p className="mt-1 text-sm text-black/50 dark:text-white/50">
            {t.wait(scored.wait.type, 'long')}
          </p>
        </section>
      )}

      <section>
        <SectionTitle>{t.t('breakdown.score')}</SectionTitle>
        <div>
          {yakuman === 0 && (
            <LineItem
              label={t.t('breakdown.basePoints')}
              detail={
                score.limit === 'none'
                  ? t.t('breakdown.baseFormula', { fu: fu.total, han })
                  : t.t('breakdown.baseCapped')
              }
              value={score.basePoints}
            />
          )}
          {score.limit !== 'none' && (
            <LineItem label={t.t('breakdown.limitHand')} value={t.limit(score.limit)} />
          )}
          <LineItem
            label={t.t(tsumo ? 'breakdown.tsumoPayments' : 'breakdown.ronPayment')}
            detail={t.t(dealer ? 'breakdown.dealerHand' : 'breakdown.nonDealerHand')}
            value={t.payment(paymentOf(score, tsumo, dealer))}
          />
          {score.honbaBonus > 0 && (
            <LineItem label={t.t('breakdown.honba')} value={`+${score.honbaBonus}`} />
          )}
          {score.riichiBonus > 0 && (
            <LineItem label={t.t('breakdown.riichiSticks')} value={`+${score.riichiBonus}`} />
          )}
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-black/60 dark:text-white/60">{t.t('breakdown.youCollect')}</span>
          <Badge tone="good">{t.t('unit.points', { n: score.total })}</Badge>
        </p>
      </section>
    </div>
  )
}
