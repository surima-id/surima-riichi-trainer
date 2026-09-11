/**
 * The ukeire calculator: type a hand, see what every discard accepts.
 *
 * This is the tool half of the efficiency module. The drill asks one question
 * and grades it; the calculator answers whatever hand the player brings to it —
 * the one from last night's game they are still arguing about, or a shape from
 * a book they want to check. Tenhou's analyser is the reference, and the thing
 * worth copying from it is the shape of the answer: one row per discard,
 * ranked, each showing the shanten it leaves and the exact tiles it accepts
 * with how many of each remain.
 *
 * The engine already computes all of this for the drill's explanation. What is
 * new here is only that the player chooses the hand.
 */

import { useMemo, useState } from 'react'
import { Hand } from './Hand'
import { Tile } from './Tile'
import { Badge, Card, LessonHeading, stagger } from './ui'
import { type DiscardOption, discardOptions, shanten } from '../engine/shanten'
import {
  NotationError,
  type Tile as TileValue,
  face,
  parseTiles,
  sortTiles,
} from '../engine/tiles'
import { type MessageKey, type Translator, useT } from '../i18n'
import { type Params } from '../i18n/types'

/**
 * A hand the calculator opens on, so the panel explains itself before it is
 * touched. One tile away from ready with a real decision in it: several
 * discards keep the hand at the same shanten while accepting different tiles,
 * which is exactly the comparison the tool exists to make.
 */
const DEFAULT_HAND = '3456m34567p34477s'

/**
 * What the parser produced, or why it could not.
 *
 * A failure carries a message key and its params rather than a finished
 * sentence, so the parse is language-independent and can be tested without a
 * translator — the same split the engine keeps with the rest of the app.
 */
export type ParsedHand =
  | { ok: true; tiles: TileValue[] }
  /** Notation the parser could not read; the engine's own error says why. */
  | { ok: false; notation: NotationError }
  /** Tiles that parsed but do not form a hand anyone could hold. */
  | { ok: false; error: MessageKey; params?: Params }

export function parseHand(input: string): ParsedHand {
  const trimmed = input.trim()
  if (trimmed === '') return { ok: false, error: 'ukeire.errorEmpty' }

  let tiles: TileValue[]
  try {
    tiles = parseTiles(trimmed)
  } catch (error) {
    if (error instanceof NotationError) return { ok: false, notation: error }
    throw error
  }

  /**
   * Fourteen tiles, because the question is which one to throw.
   *
   * Thirteen is a legal hand but poses no discard decision, and the calculator
   * has exactly one job. Saying so with the count the player actually typed is
   * more useful than a generic complaint.
   */
  if (tiles.length !== 14) {
    return { ok: false, error: 'ukeire.errorCount', params: { n: tiles.length } }
  }

  // A fifth copy of a tile does not exist, and the engine would happily analyse
  // one — so the check belongs here, where the tiles come from a human.
  const counts = new Map<number, number>()
  for (const tile of tiles) {
    const f = face(tile)
    const held = (counts.get(f) ?? 0) + 1
    counts.set(f, held)
    if (held > 4) return { ok: false, error: 'ukeire.errorFive', params: { face: f } }
  }

  return { ok: true, tiles: sortTiles(tiles) }
}

/** Turns a parse failure into a sentence in the reader's language. */
function errorText(parsed: Extract<ParsedHand, { ok: false }>, t: Translator): string {
  if ('notation' in parsed) return t.notationError(parsed.notation)
  // The five-copies message names the offending tile, and a tile is named by
  // the translator rather than carried through as text.
  if (parsed.error === 'ukeire.errorFive') {
    return t.t(parsed.error, { tile: t.tile(Number(parsed.params?.face)) })
  }
  return t.t(parsed.error, parsed.params)
}

