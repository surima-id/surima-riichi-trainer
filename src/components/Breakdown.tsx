/**
 * Renders the engine's scoring trace.
 *
 * This is the payoff of `explain.ts`: the same component explains a sandbox
 * hand and a wrong drill answer, always using the player's own tiles.
 */

import { type ScoredHand } from '../engine/explain'
import { paymentOf } from '../engine/score'
import { useT } from '../i18n'
import { LineItem, SectionTitle, stagger } from './ui'

/**
 * The yaku a hand has, on their own.
 *
 * The yaku drills ask what pattern the tiles make, and stop there. `Breakdown`
 * answers that and then keeps going into fu, the payment row and the totals —
 * the right answer to a scoring question, and three sections of arithmetic a
 * player was never asked about here. Dora are left out for the same reason the
 * drills stop dealing them: they are flipped in the dead wall, not read off the
 * hand, so they cannot be part of what the player was meant to spot.
 */
export function YakuList({ scored }: { scored: ScoredHand }) {
  const t = useT()

  if (!scored.valid) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
        {scored.reason && t.invalidReason(scored.reason)}
      </div>
    )
  }

  return (
    <section>
      <SectionTitle>{t.t('breakdown.yaku')}</SectionTitle>
      <div>
        {scored.yaku.map((y, i) => (
          <LineItem
            key={y.id}
            style={stagger(i)}
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
      </div>
    </section>
  )
}

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
          {yaku.map((y, i) => (
            <LineItem
              key={y.id}
              style={stagger(i)}
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
              return (
                <LineItem
                  key={i}
                  style={stagger(i)}
                  label={label}
                  detail={detail}
                  value={t.fu(item.fu)}
                />
              )
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
        <p className="mt-4 flex flex-wrap items-center gap-2.5">
          <span className="text-black/60 dark:text-white/60">{t.t('breakdown.youCollect')}</span>
          {/* The payout is the answer the whole breakdown was building to, so it
              is set larger than the rows above it and pops in on arrival. */}
          <span className="anim-pop rounded-xl bg-emerald-500/15 px-3 py-1.5 font-mono text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {t.t('unit.points', { n: score.total })}
          </span>
        </p>
      </section>
    </div>
  )
}
