/**
 * Progress state for the React tree.
 *
 * One store for the whole app, following the same shape as `src/i18n/context.tsx`.
 * This is a provider rather than a hook per caller for two reasons. The visible
 * one is that mastery is shown in four places at once — nav, home, lesson header,
 * results — and a quiz finishing has to move all of them. The less visible one is
 * that a hook holding its own `useState(loadProgress)` snapshot *and* its own save
 * effect, mounted three times on the same page, meant whichever effect ran last
 * wrote its stale copy over everyone else's: answering a question could lose the
 * run that recorded it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  type Progress,
  loadProgress,
  markLessonRead,
  recordAttempt,
  recordRun,
  resetProgress,
  saveProgress,
} from './progress'

interface ProgressValue {
  progress: Progress
  record: (drillId: string, correct: boolean) => void
  recordRun: (run: { chapterId: string; quizId: string; score: number }) => void
  readLesson: (lessonId: string) => void
  reset: () => void
}

const ProgressContext = createContext<ProgressValue | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(loadProgress)

  // The first render is what we just loaded, so writing it straight back would be
  // a pointless write — and, if storage is unavailable, a pointless throw.
  const loaded = useRef(false)
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true
      return
    }
    saveProgress(progress)
  }, [progress])

  // Every updater takes the previous state rather than closing over `progress`,
  // so two calls in one handler compose instead of the second undoing the first.
  const record = useCallback((drillId: string, correct: boolean) => {
    setProgress((current) => recordAttempt(current, drillId, correct))
  }, [])

  const run = useCallback((args: { chapterId: string; quizId: string; score: number }) => {
    setProgress((current) => recordRun(current, args))
  }, [])

  const readLesson = useCallback((lessonId: string) => {
    setProgress((current) => markLessonRead(current, lessonId))
  }, [])

  const reset = useCallback(() => {
    setProgress(resetProgress())
  }, [])

  const value = useMemo(
    () => ({ progress, record, recordRun: run, readLesson, reset }),
    [progress, record, run, readLesson, reset],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress(): ProgressValue {
  const value = useContext(ProgressContext)
  if (!value) throw new Error('useProgress must be used inside a ProgressProvider')
  return value
}
