/**
 * The progress certificate, drawn to a canvas and exported as a PNG.
 *
 * A keepsake rather than a credential. Progress lives in this browser's
 * localStorage and is editable from devtools in a few seconds, so the card says
 * what someone did and when, and claims nothing it cannot back: no seal, no
 * signature, no "verified".
 *
 * Canvas rather than a screenshot library because the app already owns every
 * ingredient — the tile art, the colour tokens, the two typefaces — and an
 * image is the only thing Instagram will accept from the web. There is no post
 * API; the most a page can do is hand the OS a file and let the share sheet
 * carry it, which is what `src/share/share.ts` does with the blob this returns.
 *
 * The colours are literals because canvas cannot read a Tailwind class. They are
 * transcribed from the `@theme` block in `src/index.css`; if the palette moves,
 * it moves here too.
 */

import { type Tile } from '../engine/tiles'
import { tileAssetPath } from '../components/Tile'

export type CertSize = 'square' | 'story'

/** Everything the card draws, already translated by the caller. */
export interface CertSubject {
  kind: 'chapter' | 'course'
  /** The chapter name, or the app name for a whole-course card. */
  title: string
  /** The headline above the title, e.g. "Bab ini terkuasai". */
  caption: string
  points: number
  max: number
  /** Filled marks and their total, matching the pips on the course map. */
  marks: number
  markTotal: number
  /** Preformatted by the caller — the catalogs carry no month names. */
  dateLabel: string
  /** The site name, printed as the card's only attribution. */
  site: string
  /** Decorative tile faces, drawn from the real art. */
  tiles: Tile[]
}

const COLORS = {
  ground: '#0f261c', // felt-900
  panel: '#163527', // felt-800
  rule: '#1f4534', // felt-700
  goldLight: '#f3d68a', // gold-300
  gold: '#e8bf5c', // gold-400
  goldDeep: '#d3a13a', // gold-500
  text: '#e8f1ec',
  textDim: '#9bbfa9', // felt-300
} as const

/**
 * The geometry of one size, in output pixels.
 *
 * A table rather than arithmetic scattered through the draw calls, so the two
 * formats can be eyeballed side by side and unit-tested without a canvas.
 */
export interface CertLayout {
  width: number
  height: number
  /** Side padding, and the y of each band. */
  pad: number
  captionY: number
  titleY: number
  titleSize: number
  marksY: number
  tilesY: number
  tileWidth: number
  footerY: number
}

const TILE_ASPECT = 400 / 300

export function certLayout(size: CertSize): CertLayout {
  if (size === 'story') {
    return {
      width: 1080,
      height: 1920,
      pad: 96,
      captionY: 560,
      titleY: 690,
      titleSize: 96,
      marksY: 920,
      tilesY: 1120,
      tileWidth: 180,
      footerY: 1640,
    }
  }
  return {
    width: 1080,
    height: 1080,
    pad: 88,
    captionY: 250,
    titleY: 360,
    titleSize: 84,
    marksY: 530,
    tilesY: 650,
    tileWidth: 140,
    footerY: 960,
  }
}

/** A filesystem- and share-sheet-safe name for the exported image. */
export function shareFilename(subject: CertSubject, size: CertSize): string {
  const slug = subject.kind === 'course' ? 'surima-course' : 'surima-chapter'
  return `${slug}-${size}.png`
}

/**
 * The font strings the card draws with.
 *
 * Exported because they are also what has to be handed to `document.fonts.load`
 * — loading a different string than you draw with is the way to get a silent
 * fallback, so both come from one place.
 */
export function certFonts(layout: CertLayout): string[] {
  return [
    `800 ${layout.titleSize}px Inter`,
    '700 40px Inter',
    '600 30px Inter',
    '600 28px "JetBrains Mono"',
  ]
}

/**
 * Makes sure the typefaces are actually available before drawing.
 *
 * Google Fonts serves unicode-range subsets with `display=swap`, so
 * `document.fonts.ready` is not enough on its own: a subset for glyphs that have
 * not yet been painted may never have been fetched. Passing the text forces the
 * right subset. The race is a slow-CDN escape hatch — a card in a fallback face
 * beats a button that never responds.
 */
async function ensureFonts(layout: CertLayout, text: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const loads = certFonts(layout).map((font) => document.fonts.load(font, text))
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2500))
  await Promise.race([Promise.all(loads).then(() => undefined), timeout])
}

/**
 * Decoded tile art, kept for the life of the page.
 *
 * A card draws up to seven tiles as two layers each, and both sizes redraw on
 * every size switch, so without this the same dozen files are decoded again and
 * again.
 */
const imageCache = new Map<string, Promise<HTMLImageElement>>()

function loadImage(src: string, width: number): Promise<HTMLImageElement> {
  const key = `${src}@${width}`
  const cached = imageCache.get(key)
  if (cached) return cached

  const promise = (async () => {
    const img = new Image()
    // Sized before decoding: Safari rasterizes an SVG in an <img> at the size
    // set on the element, so leaving it intrinsic and scaling up on the canvas
    // gives soft tiles.
    img.width = width
    img.height = Math.round(width * TILE_ASPECT)
    img.src = src

    const onload = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error(`tile art failed: ${src}`))
    })
    try {
      // `decode` waits for rasterization, which `onload` does not guarantee.
      // Safari has rejected it on SVG, hence the fallback.
      await img.decode()
    } catch {
      await onload
    }
    return img
  })()

  imageCache.set(key, promise)
  return promise
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fill()
}

