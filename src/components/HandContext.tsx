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

/**
 * One row of the indicator block: the flipped tiles, then the empty slots.
 *
 * A real table shows five slots per row and turns them over one per kan, so the
 * empty ones are information: they say how many kans have been called.
 */
function IndicatorRow({ tiles }: { tiles: TileValue[] }) {
  return (
    <span className="flex items-end gap-0.5">
      {tiles.map((tile, i) => (
        <Tile key={i} tile={tile} size="xs" />
      ))}
      {Array.from({ length: Math.max(0, DORA_SLOTS - tiles.length) }, (_, i) => (
        <span
          key={`slot-${i}`}
          aria-hidden="true"
          className="w-[clamp(2.25rem,2.03rem+0.87vw,2.75rem)] rounded-[8%] bg-black/[0.07] dark:bg-white/10"
          style={{ aspectRatio: '3 / 4' }}
        />
      ))}
    </span>
  )
}

/**
 * A riichi stick, drawn rather than vendored.
 *
 * A declaration puts a physical 1000-point stick on the table, and that stick
 * is how a player recognizes a riichi across the felt — a white bar with a
 * single red dot at its centre. Saying "Riichi" in words made the one field
 * that changes how a hand is scored look like every other label in the strip.
 *
 * Inline SVG because the shape is two rectangles and a circle: an asset would
 * cost a request to say less than this does, and the colours here follow the
 * theme rather than being baked into a file.
 */
function RiichiStick() {
  return (
    <svg
      viewBox="0 0 64 14"
      aria-hidden="true"
      className="h-3.5 w-16 shrink-0 drop-shadow-sm"
    >
      <rect
        x="0.5"
        y="0.5"
        width="63"
        height="13"
        rx="3"
        className="fill-white stroke-black/25 dark:stroke-black/40"
        strokeWidth="1"
      />
      <circle cx="32" cy="7" r="3.25" className="fill-rose-600" />
    </svg>
  )
}

/** The strip's field label: small, set back, and the same in every slot. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
      {children}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      {/* The gold tick is the separator between fields; it reads as one band
          rather than as a row of separate chips. */}
      <span aria-hidden="true" className="h-3.5 w-0.5 shrink-0 rounded-full bg-gold-400" />
      <FieldLabel>{label}</FieldLabel>
      {children}
    </span>
  )
}

/**
 * The dead wall: dora indicators, and the ura row a riichi turns over.
 *
 * Each row is labelled on its own line rather than the pair sharing one
 * "Dora / Ura" heading. That heading named two things at once and pointed at
 * neither — a reader had to infer that the halves mapped top-to-bottom onto the
 * rows beside it, which is a small puzzle to solve every time the strip is read,
 * and one that gets harder the moment a hand has only the dora row.
 *
 * A two-column grid, so the tiles of both rows start at the same x no matter
 * which label is the wider word. `items-center` on each row is what puts the
 * label against its own tiles rather than against the block as a whole.
 */
function DeadWall({ dora, ura }: { dora: TileValue[]; ura: TileValue[] }) {
  const t = useT()
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="h-3.5 w-0.5 shrink-0 rounded-full bg-gold-400" />
      <span className="grid grid-cols-[auto_auto] items-center gap-x-2 gap-y-0.5 rounded-md bg-sky-500/10 p-1">
        <FieldLabel>{t.t('context.dora')}</FieldLabel>
        <IndicatorRow tiles={dora} />
        {/* Dora above, ura below — the dead wall's own stacking, so the row a
            player reads second is the row a riichi earned them. */}
        {ura.length > 0 && (
          <>
            <FieldLabel>{t.t('context.ura')}</FieldLabel>
            <IndicatorRow tiles={ura} />
          </>
        )}
      </span>
    </span>
  )
}

export interface HandContextProps {
  doraIndicators?: TileValue[]
  /** Shown only for a riichi hand, as the second row of the dead wall. */
  uraIndicators?: TileValue[]
  seatWind?: TileValue
  roundWind?: TileValue
  tsumo?: boolean
  /** Draws the riichi stick, and names it a double riichi when it was one. */
  riichi?: boolean
  doubleRiichi?: boolean
  /** Extra conditions worth stating, e.g. ippatsu. */
  flags?: string[]
}

export function HandContext({
  doraIndicators = [],
  uraIndicators = [],
  seatWind,
  roundWind,
  tsumo,
  riichi = false,
  doubleRiichi = false,
  flags = [],
}: HandContextProps) {
  const t = useT()

  return (
    <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-xl border border-black/5 bg-black/[0.04] px-3 py-2 dark:border-white/10 dark:bg-white/[0.06]">
      {doraIndicators.length > 0 && (
        <DeadWall dora={doraIndicators} ura={uraIndicators} />
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

      {(riichi || doubleRiichi) && (
        <Field label={t.t(doubleRiichi ? 'yaku.double-riichi' : 'context.riichi')}>
          <RiichiStick />
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
