/**
 * The context strip that sits above a drill hand.
 *
 * Everything the scorer uses but the tiles cannot show — the dora indicators,
 * the two winds, and whether the hand was drawn or claimed — gathered into one
 * band directly over the hand it applies to.
 *
 * It replaces a row of loose badges below the tiles. The badges said the same
 * things, but a player reading a hand looks at the hand, and information placed
 * after it is information consulted late or not at all. This is also the layout
 * riichi clients use, so the reading habit carries over to a real table.
 */

import { type Tile as TileValue } from '../engine/tiles'
import { useT } from '../i18n'
import { Tile } from './Tile'

/** Indicator slots always shown, so the strip does not change width. */
const DORA_SLOTS = 5

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      {/* The gold tick is the separator between fields; it reads as one band
          rather than as a row of separate chips. */}
      <span aria-hidden="true" className="h-3.5 w-0.5 shrink-0 rounded-full bg-gold-400" />
      <span className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {label}
      </span>
      {children}
    </span>
  )
}

export interface HandContextProps {
  doraIndicators?: TileValue[]
  seatWind?: TileValue
  roundWind?: TileValue
  tsumo?: boolean
  /** Extra conditions worth stating, e.g. a riichi declaration. */
  flags?: string[]
}

export function HandContext({
  doraIndicators = [],
  seatWind,
  roundWind,
  tsumo,
  flags = [],
}: HandContextProps) {
  const t = useT()

  return (
    <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-xl border border-black/5 bg-black/[0.04] px-3 py-2 dark:border-white/10 dark:bg-white/[0.06]">
      {doraIndicators.length > 0 && (
        <Field label={t.t('context.dora')}>
          <span className="flex items-end gap-0.5 rounded-md bg-sky-500/10 p-1">
            {doraIndicators.map((tile, i) => (
              <Tile key={i} tile={tile} size="xs" />
            ))}
            {/* The unflipped indicators. A real table shows five slots and turns
                them over one per kan, so the empty ones are information: they
                say how many kans have been called. */}
            {Array.from({ length: Math.max(0, DORA_SLOTS - doraIndicators.length) }, (_, i) => (
              <span
                key={`slot-${i}`}
                aria-hidden="true"
                className="w-[clamp(2.25rem,2.03rem+0.87vw,2.75rem)] rounded-[8%] bg-black/[0.07] dark:bg-white/10"
                style={{ aspectRatio: '3 / 4' }}
              />
            ))}
          </span>
        </Field>
      )}

      {seatWind !== undefined && (
        <Field label={t.t('context.seatWind')}>
          <span className="text-sm font-semibold">{t.tile(seatWind)}</span>
        </Field>
      )}

      {roundWind !== undefined && (
        <Field label={t.t('context.roundWind')}>
          <span className="text-sm font-semibold">{t.tile(roundWind)}</span>
        </Field>
      )}

      {flags.map((flag) => (
        <Field key={flag} label={flag}>
          <span />
        </Field>
      ))}

      {tsumo !== undefined && (
        // The win condition is the one field that changes what you compute
        // rather than what you count, so it is set apart and in gold.
        <span className="ml-auto text-lg font-extrabold tracking-tight text-gold-500 dark:text-gold-400">
          {t.t(tsumo ? 'context.tsumo' : 'context.ron')}
        </span>
      )}
    </div>
  )
}
