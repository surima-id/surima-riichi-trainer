/**
 * The shell every module shares: teach, show a worked example, then drill.
 *
 * Keeping this in one place is what makes the seven modules feel like one
 * course rather than seven separate pages.
 */

import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Quiz } from './Quiz'
import { type Generator } from '../drills/types'
import { Button, Card, Prose, SectionTitle, stagger } from './ui'
import { useT } from '../i18n'
import { useProgress } from '../store/useProgress'

export interface LessonProps {
  id: string
  title: string
  subtitle: string
  children: ReactNode
  drills: Generator[]
  /**
   * Content placed below the quiz, outside the lesson body.
   *
   * The body above is withdrawn while a quiz runs, which is right for prose the
   * quiz is testing and wrong for a reference tool — so anything that should
   * stay on screen throughout goes here instead.
   */
  after?: ReactNode
}

export function Lesson({ id, title, subtitle, children, drills, after }: LessonProps) {
  const t = useT()
  const { readLesson } = useProgress()

  /**
   * Once the quiz starts, the lesson gets out of its way.
   *
   * A quiz sitting below the material it tests is a quiz you scroll past the
   * answers to reach, and then answer with them still on screen — which
   * measures reading rather than recall. So the prose is withdrawn for the
   * duration and offered back deliberately, as a clue.
   */
  const [quizRunning, setQuizRunning] = useState(false)
  const [clueOpen, setClueOpen] = useState(false)

  useEffect(() => {
    readLesson(id)
  }, [id, readLesson])

  // Peeking is per-question: the clue closes itself as the quiz moves on, so it
  // cannot be left open and turn the drill back into an open-book exercise.
  const handlePhase = useCallback((running: boolean) => {
    setQuizRunning(running)
    setClueOpen(false)
  }, [])

  const body = <Prose>{children}</Prose>

  return (
    <article className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <header className="anim-fade-up">
        <h1 className="text-3xl font-extrabold tracking-tight text-balance">{title}</h1>
        {!quizRunning && (
          <p className="mt-2 max-w-2xl text-lg text-black/60 dark:text-white/60">{subtitle}</p>
        )}
      </header>

      {!quizRunning && (
        <Card className="anim-fade-up" style={stagger(1, 90)}>
          {body}
        </Card>
      )}

      <section className="anim-fade-up space-y-4" style={stagger(2, 90)}>
        {!quizRunning && <SectionTitle>{t.t('quiz.practice')}</SectionTitle>}

        {quizRunning && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setClueOpen((open) => !open)}>
              {/* A lightbulb rather than a chevron: this reveals help, it does
                  not expand a section. */}
              <span aria-hidden="true" className="mr-1.5">
                {clueOpen ? '💡' : '💡'}
              </span>
              {t.t(clueOpen ? 'quiz.clueHide' : 'quiz.clue')}
            </Button>
          </div>
        )}

        {quizRunning && clueOpen && (
          <Card className="anim-slide-down border-l-2 border-gold-400">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
              {t.t('quiz.clueTitle')}
            </h3>
            {body}
          </Card>
        )}

        <Quiz generators={drills} onRunningChange={handlePhase} />
      </section>

      {after && (
        <section className="anim-fade-up" style={stagger(3, 90)}>
          {after}
        </section>
      )}
    </article>
  )
}

/**
 * A worked example: a hand with a paragraph explaining what to notice in it.
 */
export function Example({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4 transition duration-300 hover:border-black/20 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20">
      {title && <p className="mb-2.5 text-sm font-semibold text-black dark:text-white">{title}</p>}
      <div>{children}</div>
    </div>
  )
}

/** Inline hand notation, e.g. `123m`. */
export function Notation({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-mono text-[0.92em] font-medium dark:bg-white/10">
      {children}
    </code>
  )
}
