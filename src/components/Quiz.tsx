/**
 * A ten-question quiz.
 *
 * Questions are generated up front from one run seed, so a whole quiz is
 * reproducible and the review screen can show every question exactly as it was
 * answered. A lesson with two drill types alternates between them across the
 * ten, which is why `generators` is a list.
 */

import { type CSSProperties, type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import { type Generator, type Question } from '../drills/types'
import { type Payment } from '../engine/score'
import { makeRng, randomSeed } from '../drills/random'
import { useI18n } from '../i18n'
import { useProgress } from '../store/useProgress'
import { CHAPTER_CAP, QUIZ_LENGTH, chapterPoints, isMastered, pointsForRun } from '../store/progress'
import { Hand } from './Hand'
import { HandContext } from './HandContext'
import { Tile } from './Tile'
import { Badge, Button, Card, Meter, stagger } from './ui'
import { ShareCertificate } from './ShareCertificate'
import { ImmersiveButton, RotateHint, useImmersive } from './Immersive'
import { chapterSubject } from '../share/subject'
import { useSubjectStrings } from '../share/useSubject'

type Phase = 'intro' | 'answering' | 'answered' | 'results'

interface Answered {
  question: Question
  correct: boolean
}

/**
 * Reads a points figure as written.
 *
 * The full number, always: 8000 is 8000 and 1300 is 1300. Players do say
 * "eight" for a mangan, but accepting that here taught the shorthand at the
 * expense of the figure — and it was ambiguous besides, since "8" reads equally
 * as 800 or 8000. A drill for learning what a hand pays should have the learner
 * write what it pays.
 *
 * Spacing and thousands separators are still tolerated, since `12,000` and
 * `12000` are the same answer typed by two different habits.
 *
 * Returns NaN for anything unparseable, which grades as wrong rather than
 * throwing.
 */
export function parsePoints(input: string): number {
  const trimmed = input.trim().replace(/[\s,]/g, '')
  if (trimmed === '') return NaN
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return NaN
  return n
}

/** One labelled points box. */
function PointsField({
  label,
  value,
  onChange,
  disabled,
  onEnter,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  onEnter: () => void
}) {
  return (
    // `flex-1` with a floor rather than a fixed width: two of these side by side
    // on a 390px screen used to overflow at 9rem each, and wrapping them to
    // separate lines buried the second field below the fold.
    <label className="flex min-w-[7.5rem] flex-1 flex-col gap-1.5 sm:max-w-44">
      <span className="text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter()
        }}
        className="w-full rounded-xl border border-black/15 bg-white px-3 py-2.5 text-right font-mono text-lg tabular-nums transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 disabled:opacity-60 sm:px-3.5 dark:border-white/15 dark:bg-felt-900"
      />
    </label>
  )
}

/**
 * The user's answer, rendered in the same shape as the correct one.
 *
 * Echoing it back as "2000/3900" rather than as the raw keystrokes is what makes
 * a near miss legible: a player who transposed a digit sees the number they
 * actually entered set beside the one they owed.
 */
