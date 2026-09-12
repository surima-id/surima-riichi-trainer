/** Small shared building blocks, so pages stay about content rather than markup. */

import { type CSSProperties, type ReactNode } from 'react'

/**
 * Turns a list position into an animation delay.
 *
 * Staggering is done with one CSS custom property rather than a keyframe per
 * item, so a caller only says *which* item this is. The delay is capped, because
 * past about half a second a stagger stops reading as choreography and starts
 * reading as lag.
 */
export function stagger(index: number, step = 60, max = 480): CSSProperties {
  return { '--stagger': `${Math.min(index * step, max)}ms` } as CSSProperties
}

export function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`rounded-2xl border border-black/5 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition duration-300 sm:p-6 dark:border-white/10 dark:bg-felt-800/90 ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2.5 text-xl font-semibold tracking-tight">
      {/* A short gold rule, so a section announces itself before the words do. */}
      <span
        aria-hidden="true"
        className="h-5 w-1 shrink-0 rounded-full bg-gradient-to-b from-gold-400 to-felt-500 dark:from-gold-300 dark:to-felt-400"
      />
      {children}
    </h2>
  )
}

/**
 * The heading inside a lesson body.
 *
 * `Prose` dims its contents to 75% so body copy sits back from the headings; a
 * heading has to opt back out to full contrast, which is why this exists as a
 * component rather than as a bare `h3` repeated on every lesson page.
 */
export function LessonHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-3 text-lg font-semibold tracking-tight text-black dark:text-white">
      {children}
    </h3>
  )
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 text-base leading-relaxed text-black/75 dark:text-white/75">
      {children}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const BUTTON_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-felt-700 text-white shadow-sm hover:bg-felt-800 hover:shadow-md dark:bg-felt-100 dark:text-felt-900 dark:hover:bg-white',
  secondary:
    'border border-black/10 bg-white text-black/80 hover:bg-black/5 dark:border-white/15 dark:bg-transparent dark:text-white/85 dark:hover:bg-white/10',
  ghost: 'text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white',
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  type = 'button',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: ButtonVariant
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${BUTTON_CLASSES[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: 'neutral' | 'good' | 'bad' | 'info' | 'gold'
  className?: string
}) {
  const tones = {
    neutral: 'bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/70',
    good: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    bad: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    info: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    gold: 'bg-gold-400/20 text-gold-500 dark:bg-gold-400/15 dark:text-gold-300',
  }
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/**
 * A horizontal bar for a value out of a maximum.
 *
 * The quiz counter and the accuracy panel had each grown their own version of
 * this, which meant two copies of the same gradient and only one of them wired up
 * for a screen reader. `label` is required rather than optional for that reason:
 * a bare bar announces itself as a progressbar with no idea what it measures.
 */
export function Meter({
  value,
  max,
  label,
  className = '',
  barClassName = '',
}: {
  value: number
  max: number
  label: string
  /** Sizing for the track; the default is the thin bar used in dense rows. */
  className?: string
  /** Extra classes for the fill, e.g. `sheen sheen-run` on the quiz counter. */
  barClassName?: string
}) {
  // Clamped so a value past the maximum cannot overflow the track, which is
  // cheaper than trusting every caller to have capped it first.
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max))
  return (
    <span
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={`block overflow-hidden rounded-full bg-black/10 dark:bg-white/15 ${className || 'h-1.5 w-24'}`}
    >
      <span
        className={`block h-full rounded-full bg-gradient-to-r from-felt-600 to-felt-400 transition-[width] duration-700 ease-out dark:from-gold-400 dark:to-gold-300 ${barClassName}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </span>
  )
}

/**
 * Mastery as a row of discrete marks rather than a bar.
 *
 * Used where a bar would be one more horizontal line in an already busy card: a
 * handful of marks resolves to a count at a glance, where a part-filled bar has
 * to be estimated.
 */
export function Pips({
  filled,
  total,
  label,
}: {
  filled: number
  total: number
  label: string
}) {
  return (
    <span className="flex items-center gap-1" title={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full transition duration-300 ${
            i < filled
              ? 'bg-gold-400 dark:bg-gold-300'
              : 'bg-black/15 dark:bg-white/20'
          }`}
        />
      ))}
    </span>
  )
}

/** A labelled row, used throughout the fu and score breakdowns. */
export function LineItem({
  label,
  value,
  detail,
  figure,
  style,
}: {
  label: ReactNode
  value: ReactNode
  detail?: ReactNode
  /**
   * An illustration for the row, drawn to the left of the label.
   *
   * Its own slot rather than part of `label`, because the two need different
   * alignment: a row of text aligns on its baseline, and a picture has none to
   * share — putting one inside the label drags the row's baseline down to the
   * bottom of the image and strands the value below the words.
   */
  figure?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      className={`anim-fade-up flex justify-between gap-4 border-b border-dashed border-black/10 py-2 last:border-0 dark:border-white/10 ${
        figure ? 'items-center' : 'items-baseline'
      }`}
      style={style}
    >
      <div className="flex min-w-0 items-center gap-3">
        {figure}
        <div className="min-w-0">
          <div className="text-sm">{label}</div>
          {detail && <div className="text-xs text-black/50 dark:text-white/50">{detail}</div>}
        </div>
      </div>
      <div className="shrink-0 font-mono text-sm font-medium tabular-nums">{value}</div>
    </div>
  )
}
