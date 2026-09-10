/** Small shared building blocks, so pages stay about content rather than markup. */

import { type ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-felt-800 ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-lg font-semibold tracking-tight">{children}</h2>
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-black/75 dark:text-white/75">
      {children}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const BUTTON_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-felt-700 text-white hover:bg-felt-800 dark:bg-felt-100 dark:text-felt-900 dark:hover:bg-white',
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
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${BUTTON_CLASSES[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'good' | 'bad' | 'info'
}) {
  const tones = {
    neutral: 'bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/70',
    good: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    bad: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    info: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  }
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

/** A labelled row, used throughout the fu and score breakdowns. */
export function LineItem({
  label,
  value,
  detail,
}: {
  label: ReactNode
  value: ReactNode
  detail?: ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-black/10 py-1.5 last:border-0 dark:border-white/10">
      <div>
        <div className="text-sm">{label}</div>
        {detail && <div className="text-xs text-black/50 dark:text-white/50">{detail}</div>}
      </div>
      <div className="shrink-0 font-mono text-sm tabular-nums">{value}</div>
    </div>
  )
}