/** One discard's row: the tile thrown, what it leaves, and what it accepts. */
function DiscardRow({
  option,
  best,
  index,
}: {
  option: DiscardOption
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
            {option.shanten === 0
              ? t.t('ukeire.ready')
              : t.t('ukeire.away', { n: option.shanten })}
          </Badge>
          {/* The headline number: how many tiles this discard leaves you live
              to. It is set in the same tabular figures as the rest of the app
              so the column scans vertically. */}
          <span className="font-mono text-sm font-semibold tabular-nums">
            {t.t('unit.tiles', { n: option.tilesLeft })}
          </span>
        </div>

        {/* The accepted tiles themselves, each with its remaining count.
            Drawing them rather than listing notation is what makes a row
            readable at a glance: a wide wait looks wide. */}
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
 * The calculator panel.
 *
 * Kept out of `Lesson`'s prose block deliberately: the lesson body is withdrawn
 * once a quiz starts, and a tool is not something to hide while practising.
 */
export function UkeireCalculator() {
  const t = useT()
  const [input, setInput] = useState(DEFAULT_HAND)

  const parsed = useMemo(() => parseHand(input), [input])

  /**
   * The ranking, recomputed only when the hand changes.
   *
   * `discardOptions` runs a shanten search per candidate discard per accepted
   * face, which is comfortably fast for one hand but not something to redo on
   * an unrelated re-render.
   */
  const analysis = useMemo(() => {
    if (!parsed.ok) return null
    const options = discardOptions(parsed.tiles)
    const top = options[0]?.shanten

    /**
     * Only the discards that keep the hand as close as it can be.
     *
     * Every tile in a hand is a legal discard, so the full list runs to twelve
     * or more rows — and the ones that give up a step are the loudest on the
     * page, because a hand one step further from ready accepts far more tiles.
     * Showing 78 tiles above 23 invites exactly the misreading the lesson warns
     * against: acceptance is only comparable between discards at the same
     * shanten. So the backward discards are folded away and offered on request.
     */
    return {
      best: options.filter((o) => o.shanten === top),
      worse: options.filter((o) => o.shanten !== top),
      complete: shanten(parsed.tiles) < 0,
    }
  }, [parsed])

  const best = analysis?.best[0]

  return (
    <Card className="anim-fade-up space-y-4">
      <div>
        <LessonHeading>{t.t('ukeire.title')}</LessonHeading>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">{t.t('ukeire.intro')}</p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="ukeire-input"
          className="block text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45"
        >
          {t.t('ukeire.inputLabel')}
        </label>
        <input
          id="ukeire-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 font-mono text-base tracking-wide transition duration-200 focus:border-felt-500 focus:outline-2 focus:outline-offset-2 focus:outline-sky-500 dark:border-white/15 dark:bg-white/5"
          placeholder={DEFAULT_HAND}
        />
        <p className="text-xs text-black/50 dark:text-white/50">{t.t('ukeire.inputHelp')}</p>
      </div>

      {!parsed.ok && (
        <p className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-700 dark:text-rose-300">
          {errorText(parsed, t)}
        </p>
      )}

      {parsed.ok && (
        <div className="space-y-4">
          <div className="overflow-x-auto pb-1">
            <Hand tiles={parsed.tiles} size="sm" />
          </div>

          {analysis?.complete ? (
            // A complete hand has no discard to rank — saying so is the answer,
            // and a table of zero-improvement rows would not be.
            <p className="text-sm text-black/60 dark:text-white/60">{t.t('ukeire.complete')}</p>
          ) : (
            <>
              {best && (
                <p className="text-sm">
                  {t.t(best.shanten === 0 ? 'ukeire.bestReady' : 'ukeire.bestAway', {
                    tile: t.tile(best.tile),
                    n: best.shanten,
                    tiles: t.t('unit.tiles', { n: best.tilesLeft }),
                  })}
                </p>
              )}

              <ul className="space-y-2">
                {analysis?.best.map((option, i) => (
                  <DiscardRow
                    key={option.tile}
                    option={option}
                    // Every discard tied on acceptance with the top row is
                    // equally best; ranking is not a total order, and marking
                    // only the first would claim otherwise.
                    best={best !== undefined && option.tilesLeft === best.tilesLeft}
                    index={i}
                  />
                ))}
              </ul>

              {analysis && analysis.worse.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer list-none text-sm font-medium text-black/55 transition hover:text-black dark:text-white/55 dark:hover:text-white">
                    <span aria-hidden="true" className="mr-1.5 inline-block transition group-open:rotate-90">
                      ▸
                    </span>
                    {t.t('ukeire.showWorse', { n: analysis.worse.length })}
                  </summary>
                  <p className="mt-2 mb-2 text-xs text-black/50 dark:text-white/50">
                    {t.t('ukeire.worseNote')}
                  </p>
                  <ul className="space-y-2">
                    {analysis.worse.map((option, i) => (
                      <DiscardRow key={option.tile} option={option} best={false} index={i} />
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      )}

      <p className="text-xs text-black/45 dark:text-white/45">{t.t('ukeire.caveat')}</p>
    </Card>
  )
}
