/**
 * A full hand: the concealed tiles, any called melds set apart, and the winning
 * tile spaced off to the right the way it is placed on a real table.
 */

import { type Call } from '../engine/parse'
import { type Tile as TileValue, face, sortTiles } from '../engine/tiles'
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
}

/** Renders one called meld, with the claimed tile turned sideways. */
function CalledMeld({ call, size }: { call: Call; size: TileSize }) {
  if (call.kind === 'ankan') {
    // A closed kan shows only its two middle tiles.
    return (
      <span className="flex items-end gap-px">
        <Tile tile={call.tiles[0]} size={size} faceDown />
        <Tile tile={call.tiles[1]} size={size} />
        <Tile tile={call.tiles[2]} size={size} />
        <Tile tile={call.tiles[3]} size={size} faceDown />
      </span>
    )
  }

  return (
    <span className="flex items-end gap-px">
      {call.tiles.map((tile, i) => (
        <Tile key={i} tile={tile} size={size} rotated={i === 0} />
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
}: HandProps) {
  const highlighted = new Set(highlightFaces)

  // Pull one copy of the winning tile out of the hand rather than appending it,
  // so a 14-tile hand renders as 13 + 1 and not as 15.
  let rest = tiles
  if (winTile !== undefined) {
    const index = tiles.findIndex((t) => t === winTile)
    if (index >= 0) rest = [...tiles.slice(0, index), ...tiles.slice(index + 1)]
  }
  const display = sort ? sortTiles(rest) : rest

  return (
    <div className="flex w-max flex-wrap items-end gap-x-4 gap-y-3">
      <div className="flex items-end gap-0.5">
        {display.map((tile, index) => (
          <Tile
            key={index}
            tile={tile}
            size={size}
            selected={selected.includes(index)}
            highlight={highlighted.has(face(tile)) ? highlightKind : 'none'}
            onClick={onTileClick ? () => onTileClick(index, tile) : undefined}
          />
        ))}
      </div>

      {winTile !== undefined && (
        <div className="flex items-end">
          <Tile
            tile={winTile}
            size={size}
            highlight={highlighted.has(face(winTile)) ? highlightKind : 'none'}
          />
        </div>
      )}

      {calls.length > 0 && (
        <div className="flex items-end gap-3">
          {calls.map((call, i) => (
            <CalledMeld key={i} call={call} size={size} />
          ))}
        </div>
      )}
    </div>
  )
}
