/**
 * The drill generators, one or more per module.
 *
 * Each builds a question backwards from the concept it teaches, then runs the
 * engine forward to produce the answer key and the explanation, so a generator
 * can never drift out of agreement with the scorer.
 */

import { Breakdown } from '../components/Breakdown'
import { Hand } from '../components/Hand'
import { stagger } from '../components/ui'
import { scoreHandFull } from '../engine/explain'
import { type Hand as HandShape, decompose, waitInterpretations } from '../engine/parse'
import { discardOptions, shanten, waits } from '../engine/shanten'
import { paymentOf } from '../engine/score'
import {
  ALL_FACES,
  ROUND_WINDS,
  type Tile,
  WINDS,
  face,
  formatTiles,
  isTerminalOrHonor,
  parseTiles,
  sortTiles,
  suitOf,
} from '../engine/tiles'
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
  tilesOf?: (value: T) => Tile[],
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

  return rng.shuffle([correct, ...distractors]).map((value, i) => ({
    id: `c${i}`,
    label: render(value),
    correct: key(value) === correctKey,
    tiles: tilesOf?.(value),
  }))
}

/**
 * The conditions a counting drill has to state.
 *
 * Everything here bears on the answer and none of it is visible in the tiles.
 * Riichi is the case that made this necessary: it is worth a han, so a hand
 * that declared it without saying so asked the player to count a han they were
 * never told about, and the answer key and the question disagreed.
 *
 * Open versus closed is deliberately absent — the called melds show it in the
 * hand itself — as is dealer, which the seat wind already gives away.
 */
function handContext(built: ReturnType<typeof buildScoringHand>, t: Translator) {
  if (!built) return undefined
  const { context } = built
  const flags: string[] = []
  if (context.doubleRiichi) flags.push(t.t('yaku.double-riichi'))
  else if (context.riichi) flags.push(t.t('context.riichi'))
  if (context.ippatsu) flags.push(t.t('context.ippatsu'))

  return {
    doraIndicators: context.doraIndicators,
    seatWind: context.seatWind,
    roundWind: context.roundWind,
    tsumo: context.tsumo,
    flags,
  }
}

/** Counts copies of each face in a hand. */
function faceCounts(tiles: Tile[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const tile of tiles) counts.set(face(tile), (counts.get(face(tile)) ?? 0) + 1)
  return counts
}

/** True when some tile appears at least `n` times. */
function hasAtLeast(tiles: Tile[], n: number): boolean {
  return [...faceCounts(tiles).values()].some((count) => count >= n)
}

/**
 * Swaps `count` tiles of a hand for random ones, respecting the tile supply.
 *
 * Drills build questions by taking a complete hand and breaking it, and the
 * obvious way to do that — assign a random face to a random slot — can deal a
 * fifth copy of a tile. Only four of each exist, so such a hand cannot occur
 * and asking a question about it is asking about a position no player can be
 * in. The replacement pool is therefore restricted to faces that still have
 * room.
 *
 * `maxCopies` lowers that ceiling below the usual four, which the efficiency
 * drill uses to keep quads out of hands entirely.
 */
function replaceTiles(rng: Rng, tiles: Tile[], count: number, maxCopies = 4): Tile[] {
  const out = [...tiles]
  const copies = faceCounts(out)

  for (let i = 0; i < count; i++) {
    const at = rng.int(out.length)
    const outgoing = face(out[at])
    // The outgoing tile frees a slot of its own face, so it is discounted here.
    const room = ALL_FACES.filter(
      (f) => (copies.get(f) ?? 0) - (f === outgoing ? 1 : 0) < maxCopies,
    )
    if (room.length === 0) break
    const incoming = rng.pick(room)
    copies.set(outgoing, (copies.get(outgoing) ?? 1) - 1)
    copies.set(incoming, (copies.get(incoming) ?? 0) + 1)
    out[at] = incoming
  }
  return out
}

