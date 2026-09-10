/**
 * The drill generators, one or more per module.
 *
 * Each builds a question backwards from the concept it teaches, then runs the
 * engine forward to produce the answer key and the explanation, so a generator
 * can never drift out of agreement with the scorer.
 */

import { Breakdown } from '../components/Breakdown'
import { Hand } from '../components/Hand'
import { scoreHandFull } from '../engine/explain'
import { discardOptions, shanten, waits } from '../engine/shanten'
import { scoreHand } from '../engine/score'
import { ALL_FACES, WINDS, formatTiles, isTerminalOrHonor, suitOf } from '../engine/tiles'
import { YAKU_LIST, type YakuId } from '../engine/yaku'
import { type Translator } from '../i18n'
import { buildScoringHand } from './hands'
import { type Rng, makeRng } from './random'
import { type Choice, type Generator, type Question } from './types'

/**
 * Builds a choice list from one right answer and a pool of wrong ones.
 *
 * Correctness and de-duplication both key off `key()`, never off the rendered
 * label. Grading by display text would break the moment the app was
 * translated — and would break silently, marking every answer wrong.
 *
 * Distractors are de-duplicated against each other as well as against the
 * answer: two identical options would let a user spot the odd one out, and a
 * repeat of the answer would mark a right choice wrong.
 */
function choices<T>(
  rng: Rng,
  correct: T,
  wrong: readonly T[],
  key: (value: T) => string,
  render: (value: T) => string,
  count = 4,
): Choice[] {
  const correctKey = key(correct)
  const seen = new Set([correctKey])
  const distractors: T[] = []

  for (const candidate of rng.shuffle([...wrong])) {
    if (distractors.length >= count - 1) break
    const candidateKey = key(candidate)
    if (seen.has(candidateKey)) continue
    seen.add(candidateKey)
    distractors.push(candidate)
  }

  return rng
    .shuffle([correct, ...distractors])
    .map((value, i) => ({ id: `c${i}`, label: render(value), correct: key(value) === correctKey }))
}

/** Winds are honor tiles, so the tile namer already knows how to say them. */
function contextFacts(built: ReturnType<typeof buildScoringHand>, t: Translator): string[] {
  if (!built) return []
  const { context, dealer } = built
  return [
    t.t('fact.seat', { wind: t.tile(context.seatWind) }),
    t.t('fact.round', { wind: t.tile(context.roundWind) }),
    t.t(context.tsumo ? 'fact.tsumo' : 'fact.ron'),
    t.t(context.menzen ? 'fact.closed' : 'fact.open'),
    t.t(dealer ? 'fact.dealer' : 'fact.nonDealer'),
  ]
}

/**
 * Randomizes the win condition. Doing this here rather than inside the hand
 * builder keeps the builder focused on tile shapes.
 */
function randomContext(rng: Rng, menzen: boolean) {
  const seat = rng.pick(WINDS)
  return {
    seatWind: seat,
    roundWind: rng.pick(WINDS),
    tsumo: rng.next() < 0.45,
    menzen,
    riichi: menzen && rng.next() < 0.4,
  }
}

// ---------------------------------------------------------------- Tiles

const tileRecognition: Generator = {
  id: 'tiles.name',
  titleKey: 'drill.tiles.name.title',
  descriptionKey: 'drill.tiles.name.desc',
  generate: (seed, t) => {
    const rng = makeRng(seed)
    const tile = rng.pick(ALL_FACES)
    const isHonorTile = suitOf(tile) === 'z'

    return {
      drillId: 'tiles.name',
      kind: 'choice',
      prompt: t.t('drill.tiles.name.prompt'),
      tiles: [tile],
      choices: choices(rng, tile, ALL_FACES, String, t.tile),
      explanation: (
        <p className="text-sm">
          {t.t(isHonorTile ? 'drill.tiles.name.explainHonor' : 'drill.tiles.name.explainSuited', {
            name: t.tile(tile),
            notation: formatTiles([tile]),
            suit: isHonorTile ? '' : t.suit(suitOf(tile)),
          })}
        </p>
      ),
      seed,
    }
  },
}

