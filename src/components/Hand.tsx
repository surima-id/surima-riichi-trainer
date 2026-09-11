/**
 * A full hand: the concealed tiles, any called melds set apart, and the winning
 * tile spaced off to the right the way it is placed on a real table.
 */

import { type Call } from '../engine/parse'
import { type Tile as TileValue, face, sortTiles } from '../engine/tiles'
import { useT } from '../i18n'
import { Tile, type TileSize } from './Tile'

export interface HandProps {
  tiles: TileValue[]
  calls?: Call[]
  /**
   * The drawn or claimed tile. It is expected to be part of `tiles` — one copy
   * is pulled out and shown separated from the rest, the way a winning tile is
   * set apart on the table. Passing it does not add a fifteenth tile.
   */
  winTile?: TileValue
  size?: TileSize
  /** Sorts the concealed portion; off when tile order is the point of the drill. */
  sort?: boolean
  selected?: number[]
  onTileClick?: (index: number, tile: TileValue) => void
  /** Face indices to ring, e.g. the dora in the hand. */
  highlightFaces?: number[]
  highlightKind?: 'dora' | 'correct' | 'wrong'
  /**
   * Deals the tiles in left to right on mount. On for the interactive hands a
   * drill or the sandbox shows; off for the many small reference hands on a
   * lesson page, where a dozen hands animating at once is noise.
   */
  animate?: boolean
  /**
   * Labels the winning tile "Agari" beneath it.
   *
   * On the reference page a hand is read cold, with no prompt saying which tile
   * completed it — the gap alone does not say *why* that tile sits apart. In a
   * drill the question already establishes it, so this stays off by default.
   */
  showAgari?: boolean
  /**
   * Shows only these tiles face-up; every other concealed tile is drawn as a
   * tile back.
   *
   * Used by the yaku reference, where most of a sample hand is legal filler
   * rather than part of the pattern being taught. Matching is by face and by
   * count — two copies listed reveal two copies — so a pair in the pattern does
   * not silently reveal a third one elsewhere in the hand.
   *
   * The winning tile and called melds are always face-up: both are set apart
   * from the concealed run and carry their own meaning.
   */
  revealFaces?: TileValue[]
}

/** The gap between adjacent tiles within the concealed run or a meld, in px. */
const TILE_GAP = 2
/** The wider gap that sets the drawn tile and each called meld apart, in px. */
const GROUP_GAP = 20

/** Renders one called meld, with the claimed tile turned sideways. */
function CalledMeld({ call, size }: { call: Call; size: TileSize }) {
  if (call.kind === 'ankan') {
    // A closed kan shows only its two middle tiles.
    return (
      <span className="flex min-w-0 items-end gap-px">
        <Tile tile={call.tiles[0]} size={size} faceDown fluid />
        <Tile tile={call.tiles[1]} size={size} fluid />
        <Tile tile={call.tiles[2]} size={size} fluid />
        <Tile tile={call.tiles[3]} size={size} faceDown fluid />
      </span>
    )
  }

  return (
    <span className="flex min-w-0 items-end gap-px">
      {call.tiles.map((tile, i) => (
        <Tile key={i} tile={tile} size={size} rotated={i === 0} fluid />
      ))}
    </span>
  )
}

export function Hand({
  tiles,
  calls = [],
  winTile,
  size = 'md',
  sort = true,
  selected = [],
  onTileClick,
  highlightFaces = [],
  highlightKind = 'dora',
  animate = false,
  showAgari = false,
  revealFaces,
}: HandProps) {
  const t = useT()
  const agariLabel = t.t('yakuPage.agari')
  const highlighted = new Set(highlightFaces)

  // Pull one copy of the winning tile out of the hand rather than appending it,
  // so a 14-tile hand renders as 13 + 1 and not as 15.
  let rest = tiles
  if (winTile !== undefined) {
    const index = tiles.findIndex((t) => t === winTile)
    if (index >= 0) rest = [...tiles.slice(0, index), ...tiles.slice(index + 1)]
  }
  const display = sort ? sortTiles(rest) : rest

  /**
   * Decides, per position, whether a concealed tile is shown.
   *
   * A budget per face rather than a set membership test: `revealFaces` of
   * `223344m` should reveal two 2m, and a hand holding three would keep the
   * third hidden.
   */
  const budget = new Map<number, number>()
  for (const tile of revealFaces ?? []) {
    budget.set(face(tile), (budget.get(face(tile)) ?? 0) + 1)
  }
  const hidden = display.map((tile) => {
    if (revealFaces === undefined) return false
    const left = budget.get(face(tile)) ?? 0
    if (left === 0) return true
    budget.set(face(tile), left - 1)
    return false
  })

  /**
   * The hand is one row that shrinks to fit, rather than wrapping or clipping.
   *
   * A hand is read as a single line — the tiles you hold, then the one just
   * drawn — so wrapping breaks the reading and overflow hides the end of it.
   * Flexbox handles the fit: every tile carries `shrink`, so a fourteen-tile
   * hand gives up a little width per tile on a narrow card and a two-tile
   * example keeps its natural size.
   *
   * `w-max` sets the row's preferred width to the hand's natural width, which is
   * what keeps a short hand from stretching; `max-w-full` is the ceiling that
   * makes the shrinking kick in.
   */
  return (
    <div
      className="flex w-max max-w-full items-end"
      style={{ columnGap: `${GROUP_GAP}px` }}
    >
      <div className="flex min-w-0 items-end" style={{ columnGap: `${TILE_GAP}px` }}>
        {display.map((tile, index) => (
          <Tile
            key={index}
            tile={tile}
            size={size}
            fluid
            faceDown={hidden[index]}
            selected={selected.includes(index)}
            highlight={highlighted.has(face(tile)) ? highlightKind : 'none'}
            onClick={onTileClick ? () => onTileClick(index, tile) : undefined}
            dealIndex={animate ? index : undefined}
          />
        ))}
      </div>

      {winTile !== undefined && (
        <div className="flex min-w-0 shrink-0 flex-col items-center gap-1">
          <Tile
            tile={winTile}
            size={size}
            fluid
            highlight={highlighted.has(face(winTile)) ? highlightKind : 'none'}
            // The winning tile lands last, after the hand it completes.
            dealIndex={animate ? display.length : undefined}
          />
          {showAgari && (
            <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
              {agariLabel}
            </span>
          )}
        </div>
      )}

      {calls.length > 0 && (
        <div className="flex min-w-0 items-end" style={{ columnGap: `${GROUP_GAP}px` }}>
          {calls.map((call, i) => (
            <CalledMeld key={i} call={call} size={size} />
          ))}
        </div>
      )}
    </div>
  )
}
