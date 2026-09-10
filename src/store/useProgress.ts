/** React binding for the progress store. */

import { useCallback, useEffect, useState } from 'react'
import {
  type Progress,
  loadProgress,
  markLessonRead,
  recordAttempt,
  recordQuizRun,
  resetProgress,
  saveProgress,
} from './progress'

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(loadProgress)

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  const record = useCallback((drillId: string, correct: boolean) => {
    setProgress((current) => recordAttempt(current, drillId, correct))
  }, [])

  const recordQuiz = useCallback((quizId: string, score: number) => {
    setProgress((current) => recordQuizRun(current, quizId, score))
  }, [])

  const readLesson = useCallback((lessonId: string) => {
    setProgress((current) => markLessonRead(current, lessonId))
  }, [])

  const reset = useCallback(() => {
    setProgress(resetProgress())
  }, [])

  return { progress, record, recordQuiz, readLesson, reset }
}