const terminalPicker: Generator = {
  id: 'tiles.terminals',
  titleKey: 'drill.tiles.terminals.title',
  descriptionKey: 'drill.tiles.terminals.desc',
  generate: (seed, t) => {
    const rng = makeRng(seed)
    // Draw at least two terminals/honors and at least two simples, so the
    // question is never trivially "all of them" or "none of them".
    const terminals = rng.shuffle(ALL_FACES.filter(isTerminalOrHonor)).slice(0, 2 + rng.int(3))
    const simples = rng.shuffle(ALL_FACES.filter((f) => !isTerminalOrHonor(f))).slice(0, 8 - terminals.length)
    const tiles = rng.shuffle([...terminals, ...simples])
    const correctIndices = tiles
      .map((tile, index) => (isTerminalOrHonor(tile) ? index : -1))
      .filter((i) => i >= 0)

    return {
      drillId: 'tiles.terminals',
      kind: 'tile-select',
      prompt: t.t('drill.tiles.terminals.prompt'),
      hint: t.t('drill.tiles.terminals.hint'),
      tiles,
      correctIndices,
      explanation: (
        <div className="space-y-2 text-sm">
          <p>
            {t.t('drill.tiles.terminals.explain', {
              list:
                formatTiles(correctIndices.map((i) => tiles[i])) ||
                t.t('drill.tiles.terminals.none'),
            })}
          </p>
          <p className="text-black/60 dark:text-white/60">
            {t.t('drill.tiles.terminals.why')}
          </p>
        </div>
      ),
      seed,
    }
  },
}

// ---------------------------------------------------------------- Hand shapes

const waitIdentification: Generator = {
  id: 'shapes.wait',
  titleKey: 'drill.shapes.wait.title',
  descriptionKey: 'drill.shapes.wait.desc',
  generate: (seed, t) => {
    const rng = makeRng(seed)

    for (let attempt = 0; attempt < 80; attempt++) {
      const built = buildScoringHand(makeRng(seed + attempt * 7919))
      if (!built) continue

      // Remove the winning tile to get back to the tenpai shape.
      const index = built.hand.concealed.indexOf(built.hand.winTile)
      if (index < 0) continue
      const tenpai = [
        ...built.hand.concealed.slice(0, index),
        ...built.hand.concealed.slice(index + 1),
      ]
      const winning = waits(tenpai, built.hand.calls.length)
      if (winning.length === 0) continue

      // The answer is notation, which is already language-neutral, so it keys
      // and renders as itself.
      const answer = formatTiles(winning)
      const wrong = ALL_FACES.map((f) => formatTiles([f]))

      return {
        drillId: 'shapes.wait',
        kind: 'choice',
        prompt: t.t('drill.shapes.wait.prompt'),
        tiles: tenpai,
        calls: built.hand.calls,
        choices: choices(rng, answer, wrong, (s) => s, (s) => s),
        explanation: (
          <div className="space-y-3 text-sm">
            <p>
              {t.t('drill.shapes.wait.explain', {
                notation: answer,
                names: winning.map(t.tile).join(', '),
              })}
            </p>
            <div>
              <p className="mb-2 text-black/60 dark:text-white/60">
                {t.t('drill.shapes.wait.completed')}
              </p>
              <Hand tiles={tenpai} calls={built.hand.calls} winTile={winning[0]} size="sm" />
            </div>
          </div>
        ),
        seed,
      } satisfies Question
    }

    return tileRecognition.generate(seed, t)
  },
}

const shantenCount: Generator = {
  id: 'shapes.shanten',
  titleKey: 'drill.shapes.shanten.title',
  descriptionKey: 'drill.shapes.shanten.desc',
  generate: (seed, t) => {
    const rng = makeRng(seed)
    const built = buildScoringHand(makeRng(seed))
    if (!built) return tileRecognition.generate(seed, t)

    // Swap a couple of tiles out for random ones to back the hand away from ready.
    const tiles = [...built.hand.concealed]
    const swaps = 1 + rng.int(2)
    for (let i = 0; i < swaps; i++) {
      tiles[rng.int(tiles.length)] = rng.pick(ALL_FACES)
    }
    const distance = shanten(tiles, built.hand.calls.length)

    // Answer and options come from one numeric domain rendered once, so the
    // two can never drift apart the way two copies of a template would.
    const renderDistance = (n: number) =>
      n === 0 ? t.t('drill.shapes.shanten.ready') : t.t('drill.shapes.shanten.away', { n })

    return {
      drillId: 'shapes.shanten',
      kind: 'choice',
      prompt: t.t('drill.shapes.shanten.prompt'),
      hint: t.t('drill.shapes.shanten.hint'),
      tiles,
      calls: built.hand.calls,
      choices: choices(rng, distance, [0, 1, 2, 3, 4], String, renderDistance),
      explanation: (
        <p className="text-sm">
          {distance === 0
            ? t.t('drill.shapes.shanten.explainReady')
            : t.t('drill.shapes.shanten.explainAway', { n: distance })}
        </p>
      ),
      seed,
    }
  },
}

// ---------------------------------------------------------------- Yaku

/**
 * Situational yaku are given away by the context line rather than read off the
 * tiles, so they make poor questions and poor distractors.
 */
const SITUATIONAL = new Set<YakuId>([
  'riichi',
  'double-riichi',
  'ippatsu',
  'menzen-tsumo',
  'haitei',
  'houtei',
  'rinshan',
  'chankan',
])

