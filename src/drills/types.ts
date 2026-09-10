/**
 * The shape every drill shares.
 *
 * A generator produces a `Question`; the UI renders it, grades the answer, and
 * shows `explanation` regardless of whether the user was right — the point is
 * the reasoning, not the score.
 */

import { type ReactNode } from 'react'
import { type Call } from '../engine/parse'
import { type Tile } from '../engine/tiles'
import { type MessageKey, type Translator } from '../i18n'

export interface Choice {
  id: string
  /** Display text only. Grading must never key off this — see `choices()`. */
  label: string
  correct: boolean
}

export type QuestionKind = 'choice' | 'multi' | 'number' | 'tile-select'

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
  /** Context lines shown beside the hand, e.g. "East seat · self-draw". */
  facts?: string[]
  choices?: Choice[]
  /** For `number` questions. */
  answer?: number
  /** For `tile-select`: the indices into `tiles` that are correct. */
  correctIndices?: number[]
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
