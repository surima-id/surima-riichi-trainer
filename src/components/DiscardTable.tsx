/**
 * The ukeire answer: every discard, what it leaves, and what it accepts.
 *
 * This is the shape Tenhou's analyser prints and the shape a player argues in —
 * discard, then the tiles that help, then how many of them are left. Drawing
 * the accepted tiles rather than listing their notation is what makes a row
 * readable at a glance: a wide wait looks wide.
 *
 * It lives here rather than inside a page because it is the efficiency drill's
 * explanation. A player who has just been told their discard was wrong wants to
 * see what the better one accepts, set beside what theirs did.
 */

import { type DiscardOption } from '../engine/shanten'
import { useT } from '../i18n'
import { Tile } from './Tile'
import { Badge, stagger } from './ui'

/** One discard's row: the tile thrown, what it leaves, and what it accepts. */
export function DiscardRow({
  option,
  best,
  index,
}: {
  option: DiscardOption
  /** Ringed as one of the best discards — there may be several, tied. */
  best: boolean
  index: number
}) {
  const t = useT()

  return (
    <li
      className={`anim-fade-up rounded-xl border p-3 transition duration-200 ${
        best
          ? 'border-emerald-500/40 bg-emerald-500/[0.07]'
          : 'border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]'
      }`}
      style={stagger(index, 40)}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Tile tile={option.tile} size="xs" />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={option.shanten === 0 ? 'good' : 'neutral'}>
            {option.shanten === 0 ? t.t('ukeire.ready') : t.t('ukeire.away', { n: option.shanten })}
          </Badge>
          {/* The headline number: how many tiles this discard leaves you live
              to. Set in the same tabular figures as the rest of the app, so the
              column scans vertically. */}
          <span className="font-mono text-sm font-semibold tabular-nums">
            {t.t('unit.tiles', { n: option.tilesLeft })}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-1.5 sm:ml-auto">
          {option.accepts.map(({ tile, remaining }) => (
            <span key={tile} className="flex flex-col items-center gap-0.5">
              <Tile tile={tile} size="xs" />
              <span className="font-mono text-[0.65rem] tabular-nums text-black/50 dark:text-white/50">
                {remaining}
              </span>
            </span>
          ))}
        </div>
      </div>
    </li>
  )
}

/**
 * The ranked discards for one hand.
 *
 * Only the discards that keep the hand as close as it can be are listed. Every
 * tile is a legal discard, so the full list runs to twelve or more rows — and
 * the ones that give up a step are the loudest, because a hand further from
 * ready accepts far more tiles. Showing 78 above 23 invites exactly the
 * misreading the lesson warns against: acceptance is only comparable between
 * discards that leave the same shanten.
 */
export function DiscardTable({ options }: { options: DiscardOption[] }) {
  const t = useT()
  const top = options[0]?.shanten
  const best = options.filter((o) => o.shanten === top)
  const bestAcceptance = best[0]?.tilesLeft

  return (
    <div>
      <p className="mb-1.5 text-black/60 dark:text-white/60">
        {t.t('drill.efficiency.discard.ranked')}
      </p>
      <ul className="space-y-2">
        {best.map((option, i) => (
          <DiscardRow
            key={option.tile}
            option={option}
            // Several discards can be tied on both shanten and acceptance, and
            // all of them are equally right; marking only the first would claim
            // an ordering the numbers do not support.
            best={option.tilesLeft === bestAcceptance}
            index={i}
          />
        ))}
      </ul>
    </div>
  )
}