/**
 * Wrong answers are derived from the engine's own yaku list, so the pool can
 * never go stale when a yaku is added or renamed.
 */
const DISTRACTOR_POOL: YakuId[] = YAKU_LIST.filter(
  (y) => !y.yakuman && !SITUATIONAL.has(y.id),
).map((y) => y.id)

const yakuIdentification: Generator = {
  id: 'yaku.identify',
  titleKey: 'drill.yaku.identify.title',
  descriptionKey: 'drill.yaku.identify.desc',
  generate: (seed, t) => {
    const rng = makeRng(seed)

    for (let attempt = 0; attempt < 60; attempt++) {
      const inner = makeRng(seed + attempt * 104729)
      const menzen = inner.next() < 0.65
      const built = buildScoringHand(inner, {
        openMelds: menzen ? 0 : 1,
        context: randomContext(inner, menzen),
      })
      if (!built) continue

      const scored = scoreHandFull(built.hand, built.context, { dealer: built.dealer })
      if (!scored.valid) continue

      const shapeYaku = scored.yaku.filter((y) => !SITUATIONAL.has(y.id))
      if (shapeYaku.length === 0) continue

      const present = new Set<YakuId>(shapeYaku.map((y) => y.id))
      const absent = DISTRACTOR_POOL.filter((id) => !present.has(id))

      // Options are yaku ids until the very last step, so grading is by id and
      // only the label is translated.
      const options: Choice[] = rng
        .shuffle([
          ...shapeYaku.map((y) => y.id),
          ...rng.shuffle(absent).slice(0, Math.max(2, 5 - shapeYaku.length)),
        ])
        .map((id, i) => ({ id: `y${i}`, label: t.yaku(id), correct: present.has(id) }))

      return {
        drillId: 'yaku.identify',
        kind: 'multi',
        prompt: t.t('drill.yaku.identify.prompt'),
        hint: t.t('drill.yaku.identify.hint'),
        tiles: built.hand.concealed,
        calls: built.hand.calls,
        winTile: built.hand.winTile,
        facts: contextFacts(built, t),
        choices: options,
        explanation: <Breakdown scored={scored} dealer={built.dealer} />,
        seed,
      } satisfies Question
    }

    return tileRecognition.generate(seed, t)
  },
}

// ---------------------------------------------------------------- Han / Fu / Score

/** Shared setup for the three counting drills — they all pose a scored hand. */
function scoredQuestion(seed: number) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const inner = makeRng(seed + attempt * 15485863)
    const menzen = inner.next() < 0.7
    const built = buildScoringHand(inner, {
      openMelds: menzen ? 0 : 1,
      context: randomContext(inner, menzen),
    })
    if (!built) continue
    const scored = scoreHandFull(built.hand, built.context, { dealer: built.dealer })
    // Yakuman skip the han/fu tables entirely, so they make poor counting drills.
    if (scored.valid && scored.yakuman === 0) return { built, scored }
  }
  return null
}

const hanCount: Generator = {
  id: 'han.count',
  titleKey: 'drill.han.count.title',
  descriptionKey: 'drill.han.count.desc',
  generate: (seed, t): Question => {
    const made = scoredQuestion(seed)
    if (!made) return tileRecognition.generate(seed, t)
    const { built, scored } = made

    return {
      drillId: 'han.count',
      kind: 'number',
      prompt: t.t('drill.han.count.prompt'),
      hint: t.t('drill.han.count.hint'),
      tiles: built.hand.concealed,
      calls: built.hand.calls,
      winTile: built.hand.winTile,
      facts: contextFacts(built, t),
      answer: scored.han,
      explanation: <Breakdown scored={scored} dealer={built.dealer} />,
      seed,
    }
  },
}

const fuCount: Generator = {
  id: 'fu.count',
  titleKey: 'drill.fu.count.title',
  descriptionKey: 'drill.fu.count.desc',
  generate: (seed, t): Question => {
    const made = scoredQuestion(seed)
    if (!made) return tileRecognition.generate(seed, t)
    const { built, scored } = made

    return {
      drillId: 'fu.count',
      kind: 'number',
      prompt: t.t('drill.fu.count.prompt'),
      hint: t.t('drill.fu.count.hint'),
      tiles: built.hand.concealed,
      calls: built.hand.calls,
      winTile: built.hand.winTile,
      facts: contextFacts(built, t),
      answer: scored.fu.total,
      explanation: <Breakdown scored={scored} dealer={built.dealer} />,
      seed,
    }
  },
}