/**
 * Randomizes the win condition. Doing this here rather than inside the hand
 * builder keeps the builder focused on tile shapes.
 *
 * One dora indicator is always flipped, as it is in a real hand. Whether it
 * points at anything the hand holds is left to chance — reading the indicator
 * and finding nothing is as much a part of counting as finding two.
 */
function randomContext(rng: Rng, menzen: boolean) {
  const seat = rng.pick(WINDS)
  return {
    seatWind: seat,
    roundWind: rng.pick(ROUND_WINDS),
    tsumo: rng.next() < 0.45,
    menzen,
    riichi: menzen && rng.next() < 0.4,
    doraIndicators: [rng.pick(ALL_FACES)],
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
            notation: t.notation([tile]),
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
                t.notation(correctIndices.map((i) => tiles[i])) ||
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

/**
 * True when a tenpai hand waits on one tile, in one named shape.
 *
 * Two kinds of ambiguity disqualify a hand from the wait drill, and both have to
 * be excluded for the question to have a single answer:
 *
 * - Several accepted tiles. `2345678m` is tenpai on 2m/5m/8m and more; there is
 *   no one wait to name.
 * - One accepted tile, several readings. The same 14 tiles can decompose as a
 *   run completed by a ryanmen or as a triplet completed by a shanpon, and the
 *   scorer picks whichever pays best — so the "right" shape would be an
 *   arbitrary choice between two true answers.
 */
function hasSingleWaitShape(tenpai: Tile[], hand: HandShape): boolean {
  const winning = waits(tenpai, hand.calls.length)
  if (winning.length !== 1) return false

  const complete: HandShape = {
    concealed: [...tenpai, winning[0]],
    calls: hand.calls,
    winTile: winning[0],
  }
  const shapes = new Set(
    decompose(complete).flatMap((d) => waitInterpretations(d, winning[0]).map((w) => w.type)),
  )
  return shapes.size === 1
}

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

      /**
       * Only hands whose wait is one plain shape.
       *
       * A shape like `2345678m` is tenpai on five different tiles and is read as
       * several overlapping ryanmen at once. Naming "the wait" on such a hand
       * has no single right answer, and the drill teaches the five named shapes
       * — ryanmen, kanchan, penchan, shanpon, tanki — so a hand that is not
       * cleanly one of them is not the question being asked.
       *
       * Checked against every decomposition, because a hand that reads as one
       * shape *or* another (a run plus a pair that could equally be a triplet
       * plus a partial run) is exactly as ambiguous as a multi-tile wait.
       */
      if (!hasSingleWaitShape(tenpai, built.hand)) continue

      /**
       * The answer keys on strict notation, which is language-neutral and
       * parses back to the same tiles in either language. What the option
       * *shows* is the tile itself plus the readable form, so the two never
       * have to agree on wording.
       */
      const answer = formatTiles(winning)
      const wrong = ALL_FACES.map((f) => formatTiles([f]))
      const asTiles = (notation: string) => parseTiles(notation)

      return {
        drillId: 'shapes.wait',
        kind: 'choice',
        prompt: t.t('drill.shapes.wait.prompt'),
        tiles: tenpai,
        calls: built.hand.calls,
        choices: choices(
          rng,
          answer,
          wrong,
          (s) => s,
          (s) => t.notation(parseTiles(s)),
          4,
          asTiles,
        ),
        explanation: (
          <div className="space-y-3 text-sm">
            <p>
              {t.t('drill.shapes.wait.explain', {
                notation: t.notation(winning),
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

    // Swap a couple of tiles out for random ones to back the hand away from
    // ready, respecting the four-copies-per-tile limit as the builder does.
    const swapped = replaceTiles(rng, built.hand.concealed, 1 + rng.int(2))

    /**
     * Shown as the 13 tiles a hand holds between draws, not 14.
     *
     * `buildScoringHand` returns a complete 14-tile hand because it builds
     * backwards from a win. Asking "how far from ready is this?" of 14 tiles
     * asks about a hand mid-turn, which is not the position the question means
     * and not the shape a player counts shanten on.
     */
    const tiles = sortTiles(swapped).slice(0, 13)
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
        // Labelled the way the reference page and the breakdown label a yaku:
        // the romaji a player actually says at the table, glossed with the
        // meaning. Learning "Tanyao" is the point; "All Simples" alone teaches
        // a name nobody uses.
        .map((id, i) => ({
          id: `y${i}`,
          label: `${t.romaji(id)} (${t.yaku(id)})`,
          correct: present.has(id),
        }))

      return {
        drillId: 'yaku.identify',
        kind: 'multi',
        prompt: t.t('drill.yaku.identify.prompt'),
        hint: t.t('drill.yaku.identify.hint'),
        tiles: built.hand.concealed,
        calls: built.hand.calls,
        winTile: built.hand.winTile,
        /**
         * No context lines here, unlike the counting drills.
         *
         * This drill grades only the shape-based yaku — riichi, ippatsu and the
         * rest are filtered out of both the answer and the distractors — so
         * seat wind, round wind and a riichi declaration decide nothing. Listing
         * them invites the player to weigh facts that cannot change the answer.
         * The one exception is open versus closed, which the called melds show
         * in the hand itself.
         */
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

    /**
     * Distractors are the neighbouring han counts, which is exactly where a
     * miscount lands: forget the dora and you are one low, double-count a yaku
     * and you are one high. Clamped at 1, since a scored hand always has at
     * least one han.
     */
    const rng = makeRng(seed)
    const near = [scored.han - 2, scored.han - 1, scored.han + 1, scored.han + 2].filter(
      (n) => n >= 1 && n !== scored.han,
    )

    return {
      drillId: 'han.count',
      kind: 'choice',
      prompt: t.t('drill.han.count.prompt'),
      hint: t.t('drill.han.count.hint'),
      tiles: built.hand.concealed,
      calls: built.hand.calls,
      winTile: built.hand.winTile,
      context: handContext(built, t),
      choices: choices(rng, scored.han, near, String, (n) => t.han(n)),
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

    /**
     * Fu comes in steps of ten, so the wrong answers are the adjacent steps —
     * the values you reach by missing one concealed triplet or one wait bonus.
     * 25 is included when it is not the answer, because mistaking a seven-pair
     * hand for an ordinary one is the classic fu error.
     */
    const rng = makeRng(seed)
    const total = scored.fu.total
    const near = [...new Set([total - 20, total - 10, total + 10, total + 20, 25])].filter(
      (n) => n >= 20 && n !== total,
    )

    return {
      drillId: 'fu.count',
      kind: 'choice',
      prompt: t.t('drill.fu.count.prompt'),
      hint: t.t('drill.fu.count.hint'),
      tiles: built.hand.concealed,
      calls: built.hand.calls,
      winTile: built.hand.winTile,
      context: handContext(built, t),
      choices: choices(rng, total, near, String, (n) => t.fu(n)),
      explanation: <Breakdown scored={scored} dealer={built.dealer} />,
      seed,
    }
  },
}

/**
 * The scoring drill: read a hand, then state what it pays.
 *
 * Typed rather than multiple-choice, and asked as *payments* rather than as a
 * total. Both follow from what the drill is for. Picking 8000 from four options
 * can be done by elimination without counting anything; typing it cannot. And a
 * tsumo is collected as separate payments — "2000/3900" is what you say at the
 * table, while its sum is a number nobody ever announces.
 *
 * Unlike the han and fu drills, this one does not hand over the han and fu in a
 * hint. Counting them is the work.
 */
const scoreCount: Generator = {
  id: 'score.total',
  titleKey: 'drill.score.total.title',
  descriptionKey: 'drill.score.total.desc',
  generate: (seed, t): Question => {
    const made = scoredQuestion(seed)
    if (!made) return tileRecognition.generate(seed, t)
    const { built, scored } = made

    return {
      drillId: 'score.total',
      kind: 'payment',
      prompt: t.t('drill.score.total.prompt'),
      hint: t.t(
        built.context.tsumo
          ? built.dealer
            ? 'drill.score.total.hintTsumoDealer'
            : 'drill.score.total.hintTsumoNonDealer'
          : 'drill.score.total.hintRon',
      ),
      tiles: built.hand.concealed,
      calls: built.hand.calls,
      winTile: built.hand.winTile,
      context: handContext(built, t),
      payment: paymentOf(scored.score, built.context.tsumo, built.dealer),
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

      /**
       * Perturb a complete hand into a realistic 14-tile decision.
       *
       * Capped at three copies rather than four: a quad is a kan decision, not
       * a discard one, and this drill is about which tile to throw from an
       * ordinary hand.
       */
      const perturbed = replaceTiles(rng, built.hand.concealed, 2 + rng.int(2), 3)
      if (perturbed.length !== 14) continue
      // The built hand may already have held a quad, which replacement cannot
      // undo.
      if (hasAtLeast(perturbed, 4)) continue

      /**
       * Sorted here rather than by `Hand`, because `correctIndices` below index
       * into this array and the quiz grades against those indices — a hand this
       * drill displays is always shown exactly as it is stored.
       *
       * Sorting also matters pedagogically. Perturbing a complete hand leaves
       * the untouched melds sitting in their original order with the random
       * tiles wedged between them, which pre-groups the hand into blocks and
       * hands the player the read for free. A plainly sorted hand is what you
       * actually face at the table: finding the blocks is the exercise.
       */
      const tiles = sortTiles(perturbed)

      // A hand that has already won poses no discard decision at all, so a
      // perturbation that happens to leave the hand complete is not a question.
      if (shanten(tiles, 0) < 0) continue

      const options = discardOptions(tiles)
      if (options.length < 3) continue

      const best = options[0]
      // A drill is only meaningful if one discard is clearly better than another.
      const worst = options[options.length - 1]
      if (best.shanten === worst.shanten && best.tilesLeft === worst.tilesLeft) continue

      /**
       * The best discard has to be strictly best, not merely first.
       *
       * `discardOptions` sorts by shanten then acceptance and breaks the
       * remaining tie on tile order, so `options[0]` is only *a* best discard.
       * Where several tiles leave exactly the same shanten and acceptance they
       * are all equally right, and marking whichever sorted first as the sole
       * answer fails a player who picked one of the others for the same reason.
       * Such a hand is discarded rather than graded.
       */
      const tiedForBest = options.filter(
        (o) => o.shanten === best.shanten && o.tilesLeft === best.tilesLeft,
      )
      if (tiedForBest.length > 1) continue

      /**
       * Every copy of the best tile, not just the first.
       *
       * A discard is a choice of *tile*, and a hand holding two 2m offers the
       * same discard twice — clicking the second copy was being marked wrong.
       * Comparison is on `face()` because a red five is a distinct `Tile` value
       * from its plain twin while being the same discard.
       */
      const correctIndices = tiles
        .map((tile, index) => (face(tile) === best.tile ? index : -1))
        .filter((i) => i >= 0)

      return {
        drillId: 'efficiency.discard',
        kind: 'tile-select',
        prompt: t.t('drill.efficiency.discard.prompt'),
        hint: t.t('drill.efficiency.discard.hint'),
        tiles,
        correctIndices,
        // One tile is discarded, so picking any single copy of it is right.
        selectOne: true,
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
                  notation: t.notation(best.faces),
                },
              )}
            </p>
            <div>
              <p className="mb-1.5 text-black/60 dark:text-white/60">
                {t.t('drill.efficiency.discard.ranked')}
              </p>
              <ul className="space-y-1">
                {options.slice(0, 6).map((option, i) => (
                  <li
                    key={option.tile}
                    // The best discard is the answer; the rest are context, so
                    // only the first row is set at full strength.
                    className={`anim-fade-up flex justify-between gap-4 rounded-lg px-2 py-1 font-mono text-sm ${
                      i === 0
                        ? 'bg-emerald-500/10 font-semibold text-emerald-800 dark:text-emerald-300'
                        : ''
                    }`}
                    style={stagger(i, 45)}
                  >
                    <span>{t.notation([option.tile])}</span>
                    <span className={i === 0 ? '' : 'text-black/55 dark:text-white/55'}>
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
