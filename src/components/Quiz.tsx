/**
 * A ten-question quiz.
 *
 * Questions are generated up front from one run seed, so a whole quiz is
 * reproducible and the review screen can show every question exactly as it was
 * answered. A lesson with two drill types alternates between them across the
 * ten, which is why `generators` is a list.
 */

import { useCallback, useMemo, useState } from 'react'
import { type Generator, type Question } from '../drills/types'
import { makeRng, randomSeed } from '../drills/random'
import { useI18n } from '../i18n'
import { useProgress } from '../store/useProgress'
import { Hand } from './Hand'
import { Badge, Button, Card } from './ui'

export const QUIZ_LENGTH = 10

type Phase = 'intro' | 'answering' | 'answered' | 'results'

interface Answered {
  question: Question
  correct: boolean
}

/** One question per slot, cycling through the generators for a mixed quiz. */
function buildQuestions(
  generators: Generator[],
  runSeed: number,
  t: ReturnType<typeof useI18n>['t'],
): Question[] {
  const rng = makeRng(runSeed)
  return Array.from({ length: QUIZ_LENGTH }, (_, i) =>
    generators[i % generators.length].generate(rng.int(0x7fffffff), t),
  )
}

export function Quiz({ generators }: { generators: Generator[] }) {
  const { t } = useI18n()
  const { progress, record, recordQuiz } = useProgress()

  const [runSeed, setRunSeed] = useState(randomSeed)
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answered[]>([])

  const [selection, setSelection] = useState<string[]>([])
  const [numberAnswer, setNumberAnswer] = useState('')
  const [tileSelection, setTileSelection] = useState<number[]>([])
  const [openReview, setOpenReview] = useState<number | null>(null)

  const questions = useMemo(
    () => buildQuestions(generators, runSeed, t),
    [generators, runSeed, t],
  )
  const question = questions[index]

  // The quiz id groups the generators a lesson shows together.
  const quizId = generators.map((g) => g.id).join('+')
  const best = progress.quizzes?.[quizId]?.best

  const clearInputs = useCallback(() => {
    setSelection([])
    setNumberAnswer('')
    setTileSelection([])
  }, [])

  const start = useCallback(() => {
    setPhase('answering')
    setIndex(0)
    setAnswers([])
    clearInputs()
  }, [clearInputs])

  const restart = useCallback(() => {
    setRunSeed(randomSeed())
    setOpenReview(null)
    start()
  }, [start])

  const grade = (): boolean => {
    switch (question.kind) {
      case 'choice':
        return question.choices?.find((c) => c.id === selection[0])?.correct ?? false
      case 'multi': {
        const correct = new Set((question.choices ?? []).filter((c) => c.correct).map((c) => c.id))
        return correct.size === selection.length && selection.every((id) => correct.has(id))
      }
      case 'number':
        return Number(numberAnswer) === question.answer
      case 'tile-select': {
        const correct = new Set(question.correctIndices ?? [])
        return correct.size === tileSelection.length && tileSelection.every((i) => correct.has(i))
      }
    }
  }

  const submit = () => {
    const correct = grade()
    setAnswers((current) => [...current, { question, correct }])
    setPhase('answered')
    record(question.drillId, correct)
  }

  const advance = () => {
    if (index + 1 >= QUIZ_LENGTH) {
      const score = answers.filter((a) => a.correct).length
      recordQuiz(quizId, score)
      setPhase('results')
      return
    }
    setIndex((i) => i + 1)
    setPhase('answering')
    clearInputs()
  }

  const canSubmit =
    question?.kind === 'number'
      ? numberAnswer.trim() !== ''
      : question?.kind === 'tile-select'
        ? tileSelection.length > 0
        : selection.length > 0

  const toggle = (id: string) => {
    if (phase === 'answered') return
    setSelection((current) =>
      question.kind === 'multi'
        ? current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id]
        : [id],
    )
  }

  // ---------------------------------------------------------------- Intro

  if (phase === 'intro') {
    return (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{t.t(generators[0].titleKey)}</h3>
            <p className="text-sm text-black/55 dark:text-white/55">{t.t('quiz.startHint')}</p>
          </div>
          {best !== undefined && <Badge tone="neutral">{t.t('quiz.bestScore', { n: best })}</Badge>}
        </div>
        <div className="mt-4">
          <Button onClick={start}>{t.t('quiz.start')}</Button>
        </div>
      </Card>
    )
  }

  // ---------------------------------------------------------------- Results

  if (phase === 'results') {
    const score = answers.filter((a) => a.correct).length
    const verdict =
      score === QUIZ_LENGTH
        ? 'quiz.resultsPerfect'
        : score >= QUIZ_LENGTH * 0.7
          ? 'quiz.resultsStrong'
          : 'quiz.resultsKeepGoing'

    return (
      <Card>
        <h3 className="font-semibold">{t.t('quiz.resultsTitle')}</h3>
        <p className="mt-2 text-3xl font-bold tabular-nums">
          {t.t('quiz.resultsScore', { correct: score, total: QUIZ_LENGTH })}
        </p>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">{t.t(verdict)}</p>

        <div className="mt-5">
          <h4 className="mb-2 text-sm font-semibold">{t.t('quiz.reviewTitle')}</h4>
          <ul className="space-y-1">
            {answers.map((answer, i) => {
              const open = openReview === i
              return (
                <li key={i} className="rounded-lg border border-black/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setOpenReview(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm"
                  >
                    <Badge tone={answer.correct ? 'good' : 'bad'}>
                      {answer.correct ? t.t('quiz.correct') : t.t('quiz.wrong')}
                    </Badge>
                    <span className="text-black/70 dark:text-white/70">
                      {t.t('quiz.reviewQuestion', { n: i + 1 })}
                    </span>
                    <span className="ml-auto text-black/35 dark:text-white/35">{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <div className="border-t border-black/10 px-3 py-3 dark:border-white/10">
                      <p className="mb-3 text-sm font-medium">{answer.question.prompt}</p>
                      {answer.question.tiles && (
                        <div className="mb-3 overflow-x-auto">
                          <Hand
                            tiles={answer.question.tiles}
                            calls={answer.question.calls}
                            winTile={answer.question.winTile}
                            size="sm"
                          />
                        </div>
                      )}
                      <div className="rounded-lg bg-black/[0.03] p-3 dark:bg-white/[0.04]">
                        {answer.question.explanation}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-5">
          <Button onClick={restart}>{t.t('quiz.retry')}</Button>
        </div>
      </Card>
    )
  }

  // ---------------------------------------------------------------- Question

  const isLast = index + 1 >= QUIZ_LENGTH
  const answered = phase === 'answered'
  const wasCorrect = answers[answers.length - 1]?.correct ?? false

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{t.t(generators[index % generators.length].titleKey)}</h3>
          <p className="text-sm text-black/55 dark:text-white/55">
            {t.t('quiz.progress', { n: index + 1, total: QUIZ_LENGTH })}
          </p>
        </div>
        <div
          className="h-1.5 w-32 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={QUIZ_LENGTH}
        >
          <div
            className="h-full rounded-full bg-felt-700 transition-all dark:bg-felt-100"
            style={{ width: `${((index + 1) / QUIZ_LENGTH) * 100}%` }}
          />
        </div>
      </div>

      <p className="mb-1 font-medium">{question.prompt}</p>
      {question.hint && (
        <p className="mb-3 text-sm text-black/55 dark:text-white/55">{question.hint}</p>
      )}

      {question.tiles && (
        <div className="my-4 overflow-x-auto">
          <Hand
            tiles={question.tiles}
            calls={question.calls}
            winTile={question.winTile}
            sort={question.kind !== 'tile-select'}
            selected={question.kind === 'tile-select' ? tileSelection : []}
            onTileClick={
              question.kind === 'tile-select' && !answered
                ? (i) =>
                    setTileSelection((current) =>
                      current.includes(i) ? current.filter((x) => x !== i) : [...current, i],
                    )
                : undefined
            }
          />
        </div>
      )}

      {question.facts && question.facts.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2">
          {question.facts.map((fact) => (
            <li key={fact}>
              <Badge tone="info">{fact}</Badge>
            </li>
          ))}
        </ul>
      )}

      {(question.kind === 'choice' || question.kind === 'multi') && (
        <div className="grid gap-2 sm:grid-cols-2">
          {question.choices?.map((choice) => {
            const picked = selection.includes(choice.id)
            const tone = answered
              ? choice.correct
                ? 'border-emerald-500 bg-emerald-500/10'
                : picked
                  ? 'border-rose-500 bg-rose-500/10'
                  : 'border-black/10 dark:border-white/10'
              : picked
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-black/10 hover:border-black/25 dark:border-white/10 dark:hover:border-white/30'
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => toggle(choice.id)}
                disabled={answered}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${tone}`}
              >
                {choice.label}
              </button>
            )
          })}
        </div>
      )}

      {question.kind === 'number' && (
        <input
          type="number"
          value={numberAnswer}
          onChange={(e) => setNumberAnswer(e.target.value)}
          disabled={answered}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit && !answered) submit()
          }}
          className="w-40 rounded-lg border border-black/15 bg-white px-3 py-2 font-mono tabular-nums dark:border-white/15 dark:bg-felt-900"
          placeholder={t.t('quiz.yourAnswer')}
        />
      )}

      {question.kind === 'tile-select' && !answered && (
        <p className="text-sm text-black/55 dark:text-white/55">{t.t('quiz.tapTiles')}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!answered ? (
          <Button onClick={submit} disabled={!canSubmit}>
            {t.t('quiz.check')}
          </Button>
        ) : (
          <>
            <Badge tone={wasCorrect ? 'good' : 'bad'}>
              {wasCorrect ? t.t('quiz.correct') : t.t('quiz.wrong')}
            </Badge>
            <Button onClick={advance} variant="secondary">
              {t.t(isLast ? 'quiz.seeResults' : 'quiz.next')}
            </Button>
          </>
        )}
        <span className="ml-auto font-mono text-xs text-black/35 dark:text-white/35">
          {t.t('quiz.seed', { n: question.seed })}
        </span>
      </div>

      {answered && (
        <div className="mt-5 rounded-lg bg-black/[0.03] p-4 dark:bg-white/[0.04]">
          {question.explanation}
        </div>
      )}
    </Card>
  )
}