/** The app's wordmark: a gold lozenge, then the name. */
function drawWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, name: string): void {
  const barH = 44
  const gradient = ctx.createLinearGradient(x, y - barH / 2, x, y + barH / 2)
  gradient.addColorStop(0, COLORS.goldLight)
  gradient.addColorStop(1, COLORS.goldDeep)
  ctx.fillStyle = gradient
  roundRect(ctx, x, y - barH / 2, 10, barH, 5)

  ctx.fillStyle = COLORS.text
  ctx.font = '700 40px Inter'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, x + 30, y)
}

/** Mastery marks, gold when earned and hollow when not. */
function drawMarks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  filled: number,
  total: number,
): void {
  const r = 16
  const gap = 52
  const startX = cx - ((total - 1) * gap) / 2
  for (let i = 0; i < total; i++) {
    ctx.beginPath()
    ctx.arc(startX + i * gap, y, r, 0, Math.PI * 2)
    if (i < filled) {
      ctx.fillStyle = COLORS.gold
      ctx.fill()
    } else {
      ctx.strokeStyle = COLORS.rule
      ctx.lineWidth = 4
      ctx.stroke()
    }
  }
}

/**
 * Draws the card and hands back a PNG.
 *
 * PNG rather than JPEG: Instagram re-encodes either way, but PNG spares the
 * crisp type a round of compression on the way in.
 */
export async function renderCertificate(subject: CertSubject, size: CertSize): Promise<Blob> {
  const layout = certLayout(size)
  const { width, height, pad } = layout
  const cx = width / 2

  await ensureFonts(layout, `${subject.title}${subject.caption}${subject.dateLabel}${subject.site}`)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  // Ground, with a soft felt wash so it is not a flat rectangle.
  ctx.fillStyle = COLORS.ground
  ctx.fillRect(0, 0, width, height)
  const wash = ctx.createRadialGradient(width * 0.85, 0, 0, width * 0.85, 0, height * 0.8)
  wash.addColorStop(0, 'rgba(67, 120, 91, 0.28)')
  wash.addColorStop(1, 'rgba(67, 120, 91, 0)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, width, height)

  // An inner gold hairline, the one piece of ceremony the card allows itself.
  ctx.strokeStyle = 'rgba(232, 191, 92, 0.35)'
  ctx.lineWidth = 3
  ctx.strokeRect(pad / 2, pad / 2, width - pad, height - pad)

  drawWordmark(ctx, pad, pad + 30, 'Surima Academy')

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = COLORS.gold
  ctx.font = '600 30px Inter'
  ctx.fillText(subject.caption.toUpperCase(), cx, layout.captionY)

  // The title is the card's subject, so it carries the display weight. Long
  // chapter names are stepped down rather than clipped.
  ctx.fillStyle = COLORS.text
  let titleSize = layout.titleSize
  ctx.font = `800 ${titleSize}px Inter`
  while (ctx.measureText(subject.title).width > width - pad * 2.5 && titleSize > 40) {
    titleSize -= 4
    ctx.font = `800 ${titleSize}px Inter`
  }
  ctx.fillText(subject.title, cx, layout.titleY)

  drawMarks(ctx, cx, layout.marksY, subject.marks, subject.markTotal)

  ctx.fillStyle = COLORS.textDim
  ctx.font = '600 28px "JetBrains Mono"'
  ctx.fillText(`${subject.points} / ${subject.max}`, cx, layout.marksY + 90)

  // Tile art, centred, drawn the way the app draws it: the blank tile body,
  // then the face glyph over the same rect.
  if (subject.tiles.length > 0) {
    const tw = layout.tileWidth
    const th = Math.round(tw * TILE_ASPECT)
    const gap = Math.round(tw * 0.12)
    const totalW = subject.tiles.length * tw + (subject.tiles.length - 1) * gap
    let x = cx - totalW / 2
    const front = await loadImage('/tiles/Front.svg', tw)
    for (const tile of subject.tiles) {
      const face = await loadImage(tileAssetPath(tile), tw)
      ctx.drawImage(front, x, layout.tilesY, tw, th)
      ctx.drawImage(face, x, layout.tilesY, tw, th)
      x += tw + gap
    }
  }

  ctx.fillStyle = COLORS.textDim
  ctx.font = '600 28px "JetBrains Mono"'
  ctx.fillText(subject.dateLabel, cx, layout.footerY)
  ctx.fillStyle = COLORS.gold
  ctx.font = '600 30px Inter'
  ctx.fillText(subject.site, cx, layout.footerY + 52)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))

  // Released eagerly: iOS can drop a canvas's backing store when the tab is
  // backgrounded, and the blob is the only thing worth keeping by now.
  canvas.width = 0
  canvas.height = 0

  if (!blob) throw new Error('could not encode the certificate')
  return blob
}
