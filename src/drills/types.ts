/**
 * The shape every drill shares.
 *
 * A generator produces a `Question`; the UI renders it, grades the answer, and
 * shows `explanation` regardless of whether the user was right — the point is
 * the reasoning, not the score.
 */

import { type ReactNode } from 'react'
import { type Call } from '../engine/parse'
import { type Payment } from '../engine/score'
import { type Tile } from '../engine/tiles'
import { type MessageKey, type Translator } from '../i18n'

export interface Choice {
  id: string
  /** Display text only. Grading must never key off this — see `choices()`. */
  label: string
  correct: boolean
  /**
   * Tiles to draw on the option, beside the label.
   *
   * "Which tile completes this hand?" is a question about tiles, and answering
   * it from the notation `3m` means translating back into a picture first. Both
   * are shown: the tile to recognize, and the notation to learn.
   */
  tiles?: Tile[]
}

export type QuestionKind = 'choice' | 'multi' | 'number' | 'tile-select' | 'payment'

export interface Question {
  /** Stable id for progress tracking, e.g. `fu.count`. */
  drillId: string
  kind: QuestionKind
  prompt: string
  /** Extra instruction shown under the prompt. */
  hint?: string
  /** Tiles to display, if the question has a hand. */
  tiles?: Tile[]
  calls?: Call[]
  winTile?: Tile
  /**
   * The conditions the scorer used, shown as a strip above the hand.
   *
   * Structured rather than pre-rendered prose so the strip can lay each field
   * out in its own slot — the dora as tiles, the winds as names, the win
   * condition set apart — instead of as a row of interchangeable badges.
   *
   * Anything listed here must actually bear on the answer. A drill that grades
   * only the tiles omits it entirely.
   */
  context?: {
    /** The flipped indicators, not the dora themselves: reading one is the work. */
    doraIndicators?: Tile[]
    /**
     * The ura indicators, flipped only when the hand declared riichi.
     *
     * Kept separate from `doraIndicators` rather than appended to them, because
     * the two are read the same way but earned differently: the player has to
     * see that the bottom row is theirs only because they declared.
     */
    uraIndicators?: Tile[]
    seatWind?: Tile
    roundWind?: Tile
    tsumo?: boolean
    /** Already-translated labels for extra conditions, e.g. a riichi declaration. */
    flags?: string[]
  }
  choices?: Choice[]
  /** For `number` questions. */
  answer?: number
  /**
   * For `payment` questions: the payments the winner collects, typed in rather
   * than chosen from a list.
   *
   * A ron is one number. A tsumo is what each player hands over — two figures
   * for a non-dealer win (each non-dealer, then the dealer), one for a dealer
   * win. Asking for the payments rather than the total is what makes this a
   * scoring drill instead of an arithmetic one: at the table you announce what
   * people owe you, not the sum.
   */
  payment?: Payment
  /** For `tile-select`: the indices into `tiles` that are correct. */
  correctIndices?: number[]
  /**
   * For `tile-select`: any one of `correctIndices` is a complete answer, rather
   * than all of them being required.
   *
   * The discard drill asks for a single tile, and a hand can hold more than one
   * copy of it — each copy is the same discard, so picking either is right.
   * "Select every terminal", by contrast, wants the whole set.
   */
  selectOne?: boolean
  /** Rendered after the user answers. */
  explanation: ReactNode
  seed: number
}

export interface Generator {
  id: string
  titleKey: MessageKey
  descriptionKey: MessageKey
  /**
   * Pure in `(seed, t)`: the same seed yields the same question in either
   * language, differing only in the words. That is what lets the test suite
   * assert grading is identical across languages.
   */
  generate: (seed: number, t: Translator) => Question
}
