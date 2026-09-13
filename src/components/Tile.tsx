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

import { type CSSProperties } from 'react'
import { type Tile as TileValue, face, isRed, rankOf, suitOf } from '../engine/tiles'
import { useT } from '../i18n'

export type TileSize = 'xs' | 'sm' | 'md' | 'lg'

/**
 * Tile widths, fluid for the same reason the type scale is: a hand is the
 * subject of most pages, and a fixed 56px tile that looked right on a phone is
 * lost on a desktop.
 *
 * The four values themselves live in `index.css` as `--tile-*`, so that a short
 * viewport — a phone held sideways — can restate the whole scale in one media
 * query. Inlining the clamps here instead meant four arbitrary Tailwind classes
 * that a media query could only beat by out-specifying each one.
 */
const SIZE_CLASSES: Record<TileSize, string> = {
  xs: 'w-(--tile-xs)',
  sm: 'w-(--tile-sm)',
  md: 'w-(--tile-md)',
  lg: 'w-(--tile-lg)',
}

/**
 * The natural widths again, but allowed to shrink so a long hand fits one row.
 *
 * Flexbox does the fitting: the width above becomes the flex basis, and
 * `shrink` lets every tile give up space proportionally when the row is
 * narrower than the hand. A percentage-of-container calculation cannot do this
 * job — inside a nested group (a called meld, say) `100%` resolves against that
 * group's own width rather than the row's, which collapsed melds to a few
 * pixels.
 *
 * `min-w-0` is required: a flex item will not shrink below its content's
 * intrinsic width without it, and the tile's image counts as content.
 */
export const FLUID_SIZE_CLASSES: Record<TileSize, string> = {
  xs: 'w-(--tile-xs) min-w-0 shrink',
  sm: 'w-(--tile-sm) min-w-0 shrink',
  md: 'w-(--tile-md) min-w-0 shrink',
  lg: 'w-(--tile-lg) min-w-0 shrink',
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
  /**
   * Position in the hand, which staggers the deal-in animation so a hand lands
   * left to right rather than all at once. Omit it for a tile that should just
   * appear.
   */
  dealIndex?: number
  /**
   * Lets the tile shrink so a long hand stays on one row. Set by `Hand`; it
   * only has an effect on a tile that is a flex item.
   */
  fluid?: boolean
  /**
   * Takes the width of whatever contains it, instead of sizing itself.
   *
   * For the one place a tile is not a horizontal flex item: the winning tile,
   * which sits in a column beside its Agari label. `shrink` cannot help there —
   * in a column the main axis is vertical, so it governs height, and the tile
   * held its full width and overflowed the column. The parent carries the width
   * and the shrinking; this makes the tile follow.
   */
  fill?: boolean
}

const HIGHLIGHT_RING: Record<NonNullable<TileProps['highlight']>, string> = {
  none: '',
  // The dora ring pulses, because a dora is a thing to notice rather than a
  // thing to read. The answer rings are static: a wrong answer that throbbed
  // would be unkind.
  dora: 'ring-2 ring-gold-400 anim-glow',
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
  dealIndex,
  fluid = false,
  fill = false,
}: TileProps) {
  const t = useT()
  const name = label ?? (faceDown ? t.t('tile.faceDown') : t.tile(tile))
  const src = tileAssetPath(tile)

  const classes = [
    'relative inline-block select-none rounded-[8%] transition duration-200 ease-out',
    fill ? 'w-full min-w-0' : fluid ? FLUID_SIZE_CLASSES[size] : SIZE_CLASSES[size],
    rotated ? 'rotate-90' : '',
    // A picked tile lifts clear of the row and casts a shadow, so the choice
    // reads as a physical one rather than as a changed border colour.
    selected ? '-translate-y-3 ring-2 ring-sky-500 drop-shadow-lg z-10' : '',
    dimmed ? 'opacity-40' : '',
    HIGHLIGHT_RING[highlight],
    dealIndex !== undefined ? 'anim-deal' : '',
    /**
     * A tappable tile gets a hit area taller than its face.
     *
     * Thirteen tiles plus a drawn one across a 390px phone leaves about 26px
     * each, well under the ~44px a fingertip wants, and no layout fixes that:
     * the width is the screen divided by the hand. Height is free, though —
     * there is dead space above and below the row — so `touch-target` extends
     * the hit area vertically without moving a pixel of the row. It is a
     * partial answer, which is why a tile-select drill is also the strongest
     * case for turning the phone sideways, where each tile gets 60px.
     */
    onClick
      ? 'touch-target cursor-pointer hover:-translate-y-1.5 hover:drop-shadow-md active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  // Dealing is capped so a fourteen-tile hand finishes in a beat rather than
  // crawling in over a second and a half.
  const style =
    dealIndex === undefined ? undefined : ({ '--stagger': `${Math.min(dealIndex * 35, 420)}ms` } as CSSProperties)

  /**
   * A face-down tile is drawn here rather than taken from the asset set.
   *
   * The vendored `Back.svg` is a flat red rectangle with no border or edge, so
   * beside the framed faces it reads as a missing image rather than as a tile.
   * This is the same shape with a rim and a bevel, which sits in the row at the
   * same weight as a face-up tile.
   */
  if (faceDown) {
    return (
      <span
        className={classes}
        style={style}
        role="img"
        aria-label={name}
        title={name}
      >
        <span
          className="block w-full rounded-[8%] border border-black/10 bg-gradient-to-br from-[#2f7d52] to-[#1c5436] shadow-inner dark:border-white/10"
          style={{ aspectRatio: TILE_ASPECT }}
        >
          {/* An inset panel, the way a real tile back is recessed from its rim. */}
          <span className="m-[12%] block h-[76%] rounded-[6%] border border-white/15 bg-white/5" />
        </span>
      </span>
    )
  }

  const image = (
    <>
      {/*
        The frame carries a drop shadow because the asset has no border: it is a
        near-white rounded rectangle, and on a white card a tile whose glyph is
        empty — the White Dragon — would otherwise be invisible. The shadow
        follows the SVG's own rounded silhouette, which a `box-shadow` on the
        wrapper could not. It lives on this layer rather than on the wrapper so
        it does not fight the `drop-shadow-*` the hover and selected states set.
      */}
      <img
        src="/tiles/Front.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="block w-full drop-shadow-[0_1px_2px_rgba(15,38,28,0.28)]"
        style={{ aspectRatio: TILE_ASPECT }}
      />
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 block w-full"
        style={{ aspectRatio: TILE_ASPECT }}
      />
    </>
  )

  if (!onClick) {
    return (
      <span
        className={classes}
        style={style}
        role="img"
        aria-label={name}
        title={name}
        data-face={face(tile)}
      >
        {image}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={classes}
      style={style}
      aria-label={name}
      title={name}
      data-face={face(tile)}
    >
      {image}
    </button>
  )
}