function formatAnswer(expected: Payment, main: string, dealer: string): string {
  const a = parsePoints(main)
  if (Number.isNaN(a)) return '—'
  if (expected.kind === 'tsumo-nondealer') {
    const b = parsePoints(dealer)
    return Number.isNaN(b) ? `${a}/—` : `${a}/${b}`
  }
  return String(a)
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

export function Quiz({
  generators,
  chapterId,
  chapterTitle,
  onRunningChange,
}: {
  generators: Generator[]
  /** The chapter this quiz drills, so a finished run credits its mastery. */
  chapterId: string
  /** The chapter's own title, for the shareable card on a mastered run. */
  chapterTitle: string
  /**
   * Fires when the quiz starts and stops, so the page around it can clear the
   * lesson prose out of the way while questions are being answered. Also fires
   * on each question change, which is what lets the shell close a peeked clue.
   */
  onRunningChange?: (running: boolean) => void
}) {
  const { t } = useI18n()
  const { progress, record, recordRun } = useProgress()

  /**
   * The element handed to the Fullscreen API, and the one the CSS fallback
   * pins over the page. It wraps all three phases rather than the question
   * alone, so finishing a run does not drop out of immersive mode just as the
   * score appears.
   */
  const shellRef = useRef<HTMLDivElement>(null)
  const immersive = useImmersive(shellRef)

  const [runSeed, setRunSeed] = useState(randomSeed)
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answered[]>([])

  const [selection, setSelection] = useState<string[]>([])
  const [numberAnswer, setNumberAnswer] = useState('')
  const [tileSelection, setTileSelection] = useState<number[]>([])
  // Payment questions take up to two figures: the main payment, and the
  // dealer's larger share on a non-dealer self-draw.
  const [payMain, setPayMain] = useState('')
  const [payDealer, setPayDealer] = useState('')
  const [openReview, setOpenReview] = useState<number | null>(null)

  // Called here rather than in the results branch: hooks cannot sit behind a
  // condition, and the percentage a chapter card shows is its own progress.
  const shareStrings = useSubjectStrings(
    Math.round((chapterPoints(progress, chapterId) / CHAPTER_CAP) * 100),
  )

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
    setPayMain('')
    setPayDealer('')
  }, [])

  const start = useCallback(() => {
    setPhase('answering')
    setIndex(0)
    setAnswers([])
    clearInputs()
    onRunningChange?.(true)
  }, [clearInputs, onRunningChange])

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
        // `selectOne` questions name one tile that the hand may hold several
        // copies of, so exactly one pick from the set is the whole answer.
        if (question.selectOne) {
          return tileSelection.length === 1 && correct.has(tileSelection[0])
        }
        return correct.size === tileSelection.length && tileSelection.every((i) => correct.has(i))
      }
      case 'payment': {
        const p = question.payment
        if (!p) return false
        if (p.kind === 'ron') return parsePoints(payMain) === p.amount
        if (p.kind === 'tsumo-dealer') return parsePoints(payMain) === p.each
        return parsePoints(payMain) === p.each && parsePoints(payDealer) === p.fromDealer
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
      recordRun({ chapterId, quizId, score })
      setPhase('results')
      // The results screen reviews every question, so the lesson comes back.
      onRunningChange?.(false)
      return
    }
    setIndex((i) => i + 1)
    setPhase('answering')
    clearInputs()
    // Re-announced on each question so a clue left open is closed behind it.
    onRunningChange?.(true)
  }

  const needsDealerField = question?.payment?.kind === 'tsumo-nondealer'
  const canSubmit =
    question?.kind === 'number'
      ? numberAnswer.trim() !== ''
      : question?.kind === 'tile-select'
        ? tileSelection.length > 0
        : question?.kind === 'payment'
          ? payMain.trim() !== '' && (!needsDealerField || payDealer.trim() !== '')
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

  /**
   * The wrapper all three phases render into.
   *
   * Immersive mode is spelled as classes on this one element rather than as a
   * portal, so the quiz keeps its place in the document — and therefore its
   * state, its focus, and its position in the tab order — whether it is inline
   * on the page or filling the screen.
   *
   * `h-dvh` rather than `h-screen`: on a phone `100vh` is the viewport with the
   * browser's address bar *ignored*, so the bottom of the card — which is where
   * the Check button is — would sit underneath it.
   */
  const shell = (children: ReactNode) => (
    <div
      ref={shellRef}
      className={
        immersive.active
          ? 'fixed inset-0 z-50 flex h-dvh flex-col gap-2 overflow-y-auto overscroll-contain bg-felt-900 p-2 sm:p-4'
          : ''
      }
    >
      {immersive.active && <RotateHint />}
      {children}
      {/* Inline, the control sits below the quiz as a quiet offer. In immersive
          mode it is the way out, so it comes along at the bottom of the scroll
          where a thumb already is. */}
      <div className={`flex ${immersive.active ? 'justify-end pb-1' : 'mt-3 justify-end'}`}>
        <ImmersiveButton immersive={immersive} />
      </div>
    </div>
  )

  // ---------------------------------------------------------------- Intro

  if (phase === 'intro') {
    return shell(
      <Card className="anim-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">{t.t(generators[0].titleKey)}</h3>
            <p className="text-sm text-black/55 dark:text-white/55">{t.t('quiz.startHint')}</p>
          </div>
          {best !== undefined && <Badge tone="gold">{t.t('quiz.bestScore', { n: best })}</Badge>}
        </div>
        <div className="mt-5">
          <Button onClick={start}>{t.t('quiz.start')}</Button>
        </div>
      </Card>,
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

    const earned = pointsForRun(score)
    const points = chapterPoints(progress, chapterId)
    // Only celebrate the run that reached the cap, not every visit afterwards.
    const mastered = isMastered(progress, chapterId) && earned > 0

    return shell(
      <Card className="anim-fade-up">
        <h3 className="text-lg font-semibold tracking-tight">{t.t('quiz.resultsTitle')}</h3>
        {/* The score is the moment the quiz pays off, so it gets the one piece of
            display type on the page, and pops in rather than appearing. */}
        <p
          className="anim-pop mt-2 bg-gradient-to-br from-felt-700 to-felt-500 bg-clip-text text-4xl font-extrabold tabular-nums text-transparent dark:from-gold-300 dark:to-gold-500"
          style={stagger(1, 120)}
        >
          {t.t('quiz.resultsScore', { correct: score, total: QUIZ_LENGTH })}
        </p>
        <p className="anim-fade-up mt-1 text-black/60 dark:text-white/60" style={stagger(3, 90)}>
          {t.t(verdict)}
        </p>

        {/* What the run was worth, and where it leaves the chapter. The points
            were banked in `advance()` before this render, so the bar is read from
            the store rather than recomputed — it already includes this run.

            A run that earned something gets the gold pulse and the marks land
            one after another, because this is the payoff the ten questions were
            for. A run that earned nothing states it plainly and stays still: an
            animation there would be celebrating the absence of a reward. */}
        <div
          className={`mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border-t border-dashed border-black/10 pt-4 dark:border-white/10 ${
            earned > 0 ? 'anim-award-pulse' : 'anim-fade-up'
          }`}
          style={stagger(4, 90)}
        >
          {earned > 0 ? (
            <span className="flex items-center gap-2.5">
              <Badge tone="gold">{t.t('progress.earned', { n: earned })}</Badge>
              {/* One mark per point earned, arriving in sequence, so a perfect
                  run is visibly worth twice what a nine is. */}
              <span aria-hidden="true" className="flex items-center gap-1">
                {Array.from({ length: earned }, (_, i) => (
                  <span
                    key={i}
                    className="anim-award-mark h-2 w-2 rounded-full bg-gold-400 dark:bg-gold-300"
                    /* Set directly rather than via `stagger`, whose 480ms cap
                       would clamp both marks to the same delay and land them
                       together — the sequence is the whole point here. */
                    style={{ '--stagger': `${560 + i * 150}ms` } as CSSProperties}
                  />
                ))}
              </span>
            </span>
          ) : (
            <span className="text-sm text-black/55 dark:text-white/55">
              {t.t('progress.earnedNone')}
            </span>
          )}
          <span
            className={`ml-auto flex items-center gap-2.5 ${earned > 0 ? 'anim-award-rise' : ''}`}
            style={stagger(8, 90)}
          >
            <span className="font-mono text-xs tabular-nums text-black/55 dark:text-white/55">
              {t.t('progress.points', { n: points, max: CHAPTER_CAP })}
            </span>
            <Meter
              value={points}
              max={CHAPTER_CAP}
              label={t.t('progress.chapterLabel', { n: points, max: CHAPTER_CAP })}
              className="h-1.5 w-28"
              barClassName={earned > 0 ? 'sheen sheen-run relative' : ''}
            />
          </span>
        </div>

        {mastered && (
          <p
            className="anim-pop anim-ring-flash mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-gold-400/40 bg-gold-400/10 px-4 py-3 dark:bg-gold-400/[0.07]"
            style={stagger(10, 90)}
          >
            <Badge tone="gold">{t.t('progress.mastered')}</Badge>
            <span className="text-sm text-black/70 dark:text-white/70">
              {t.t('progress.masteredNow')}
            </span>
          </p>
        )}

        <div className="mt-6">
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
            {t.t('quiz.reviewTitle')}
          </h4>
          <ul className="space-y-1.5">
            {answers.map((answer, i) => {
              const open = openReview === i
              return (
                <li
                  key={i}
                  className="anim-fade-up overflow-hidden rounded-xl border border-black/10 transition duration-200 hover:border-black/20 dark:border-white/10 dark:hover:border-white/25"
                  style={stagger(i + 4, 45)}
                >
                  <button
                    type="button"
                    onClick={() => setOpenReview(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <Badge tone={answer.correct ? 'good' : 'bad'}>
                      {answer.correct ? t.t('quiz.correct') : t.t('quiz.wrong')}
                    </Badge>
                    <span className="text-black/70 dark:text-white/70">
                      {t.t('quiz.reviewQuestion', { n: i + 1 })}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`ml-auto text-lg leading-none text-black/35 transition-transform duration-300 dark:text-white/35 ${
                        open ? 'rotate-45' : ''
                      }`}
                    >
                      +
                    </span>
                  </button>
                  {open && (
                    <div className="anim-slide-down border-t border-black/10 px-3.5 py-3.5 dark:border-white/10">
                      <p className="mb-3 font-medium">{answer.question.prompt}</p>
                      {answer.question.tiles && (
                        <div className="mb-3">
                          {answer.question.context && (
                            <HandContext {...answer.question.context} />
                          )}
                          <Hand
                            tiles={answer.question.tiles}
                            calls={answer.question.calls}
                            winTile={answer.question.winTile}
                            sort={answer.question.kind !== 'tile-select'}
                            size="sm"
                          />
                        </div>
                      )}
                      <div className="rounded-xl bg-black/[0.03] p-3.5 dark:bg-white/[0.04]">
                        {answer.question.explanation}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={restart}>{t.t('quiz.retry')}</Button>
          {/* Offered only on the run that earned mastery: a share button on an
              ordinary result would be asking to post a middling score. */}
          {mastered && (
            <ShareCertificate
              subject={chapterSubject(progress, chapterId, chapterTitle, shareStrings)}
            />
          )}
        </div>
      </Card>,
    )
  }

  // ---------------------------------------------------------------- Question

  const isLast = index + 1 >= QUIZ_LENGTH
  const answered = phase === 'answered'
  const wasCorrect = answers[answers.length - 1]?.correct ?? false

  return shell(
    <Card>
      {/* The drill's own name is desktop furniture: on a phone it costs a line
          that the hand needs, and the page heading above already says which
          lesson this is. The counter and bar stay, because "3 of 10" is the one
          thing a learner mid-run actually looks up at. */}
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4 short:mb-2">
        <div className="min-w-0">
          <h3 className="hidden truncate text-lg font-semibold tracking-tight sm:block short:hidden">
            {t.t(generators[index % generators.length].titleKey)}
          </h3>
          <p className="text-xs text-black/55 sm:text-sm dark:text-white/55">
            {t.t('quiz.progress', { n: index + 1, total: QUIZ_LENGTH })}
          </p>
        </div>
        {/* Keyed on the question index so `sheen-run` sweeps the bar once per
            advance, marking the progress as having just moved. */}
        <Meter
          key={index}
          value={index + 1}
          max={QUIZ_LENGTH}
          label={t.t('quiz.progress', { n: index + 1, total: QUIZ_LENGTH })}
          className="h-2 w-20 shrink-0 sm:w-36"
          barClassName="sheen sheen-run relative"
        />
      </div>

      {/* Keyed on the index so each new question fades in as its own thing
          rather than swapping its text in place. */}
      <div key={index} className="anim-fade-up">
        <p className="mb-1 text-base font-medium tracking-tight sm:text-lg">{question.prompt}</p>
        {question.hint && (
          <p className="mb-2 text-sm text-black/55 sm:mb-3 short:mb-1 dark:text-white/55">
            {question.hint}
          </p>
        )}

        {question.tiles && (
          <div className="my-3 sm:my-4 short:my-2">
            {question.context && <HandContext {...question.context} />}
            {/* The top padding is headroom for the selected tile, which lifts
                clear of the row — without it a picked tile is clipped by the
                context strip above. Tighter on a phone, where every line of
                vertical space is one the hand could have used. */}
            <div className="pt-2 pb-1 sm:pt-3 short:pt-2">
              <Hand
                tiles={question.tiles}
                calls={question.calls}
                winTile={question.winTile}
                sort={question.kind !== 'tile-select'}
                selected={question.kind === 'tile-select' ? tileSelection : []}
                animate
                onTileClick={
                  question.kind === 'tile-select' && !answered
                    ? (i) =>
                        setTileSelection((current) => {
                          if (current.includes(i)) return current.filter((x) => x !== i)
                          // Picking a second tile on a one-tile question replaces
                          // the first rather than adding to it, so the answer
                          // cannot be wrong by accumulation.
                          return question.selectOne ? [i] : [...current, i]
                        })
                    : undefined
                }
              />
            </div>
          </div>
        )}
      </div>

      {(question.kind === 'choice' || question.kind === 'multi') && (
        /**
         * The four options sit in one row, as four buttons.
         *
         * A single row makes the options one comparable set: the eye sweeps
         * them left to right instead of reading a 2x2 block corner by corner,
         * which is what you actually do when weighing four candidate answers.
         * It also keeps the hand above them in view rather than pushed up the
         * page.
         *
         * A narrow phone cannot hold four abreast and keep each readable, so it
         * gets a 2x2 block instead of the column it used to get: four stacked
         * options ran past the bottom of the screen, which meant scrolling away
         * from the hand to see the last one — and comparing an option against a
         * hand you cannot see is the one thing this layout exists to prevent.
         *
         * Held sideways there is width again, so `landscape` takes the row back
         * even below `sm`. That is the orientation immersive mode asks for.
         */
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5 short:gap-2">
          {question.choices?.map((choice, i) => {
            const picked = selection.includes(choice.id)
            // Once graded, the right answer flashes a ring outward — the one
            // moment worth celebrating — while a wrong pick simply turns red.
            const tone = answered
              ? choice.correct
                ? 'border-emerald-500 bg-emerald-500/10 anim-ring-flash'
                : picked
                  ? 'border-rose-500 bg-rose-500/10 anim-shake'
                  : 'border-black/10 opacity-60 dark:border-white/10'
              : picked
                ? 'border-sky-500 bg-sky-500/10 shadow-sm'
                : 'border-black/10 hover:-translate-y-0.5 hover:border-black/25 hover:shadow-sm dark:border-white/10 dark:hover:border-white/30'
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => toggle(choice.id)}
                disabled={answered}
                style={stagger(i, 50)}
                // Tall enough to be an easy target: a four-across row already
                // makes each option narrow, so the height is what keeps it
                // comfortably tappable on a phone. `min-h` rather than padding
                // alone, so a one-line option and a wrapped two-line one are
                // the same size and the row stays even. It relaxes on a short
                // landscape screen, where four 4.5rem boxes plus the hand above
                // them do not fit between the top of the page and the bottom.
                className={`anim-fade-up flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-center text-sm transition duration-200 sm:min-h-[4.5rem] sm:px-3 sm:py-4 short:min-h-[2.75rem] short:py-2 ${tone}`}
              >
                {choice.tiles && choice.tiles.length > 0 && (
                  <span className="flex shrink-0 items-end gap-0.5">
                    {choice.tiles.map((tile, j) => (
                      <Tile key={j} tile={tile} size="xs" />
                    ))}
                  </span>
                )}
                {/* An option that draws its tiles needs no text beside them:
                    the notation would only restate the picture, and the tile
                    is what the player is being asked to recognize. Generators
                    signal this by rendering an empty label. */}
                {choice.label && <span>{choice.label}</span>}
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
          className="w-full max-w-44 rounded-xl border border-black/15 bg-white px-3.5 py-2.5 font-mono text-lg tabular-nums transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 dark:border-white/15 dark:bg-felt-900"
          placeholder={t.t('quiz.yourAnswer')}
        />
      )}

      {question.kind === 'payment' && question.payment && (
        <div>
          <div className="flex flex-wrap items-end gap-3">
            <PointsField
              label={t.t(
                question.payment.kind === 'ron'
                  ? 'drill.score.total.fieldRon'
                  : question.payment.kind === 'tsumo-dealer'
                    ? 'drill.score.total.fieldAll'
                    : 'drill.score.total.fieldEach',
              )}
              value={payMain}
              onChange={setPayMain}
              disabled={answered}
              onEnter={() => canSubmit && !answered && submit()}
            />
            {needsDealerField && (
              <PointsField
                label={t.t('drill.score.total.fieldDealer')}
                value={payDealer}
                onChange={setPayDealer}
                disabled={answered}
                onEnter={() => canSubmit && !answered && submit()}
              />
            )}
          </div>
          {!answered && (
            <p className="mt-2 text-xs text-black/50 dark:text-white/50">
              {t.t('drill.score.total.fullFigure')}
            </p>
          )}
          {answered && (
            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
              {t.t('drill.score.total.yourAnswer', {
                answer: formatAnswer(question.payment, payMain, payDealer),
                correct: t.payment(question.payment),
              })}
            </p>
          )}
        </div>
      )}

      {question.kind === 'tile-select' && !answered && (
        <p className="text-sm text-black/55 dark:text-white/55">{t.t('quiz.tapTiles')}</p>
      )}

      {/* The seed is a debugging affordance for reproducing a question, and on a
          phone it was competing for the row the Check button needs — so below
          `sm` it goes, and the button gets the full width it wants as a primary
          target under a thumb. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-5 short:mt-3">
        {!answered ? (
          <Button onClick={submit} disabled={!canSubmit} className="w-full sm:w-auto">
            {t.t('quiz.check')}
          </Button>
        ) : (
          <>
            <Badge tone={wasCorrect ? 'good' : 'bad'} className={wasCorrect ? 'anim-pop' : 'anim-shake'}>
              {wasCorrect ? t.t('quiz.correct') : t.t('quiz.wrong')}
            </Badge>
            <Button onClick={advance} variant="secondary" className="ml-auto sm:ml-0">
              {t.t(isLast ? 'quiz.seeResults' : 'quiz.next')}
            </Button>
          </>
        )}
        <span className="ml-auto hidden font-mono text-xs text-black/35 sm:inline dark:text-white/35">
          {t.t('quiz.seed', { n: question.seed })}
        </span>
      </div>

      {answered && (
        <div
          className="anim-slide-down mt-5 rounded-xl border-l-2 border-felt-400 bg-black/[0.03] p-4 dark:border-gold-400/60 dark:bg-white/[0.04]"
          style={stagger(1, 120)}
        >
          {question.explanation}
        </div>
      )}
    </Card>,
  )
}
