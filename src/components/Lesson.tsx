/**
 * The shell every module shares: teach, show a worked example, then drill.
 *
 * Keeping this in one place is what makes the seven modules feel like one
 * course rather than seven separate pages.
 */

import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Quiz } from './Quiz'
import { type Generator } from '../drills/types'
import { Badge, Button, Card, Meter, Prose, SectionTitle, stagger } from './ui'
import { type MessageKey, useT } from '../i18n'
import { useProgress } from '../store/useProgress'
import { CHAPTER_CAP, chapterPoints, isMastered } from '../store/progress'
import { ShareCertificate } from './ShareCertificate'
import { chapterSubject } from '../share/subject'
import { useSubjectStrings } from '../share/useSubject'

/**
 * One named quiz a lesson offers, when it offers more than one.
 *
 * A module whose drills differ in difficulty rather than in subject splits into
 * tracks instead of interleaving: mixing a multiple-choice question with one
 * that wants four figures typed makes a single quiz that is two exercises
 * wearing one score. Each track keeps its own best score, because they are not
 * the same achievement.
 */
export interface Track {
  key: MessageKey
  drills: Generator[]
}

export interface LessonProps {
  id: string
  title: string
  subtitle: string
  children: ReactNode
  /** The single quiz this lesson drills, or `tracks` for a choice of several. */
  drills?: Generator[]
  tracks?: Track[]
}

export function Lesson({ id, title, subtitle, children, drills, tracks }: LessonProps) {
  const t = useT()
  const { progress, readLesson } = useProgress()

  // One unnamed track is the ordinary case, so a lesson with a single quiz says
  // `drills` and never has to name it.
  const allTracks: Track[] = tracks ?? []
  const [trackIndex, setTrackIndex] = useState(0)
  const activeDrills = allTracks.length > 0 ? allTracks[trackIndex].drills : (drills ?? [])

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

  const points = chapterPoints(progress, id)
  const mastered = isMastered(progress, id)
  const shareStrings = useSubjectStrings(Math.round((points / CHAPTER_CAP) * 100))

  const body = <Prose>{children}</Prose>

  return (
    <article className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <header className="anim-fade-up">
        <h1 className="text-3xl font-extrabold tracking-tight text-balance">{title}</h1>
        {!quizRunning && (
          <p className="mt-2 max-w-2xl text-lg text-black/60 dark:text-white/60">{subtitle}</p>
        )}
        {/* Mastery goes with the rest of the page furniture once a quiz starts:
            a bar counting what this run is about to change is a distraction
            mid-question. */}
        {!quizRunning && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {mastered ? (
              <>
                <Badge tone="gold">{t.t('progress.mastered')}</Badge>
                <ShareCertificate
                  subject={chapterSubject(progress, id, title, shareStrings)}
                />
              </>
            ) : (
              <>
                <Meter
                  value={points}
                  max={CHAPTER_CAP}
                  label={t.t('progress.chapterLabel', { n: points, max: CHAPTER_CAP })}
                  className="h-1.5 w-32"
                />
                <span className="font-mono text-xs tabular-nums text-black/50 dark:text-white/50">
                  {t.t('progress.points', { n: points, max: CHAPTER_CAP })}
                </span>
              </>
            )}
          </div>
        )}
      </header>

      {!quizRunning && (
        <Card className="anim-fade-up" style={stagger(1, 90)}>
          {body}
        </Card>
      )}

      <section className="anim-fade-up space-y-4" style={stagger(2, 90)}>
        {!quizRunning && <SectionTitle>{t.t('quiz.practice')}</SectionTitle>}

        {/* The track picker, shown only while choosing. Once a quiz is running
            the tabs would offer to throw the run away mid-question, so they go
            with the rest of the page furniture. */}
        {!quizRunning && allTracks.length > 1 && (
          <div
            className="flex flex-wrap gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] p-1.5 dark:border-white/10 dark:bg-white/[0.04]"
            role="tablist"
          >
            {allTracks.map((track, i) => (
              <button
                key={track.key}
                type="button"
                role="tab"
                aria-selected={i === trackIndex}
                onClick={() => setTrackIndex(i)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition duration-200 ${
                  i === trackIndex
                    ? 'bg-white text-black shadow-sm dark:bg-felt-700 dark:text-white'
                    : 'text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white'
                }`}
              >
                {t.t(track.key)}
              </button>
            ))}
          </div>
        )}

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

        {/* Keyed on the track so switching tabs mounts a fresh quiz rather
            than carrying the previous one's phase and answers across. */}
        <Quiz
          key={trackIndex}
          generators={activeDrills}
          chapterId={id}
          chapterTitle={title}
          onRunningChange={handlePhase}
        />
      </section>

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
