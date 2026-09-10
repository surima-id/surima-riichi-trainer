/**
 * A single mahjong tile, rendered from the vendored CC0 SVG set.
 *
 * The asset set stores each face as a transparent glyph with no tile body, and
 * supplies the blank tile face separately as `Front.svg`. So a tile is drawn as
 * two stacked layers: the frame, then the glyph on top. (The White Dragon's
 * glyph is legitimately empty — a blank frame is what that tile looks like.)
 *
 * Every module renders tiles through this component (usually via `Hand`), so
 * sizing, the accessible name, and the red-five mapping stay consistent.
 */

import { type Tile as TileValue, face, isRed, rankOf, suitOf } from '../engine/tiles'
import { useT } from '../i18n'

export type TileSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZE_CLASSES: Record<TileSize, string> = {
  xs: 'w-8',
  sm: 'w-11',
  md: 'w-14',
  lg: 'w-18',
}

/** Every tile asset is 300×400, so one ratio keeps the stack aligned. */
const TILE_ASPECT = '3 / 4'

const HONOR_FILES = ['Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun']
const SUIT_PREFIX = { m: 'Man', p: 'Pin', s: 'Sou' } as const

/** Maps a tile to its file in `public/tiles/`. */
export function tileAssetPath(tile: TileValue): string {
  const suit = suitOf(tile)
  if (suit === 'z') return `/tiles/${HONOR_FILES[rankOf(tile) - 1]}.svg`
  const rank = rankOf(tile)
  const name = `${SUIT_PREFIX[suit]}${rank}${isRed(tile) ? '-Dora' : ''}`
  return `/tiles/${name}.svg`
}

export interface TileProps {
  tile: TileValue
  size?: TileSize
  /** Rotated a quarter turn, the way a called tile sits in a real hand. */
  rotated?: boolean
  faceDown?: boolean
  selected?: boolean
  dimmed?: boolean
  /** Draws a highlight ring — used to mark dora and drill answers. */
  highlight?: 'none' | 'dora' | 'correct' | 'wrong'
  onClick?: () => void
  label?: string
}

const HIGHLIGHT_RING: Record<NonNullable<TileProps['highlight']>, string> = {
  none: '',
  dora: 'ring-2 ring-amber-400',
  correct: 'ring-2 ring-emerald-500',
  wrong: 'ring-2 ring-rose-500',
}

export function Tile({
  tile,
  size = 'md',
  rotated = false,
  faceDown = false,
  selected = false,
  dimmed = false,
  highlight = 'none',
  onClick,
  label,
}: TileProps) {
  const t = useT()
  const name = label ?? (faceDown ? t.t('tile.faceDown') : t.tile(tile))
  const src = faceDown ? '/tiles/Back.svg' : tileAssetPath(tile)

  const classes = [
    'relative inline-block select-none transition',
    SIZE_CLASSES[size],
    rotated ? 'rotate-90' : '',
    selected ? '-translate-y-2 ring-2 ring-sky-500' : '',
    dimmed ? 'opacity-40' : '',
    HIGHLIGHT_RING[highlight],
    onClick ? 'cursor-pointer hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-sky-500' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // A face-down tile is a single image; a face-up one is the frame plus glyph.
  const image = (
    <>
      <img
        src={faceDown ? '/tiles/Back.svg' : '/tiles/Front.svg'}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="block w-full"
        style={{ aspectRatio: TILE_ASPECT }}
      />
      {!faceDown && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 block w-full"
          style={{ aspectRatio: TILE_ASPECT }}
        />
      )}
    </>
  )

  if (!onClick) {
    return (
      <span className={classes} role="img" aria-label={name} title={name} data-face={face(tile)}>
        {image}
      </span>
    )
  }

  return (
    <button type="button" onClick={onClick} className={classes} aria-label={name} title={name} data-face={face(tile)}>
      {image}
    </button>
  )
}
