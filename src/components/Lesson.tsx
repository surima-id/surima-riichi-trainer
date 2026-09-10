/**
 * The shell every module shares: teach, show a worked example, then drill.
 *
 * Keeping this in one place is what makes the seven modules feel like one
 * course rather than seven separate pages.
 */

import { type ReactNode, useEffect } from 'react'
import { Quiz } from './Quiz'
import { type Generator } from '../drills/types'
import { Card, Prose, SectionTitle } from './ui'
import { useT } from '../i18n'
import { useProgress } from '../store/useProgress'

export interface LessonProps {
  id: string
  title: string
  subtitle: string
  children: ReactNode
  drills: Generator[]
}

export function Lesson({ id, title, subtitle, children, drills }: LessonProps) {
  const t = useT()
  const { readLesson } = useProgress()

  useEffect(() => {
    readLesson(id)
  }, [id, readLesson])

  return (
    <article className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-black/60 dark:text-white/60">{subtitle}</p>
      </header>

      <Card>
        <Prose>{children}</Prose>
      </Card>

      <section className="space-y-4">
        <SectionTitle>{t.t('quiz.practice')}</SectionTitle>
        <Quiz generators={drills} />
      </section>
    </article>
  )
}

/**
 * A worked example: a hand with a paragraph explaining what to notice in it.
 *
 * A full nine-tile suit is wider than a phone screen, so the hand scrolls
 * inside the example rather than pushing the whole page sideways.
 */
export function Example({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      {title && <p className="mb-2 text-sm font-semibold">{title}</p>}
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

/** Inline hand notation, e.g. `123m`. */
export function Notation({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/10">
      {children}
    </code>
  )
}