const scoreCount: Generator = {
  id: 'score.total',
  titleKey: 'drill.score.total.title',
  descriptionKey: 'drill.score.total.desc',
  generate: (seed, t): Question => {
    const made = scoredQuestion(seed)
    if (!made) return tileRecognition.generate(seed, t)
    const { built, scored } = made
    const rng = makeRng(seed)

    // Distractors are the payouts of neighbouring han/fu values, which is what
    // a user who miscounts by one actually lands on -- and they are forced
    // distinct so no two options collapse into the same number.
    const total = scored.score.total
    const nearby = [...new Set([
      scoreHand({ han: scored.han + 1, fu: scored.fu.total, dealer: built.dealer, tsumo: built.context.tsumo }).total,
      scoreHand({ han: Math.max(1, scored.han - 1), fu: scored.fu.total, dealer: built.dealer, tsumo: built.context.tsumo }).total,
      scoreHand({ han: scored.han, fu: scored.fu.total + 10, dealer: built.dealer, tsumo: built.context.tsumo }).total,
      scoreHand({ han: scored.han, fu: scored.fu.total, dealer: !built.dealer, tsumo: built.context.tsumo }).total,
      total * 2,
      Math.max(100, Math.round(total / 2 / 100) * 100),
    ])].filter((n) => n !== total)

    return {
      drillId: 'score.total',
      kind: 'choice',
      prompt: t.t('drill.score.total.prompt'),
      hint: t.t('drill.score.total.hint', { han: scored.han, fu: scored.fu.total }),
      tiles: built.hand.concealed,
      calls: built.hand.calls,
      winTile: built.hand.winTile,
      facts: contextFacts(built, t),
      choices: choices(rng, total, nearby, String, String),
      explanation: <Breakdown scored={scored} dealer={built.dealer} />,
      seed,
    }
  },
}

// ---------------------------------------------------------------- Efficiency

const efficiencyDrill: Generator = {
  id: 'efficiency.discard',
  titleKey: 'drill.efficiency.discard.title',
  descriptionKey: 'drill.efficiency.discard.desc',
  generate: (seed, t): Question => {
    const rng = makeRng(seed)

    for (let attempt = 0; attempt < 60; attempt++) {
      const built = buildScoringHand(makeRng(seed + attempt * 7907), { openMelds: 0 })
      if (!built) continue

      // Perturb a complete hand into a realistic 14-tile decision.
      const tiles = [...built.hand.concealed]
      for (let i = 0; i < 2 + rng.int(2); i++) {
        tiles[rng.int(tiles.length)] = rng.pick(ALL_FACES)
      }
      if (tiles.length !== 14) continue

      const options = discardOptions(tiles)
      if (options.length < 3) continue

      const best = options[0]
      // A drill is only meaningful if one discard is clearly better than another.
      const worst = options[options.length - 1]
      if (best.shanten === worst.shanten && best.tilesLeft === worst.tilesLeft) continue

      const correctIndices = tiles
        .map((tile, index) => (tile === best.tile ? index : -1))
        .filter((i) => i >= 0)
        .slice(0, 1)

      return {
        drillId: 'efficiency.discard',
        kind: 'tile-select',
        prompt: t.t('drill.efficiency.discard.prompt'),
        hint: t.t('drill.efficiency.discard.hint'),
        tiles,
        correctIndices,
        explanation: (
          <div className="space-y-3 text-sm">
            <p>
              {t.t(
                best.shanten === 0
                  ? 'drill.efficiency.discard.explainReady'
                  : 'drill.efficiency.discard.explainAway',
                {
                  name: t.tile(best.tile),
                  n: best.shanten,
                  tiles: t.t('unit.tiles', { n: best.tilesLeft }),
                  notation: formatTiles(best.faces),
                },
              )}
            </p>
            <div>
              <p className="mb-1 text-black/60 dark:text-white/60">
                {t.t('drill.efficiency.discard.ranked')}
              </p>
              <ul className="space-y-1">
                {options.slice(0, 6).map((option) => (
                  <li key={option.tile} className="flex justify-between gap-4 font-mono text-xs">
                    <span>{formatTiles([option.tile])}</span>
                    <span className="text-black/55 dark:text-white/55">
                      {option.shanten === 0
                        ? t.t('drill.efficiency.discard.rowReady')
                        : t.t('drill.efficiency.discard.rowAway', { n: option.shanten })}{' '}
                      · {t.t('unit.tiles', { n: option.tilesLeft })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ),
        seed,
      } satisfies Question
    }

    return tileRecognition.generate(seed, t)
  },
}

export const GENERATORS = {
  tileRecognition,
  terminalPicker,
  waitIdentification,
  shantenCount,
  yakuIdentification,
  hanCount,
  fuCount,
  scoreCount,
  efficiencyDrill,
}

export const ALL_GENERATORS: Generator[] = Object.values(GENERATORS)
