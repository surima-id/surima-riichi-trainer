/**
 * The drill generators, one or more per module.
 *
 * Each builds a question backwards from the concept it teaches, then runs the
 * engine forward to produce the answer key and the explanation, so a generator
 * can never drift out of agreement with the scorer.
 */

import { Breakdown, YakuList } from '../components/Breakdown'
import { DiscardTable } from '../components/DiscardTable'
import { Hand } from '../components/Hand'
import { scoreHandFull } from '../engine/explain'
import { decompose, waitInterpretations } from '../engine/parse'
import { discardOptions, shanten, waits } from '../engine/shanten'
import { neighbourPayments, paymentOf } from '../engine/score'
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
import { buildScoringHand, buildThirteenOrphans } from './hands'
import { RECIPES, YAKUMAN_RECIPES } from './recipes'
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
  // Riichi is passed as a flag rather than as a label, so the strip can draw the
  // stick a declaration actually puts on the table.
  const flags: string[] = []
  if (context.ippatsu) flags.push(t.t('context.ippatsu'))

  return {
    doraIndicators: context.doraIndicators,
    // Only meaningful under a riichi, and `randomContext` only deals one then,
    // so an empty array here is the ordinary case rather than a missing field.
    uraIndicators: context.uraIndicators,
    seatWind: context.seatWind,
    roundWind: context.roundWind,
    tsumo: context.tsumo,
    riichi: context.riichi ?? false,
    doubleRiichi: context.doubleRiichi ?? false,
    flags,
  }
}

/** Counts copies of each face in a hand. */
function faceCounts(tiles: Tile[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const tile of tiles) counts.set(face(tile), (counts.get(face(tile)) ?? 0) + 1)
  return counts
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
 * The ceiling is three rather than the legal four, matching what
 * `buildRandomHand` deals: a fourth copy is the hardest shape a beginner meets
 * and drills leave it out. `maxCopies` can raise or lower that.
 */
function replaceTiles(rng: Rng, tiles: Tile[], count: number, maxCopies = 3): Tile[] {
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
 *
 * An ura indicator is flipped only alongside a riichi, which is when a real
 * table turns one over, and is the reason the ura slot exists at all: riichi
 * buys the bottom row. A hand that declared riichi and was then scored without
 * its ura was being scored short, so the ura is dealt here and stated in the
 * question rather than left for the breakdown to reveal after the fact.
 */
function randomContext(rng: Rng, menzen: boolean) {
  const seat = rng.pick(WINDS)
  const riichi = menzen && rng.next() < 0.4
  return {
    seatWind: seat,
    roundWind: rng.pick(ROUND_WINDS),
    tsumo: rng.next() < 0.45,
    menzen,
    riichi,
    doraIndicators: [rng.pick(ALL_FACES)],
    uraIndicators: riichi ? [rng.pick(ALL_FACES)] : [],
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
      // Labelled with the Japanese term beside the localized name, so the drill
      // teaches the word a player will hear at a table as well as what it means.
      choices: choices(rng, tile, ALL_FACES, String, t.tileWithTerm),
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

/**
 * Pick out one tile class from a mixed row.
 *
 * Asked both ways round — select the terminals and honors, or select the
 * simples — because the two are not the same exercise. "Select the terminals"
 * can be answered by spotting 1s, 9s and honors one at a time, while "select
 * the simples" is only answerable by knowing what the class *excludes*, which
 * is the reading tanyao actually requires. Alternating on the seed means a
 * player cannot settle into scanning for one shape.
 */
const terminalPicker: Generator = {
  id: 'tiles.terminals',
  titleKey: 'drill.tiles.terminals.title',
  descriptionKey: 'drill.tiles.terminals.desc',
  generate: (seed, t) => {
    const rng = makeRng(seed)
    const wantSimples = rng.next() < 0.5

    // Draw at least two of each class, so the question is never trivially
    // "all of them" or "none of them" whichever way round it is asked.
    const terminals = rng.shuffle(ALL_FACES.filter(isTerminalOrHonor)).slice(0, 2 + rng.int(3))
    const simples = rng.shuffle(ALL_FACES.filter((f) => !isTerminalOrHonor(f))).slice(0, 8 - terminals.length)
    const tiles = rng.shuffle([...terminals, ...simples])
    const wanted = (tile: Tile) => (wantSimples ? !isTerminalOrHonor(tile) : isTerminalOrHonor(tile))
    const correctIndices = tiles
      .map((tile, index) => (wanted(tile) ? index : -1))
      .filter((i) => i >= 0)

    return {
      drillId: 'tiles.terminals',
      kind: 'tile-select',
      prompt: t.t(wantSimples ? 'drill.tiles.simples.prompt' : 'drill.tiles.terminals.prompt'),
      hint: t.t(wantSimples ? 'drill.tiles.simples.hint' : 'drill.tiles.terminals.hint'),
      tiles,
      correctIndices,
      explanation: (
        <div className="space-y-2 text-sm">
          <p>
            {t.t(wantSimples ? 'drill.tiles.simples.explain' : 'drill.tiles.terminals.explain', {
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
 * Distractor wait sets, the same size as the real one.
 *
 * A wrong answer has to be wrong in the way a misread is wrong. Options built
 * from the neighbours of the real waits are what a player lands on by reading
 * a run from the wrong end or counting a shape one tile over; options of the
 * same size as the answer are what stops the count of tiles from giving the
 * answer away without reading the hand at all.
 */
function waitDistractors(winning: Tile[]): Tile[][] {
  const size = winning.length
  const real = new Set(winning)
  const near = new Set<number>()
  for (const tile of winning) {
    for (const offset of [-2, -1, 1, 2]) {
      const candidate = tile + offset
      // Suited neighbours only: a run never straddles a suit, and shifting an
      // honor by one lands on an unrelated wind or dragon.
      if (candidate < 0 || candidate >= 34) continue
      if (suitOf(candidate) !== suitOf(tile)) continue
      if (!real.has(candidate)) near.add(candidate)
    }
  }

  const pool = [...near, ...ALL_FACES.filter((f) => !real.has(f) && !near.has(f))]
  const out: Tile[][] = []
  for (let start = 0; start + size <= pool.length; start++) {
    const candidate = pool.slice(start, start + size)
    out.push(sortTiles(candidate))
  }
  return out
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
      const winning = sortTiles(waits(tenpai, built.hand.calls.length))
      if (winning.length === 0) continue

      /**
       * Multi-tile waits are kept, and are the point of the drill.
       *
       * A shape like `2345678m` accepts 2m/5m/8m, and a hand that accepts three
       * tiles is worth far more than one that accepts one — seeing that is the
       * skill. The answer is therefore the whole accepted set rather than a
       * single tile, and a player who names only part of it is wrong in the way
       * that matters at the table.
       *
       * Capped at three so the options stay readable as tiles; wider waits are
       * left to the efficiency drill, which measures acceptance as a count.
       */
      if (winning.length > 3) continue

      /**
       * The answer keys on strict notation, which is language-neutral and
       * parses back to the same tiles in either language. What the option
       * *shows* is the tiles themselves, so the two never have to agree on
       * wording.
       */
      const answer = formatTiles(winning)
      const wrong = waitDistractors(winning).map(formatTiles)
      const asTiles = (notation: string) => parseTiles(notation)

      return {
        drillId: 'shapes.wait',
        kind: 'choice',
        prompt: t.t(
          winning.length === 1 ? 'drill.shapes.wait.promptOne' : 'drill.shapes.wait.promptMany',
        ),
        tiles: tenpai,
        calls: built.hand.calls,
        choices: choices(
          rng,
          answer,
          wrong,
          (s) => s,
          () => '',
          4,
          asTiles,
        ),
        explanation: (
          <div className="space-y-3 text-sm">
            <p>
              {t.t(
                winning.length === 1
                  ? 'drill.shapes.wait.explain'
                  : 'drill.shapes.wait.explainMany',
                {
                  notation: t.notation(winning),
                  names: winning.map(t.tile).join(', '),
                },
              )}
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

/** Options per question, matching the four every other drill offers. */
const YAKU_OPTIONS = 4

/**
 * The win conditions a yaku question poses: none of them.
 *
 * Riichi, self-draw and dora are all real parts of a hand's value, but none of
 * them is read off the tiles — they are announced, or flipped in the dead wall.
 * This drill asks what *pattern the tiles make*, so posing them only adds facts
 * that cannot change the answer and then shows them again in the breakdown, as
 * if they were part of what the player was meant to spot. The winds stay,
 * because a wind triplet genuinely is or is not yakuhai depending on them.
 */
function yakuContext(rng: Rng, menzen: boolean) {
  return {
    seatWind: rng.pick(WINDS),
    roundWind: rng.pick(ROUND_WINDS),
    tsumo: false,
    menzen,
    riichi: false,
    doraIndicators: [],
    uraIndicators: [],
  }
}

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
        context: yakuContext(inner, menzen),
      })
      if (!built) continue

      const scored = scoreHandFull(built.hand, built.context, { dealer: built.dealer })
      if (!scored.valid) continue

      const shapeYaku = scored.yaku.filter((y) => !SITUATIONAL.has(y.id))
      if (shapeYaku.length === 0) continue

      /**
       * Four options, like every other drill.
       *
       * Every yaku the hand actually has must be offered, or the answer key
       * would be unreachable — so a hand carrying more than four scoring
       * patterns cannot be asked in four options and is skipped rather than
       * asked with part of its answer missing. In practice this is rare: most
       * hands score one or two shape yaku.
       */
      if (shapeYaku.length > YAKU_OPTIONS) continue

      const present = new Set<YakuId>(shapeYaku.map((y) => y.id))
      const absent = DISTRACTOR_POOL.filter((id) => !present.has(id))

      // Options are yaku ids until the very last step, so grading is by id and
      // only the label is translated.
      const options: Choice[] = rng
        .shuffle([
          ...shapeYaku.map((y) => y.id),
          ...rng.shuffle(absent).slice(0, YAKU_OPTIONS - shapeYaku.length),
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
         * The winds, and nothing else.
         *
         * A wind triplet is yakuhai only when it matches the player's seat or
         * the round, so both winds are part of the answer key — a hand with a
         * South triplet scores or does not score depending on facts the tiles
         * cannot show. The rest of the counting drills' strip is omitted: this
         * drill filters riichi, ippatsu and the other situational yaku out of
         * both the answer and the distractors, so a riichi declaration or the
         * win condition decides nothing here and would only invite the player
         * to weigh facts that cannot change the answer. Open versus closed does
         * matter, and the called melds show it in the hand itself.
         */
        context: {
          seatWind: built.context.seatWind,
          roundWind: built.context.roundWind,
        },
        choices: options,
        /**
         * The yaku the hand has, and nothing else.
         *
         * The full `Breakdown` follows the yaku with the fu tally, the payment
         * table row and the totals, which is the right answer to a scoring
         * question and far too much for this one: a player who has just been
         * asked to spot a pattern gets three sections of arithmetic they were
         * never asked about. Those are what the han, fu and score drills teach,
         * each in its own module.
         */
        explanation: <YakuList scored={scored} />,
        seed,
      } satisfies Question
    }

    return tileRecognition.generate(seed, t)
  },
}

/**
 * The other half of the yaku module: given a yaku, find the tile that makes it.
 *
 * Identifying a yaku in a finished hand is recognition; this is the same
 * knowledge running forwards, which is how it is used at the table — you are
 * one tile short of tanyao and have to know which draw gets you there. The
 * question poses a ready hand and names the yaku, and the answer is the tile
 * that completes it.
 *
 * Built by taking a scored hand apart: remove the winning tile and the hand is
 * tenpai on it, so the answer key is the tile the scorer already agreed pays.
 */
const yakuCompletion: Generator = {
  id: 'yaku.complete',
  titleKey: 'drill.yaku.complete.title',
  descriptionKey: 'drill.yaku.complete.desc',
  generate: (seed, t): Question => {
    const rng = makeRng(seed)

    for (let attempt = 0; attempt < 60; attempt++) {
      const inner = makeRng(seed + attempt * 6151)
      const menzen = inner.next() < 0.65
      const built = buildScoringHand(inner, {
        openMelds: menzen ? 0 : 1,
        context: yakuContext(inner, menzen),
      })
      if (!built) continue

      const scored = scoreHandFull(built.hand, built.context, { dealer: built.dealer })
      if (!scored.valid) continue

      const shapeYaku = scored.yaku.filter((y) => !SITUATIONAL.has(y.id))
      if (shapeYaku.length === 0) continue

      // The hand as held before the win: the winning tile taken back out.
      const index = built.hand.concealed.indexOf(built.hand.winTile)
      if (index < 0) continue
      const tenpai = [
        ...built.hand.concealed.slice(0, index),
        ...built.hand.concealed.slice(index + 1),
      ]

      /**
       * The answer is every tile the hand accepts, not one of them.
       *
       * The five named waits are not all one tile wide: a ryanmen accepts two
       * tiles and so does a shanpon, and a player who names only half of a
       * two-sided wait has misread the shape. So the whole accepted set is the
       * answer, and an option may carry two tiles.
       */
      const winning = sortTiles(waits(tenpai, built.hand.calls.length))
      /**
       * At most two accepted tiles, because that is what the five named shapes
       * accept: two for a ryanmen and a shanpon, one for a kanchan, penchan or
       * tanki. A hand accepting three or more is several overlapping shapes at
       * once — `2345678m` is three ryanmen read together — which is a wider
       * reading than this drill asks for, and belongs to the wait drill.
       */
      if (winning.length === 0 || winning.length > 2) continue

      /**
       * One named shape, and one of the five.
       *
       * `waitInterpretations` reads a completed hand back into the shape that
       * completed it. A hand that reads as a ryanmen *or* as a shanpon depending
       * on how its tiles are grouped has no single shape to be waiting in, and
       * the drill would be asking about a reading rather than about the hand —
       * so anything ambiguous is skipped. Every shape the engine names is
       * already one of the five, which is what the drill means to cover.
       */
      const shapes = new Set(
        winning.flatMap((tile) =>
          decompose({ concealed: [...tenpai, tile], calls: built.hand.calls, winTile: tile })
            .flatMap((d) => waitInterpretations(d, tile))
            .map((w) => w.type),
        ),
      )
      if (shapes.size !== 1) continue
      const shape = [...shapes][0]

      /**
       * The yaku named is the one worth the most han, which is the one a player
       * would actually be playing toward.
       */
      const target = [...shapeYaku].sort((a, b) => b.han - a.han)[0]

      /**
       * Every accepted tile must produce the named yaku.
       *
       * A two-sided wait can complete a hand two ways, and only one of them may
       * carry the pattern the question names — a ryanmen where one end makes
       * the hand all simples and the other lands a terminal in it. Asking
       * "which tile completes tanyao" of such a hand has a narrower answer than
       * the wait, so it is not this question.
       */
      const completesTarget = winning.every((tile) => {
        const full = { concealed: [...tenpai, tile], calls: built.hand.calls, winTile: tile }
        const check = scoreHandFull(full, built.context, { dealer: built.dealer })
        return check.valid && check.yaku.some((y) => y.id === target.id)
      })
      if (!completesTarget) continue

      /**
       * The answer keys on strict notation, which is language-neutral and
       * parses back to the same tiles either way. Distractors are wait-shaped
       * sets of the same size, built from the neighbours of the real tiles, so
       * neither the option count nor the tile count gives the answer away.
       */
      const answer = formatTiles(winning)
      const wrong = waitDistractors(winning).map(formatTiles)

      return {
        drillId: 'yaku.complete',
        kind: 'choice',
        prompt: t.t(
          winning.length === 1
            ? 'drill.yaku.complete.promptOne'
            : 'drill.yaku.complete.promptMany',
          { yaku: `${t.romaji(target.id)} (${t.yaku(target.id)})` },
        ),
        hint: t.t('drill.yaku.complete.hint'),
        tiles: sortTiles(tenpai),
        calls: built.hand.calls,
        context: {
          seatWind: built.context.seatWind,
          roundWind: built.context.roundWind,
        },
        // An option that draws its tiles needs no notation beside them, so the
        // label is left empty and the picture carries the option.
        choices: choices(rng, answer, wrong, (v) => v, () => '', 4, parseTiles),
        explanation: (
          <div className="space-y-3 text-sm">
            <p>
              {t.t('drill.yaku.complete.explain', {
                tiles: t.notation(winning),
                shape: t.wait(shape, 'long'),
                yaku: `${t.romaji(target.id)} (${t.yaku(target.id)})`,
              })}
            </p>
            <YakuList scored={scored} />
          </div>
        ),
        seed,
      } satisfies Question
    }

    return yakuIdentification.generate(seed, t)
  },
}

// ---------------------------------------------------------------- Han / Fu / Score

/**
 * How often a counting drill poses a hand from each value band.
 *
 * Left to the plain builder the answer was 1 or 2 han nearly three quarters of
 * the time, and a hand worth a mangan or more turned up once in eight — so the
 * upper half of the scoring table, which is most of what the han and score
 * chapters teach, was barely ever practised. These weights spread the questions
 * across the range instead: a learner still meets the cheap hands most often,
 * because those are most of real mahjong, but a haneman is no longer a rarity
 * and a yakuman is something they will actually see.
 *
 * The bands are the recipe groups plus two extremes: `plain` is the old
 * unconstrained builder, kept because a hand that is *only* riichi and a dora
 * is a real hand and a fair question, and `yakuman` is built from named tiles.
 */
const BANDS = [
  { kind: 'plain', weight: 24 },
  { kind: 'small', weight: 26 },
  { kind: 'medium', weight: 30 },
  { kind: 'large', weight: 17 },
  { kind: 'yakuman', weight: 1 },
] as const

type BandKind = (typeof BANDS)[number]['kind']

function pickBand(rng: Rng, allowYakuman: boolean): BandKind {
  const pool = BANDS.filter((b) => allowYakuman || b.kind !== 'yakuman')
  const total = pool.reduce((sum, b) => sum + b.weight, 0)
  let roll = rng.next() * total
  for (const band of pool) {
    roll -= band.weight
    if (roll <= 0) return band.kind
  }
  return pool[pool.length - 1].kind
}

interface ScoredOptions {
  /**
   * The chance the hand is dealt a kan. Zero for most drills; the fu drill
   * raises it, because a kan is the one meld whose fu does not follow from the
   * triplet rules — see the call site.
   */
  kanChance?: number
  /**
   * Whether a yakuman may be posed.
   *
   * Off for the fu drill, and only there: a yakuman is a flat payment that
   * skips the fu table entirely, so "how many fu" has no answer worth asking.
   * Han and score both handle one — the han drill asks for the multiple rather
   * than a count, and a score drill that never showed 32000 would leave the
   * biggest number on the table unpractised.
   */
  yakuman?: boolean
}

/**
 * Shared setup for the counting drills — they all pose a scored hand.
 *
 * The band is chosen first and the hand is built to suit it, rather than a
 * random hand being built and its value accepted afterwards.
 *
 * It is drawn once, from the seed, and every attempt then retries within it.
 * Re-rolling per attempt was the obvious way and it quietly bent the weights:
 * the bands do not fail equally often — a yakuman recipe names its tiles
 * outright and practically always builds, where a junchan has to find four
 * terminal melds that fit — so a band's share of the *questions* drifted toward
 * how reliably it built rather than what it was weighted. Yakuman came out at
 * triple its weight. Drawing once decouples the two.
 *
 * The last quarter of the attempts drop the recipe and build a plain hand, so a
 * band that genuinely cannot be satisfied under this seed still yields a
 * question rather than falling through to the tile-naming drill.
 */
function scoredQuestion(seed: number, options: ScoredOptions = {}) {
  const { kanChance = 0, yakuman = true } = options
  const ATTEMPTS = 80
  const band = pickBand(makeRng(seed * 2654435761), yakuman)

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const inner = makeRng(seed + attempt * 15485863)
    const giveUp = attempt >= ATTEMPTS * 0.75

    // Thirteen orphans is not four melds and a pair, so it bypasses the builder.
    if (band === 'yakuman' && !giveUp && inner.next() < 0.15) {
      const built = buildThirteenOrphans(inner, randomContext(inner, true))
      const scored = scoreHandFull(built.hand, built.context, { dealer: built.dealer })
      if (scored.valid) return { built, scored }
      continue
    }

    const recipe =
      band === 'plain' || giveUp
        ? null
        : band === 'yakuman'
          ? inner.pick(YAKUMAN_RECIPES)
          : inner.pick(RECIPES[band])

    // A recipe whose yaku does not survive being opened keeps the hand closed.
    const menzen = recipe?.closedOnly ? true : inner.next() < 0.7
    const kans = inner.next() < kanChance ? 1 : 0
    const recipeOptions = recipe?.build(inner) ?? {}

    const built = buildScoringHand(inner, {
      ...recipeOptions,
      // A kan occupies a meld slot, and `openMelds` exposes the first slots —
      // so an open hand's single call *is* the kan when it has one, making it a
      // minkan, and a closed hand's kan is declared as an ankan.
      openMelds: menzen ? 0 : (recipeOptions.openMelds ?? 1),
      kans,
      // Red fives are the everyday dora a player counts without an indicator,
      // and the builder never dealt one before.
      redFives: inner.next() < 0.25 ? 1 : 0,
      context: randomContext(inner, menzen),
    })
    if (!built) continue
    const scored = scoreHandFull(built.hand, built.context, { dealer: built.dealer })
    if (!scored.valid) continue
    if (!yakuman && scored.yakuman > 0) continue
    return { built, scored }
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

    const rng = makeRng(seed)

    /**
     * A yakuman is recognized, not added up.
     *
     * Its han field is zero — the tier replaces han and fu outright — so the
     * plain "how many han" prompt would key the answer to a number the hand does
     * not have. What it is worth is asked instead.
     *
     * The prompt must not say the hand *is* a yakuman. An earlier version did,
     * and it gave the answer away twice over: it eliminated the "13 han" option
     * before the tiles were looked at, and since 82% of these hands are a single
     * yakuman, picking the plain "Yakuman" won four times in five without any
     * reading at all. Recognizing that a hand has crossed into yakuman territory
     * is most of the skill being drilled, so the question cannot be allowed to
     * concede it in its own first sentence.
     *
     * So the same neutral prompt is used as for every other hand, and the
     * options mix han counts with yakuman multiples. A player has to decide
     * which kind of answer this hand even takes, which is the real question.
     */
    if (scored.yakuman > 0) {
      const answer = `yakuman:${scored.yakuman}`
      const near = [
        ...[1, 2, 3].filter((n) => n !== scored.yakuman).map((n) => `yakuman:${n}`),
        // The counts a player who tried to total the hand up would reach. 13 is
        // the kazoe boundary and the most tempting of them: a counted yakuman is
        // reached by adding han, and this hand was not.
        'han:13',
        'han:11',
        'han:6',
      ]
      const renderValue = (value: string) => {
        const n = Number(value.slice(value.indexOf(':') + 1))
        if (value.startsWith('han:')) return t.han(n)
        return n > 1 ? t.t('unit.yakumanMultiple', { n }) : t.t('unit.yakuman')
      }
      return {
        drillId: 'han.count',
        kind: 'choice',
        // Deliberately the ordinary prompt: see above.
        prompt: t.t('drill.han.count.prompt'),
        hint: t.t('drill.han.count.hint'),
        tiles: built.hand.concealed,
        calls: built.hand.calls,
        winTile: built.hand.winTile,
        context: handContext(built, t),
        choices: choices(rng, answer, near, (v) => v, renderValue),
        explanation: <Breakdown scored={scored} dealer={built.dealer} />,
        seed,
      }
    }

    /**
     * Distractors are the neighbouring han counts, which is exactly where a
     * miscount lands: forget the dora and you are one low, double-count a yaku
     * and you are one high. Clamped at 1, since a scored hand always has at
     * least one han.
     *
     * The window widens upward rather than stopping at ±2, because near the
     * bottom of the range half of it is clipped away — a 1 han hand has no 0 or
     * -1 to offer — and a question that fell back to three options was visibly
     * the easy one before it was read.
     */
    const near = [-2, -1, 1, 2, 3, 4]
      .map((offset) => scored.han + offset)
      .filter((n) => n >= 1 && n !== scored.han)
      .map((n) => `han:${n}`)

    /**
     * A big hand is sometimes offered a yakuman option it did not earn.
     *
     * Otherwise the option list itself answers the question. Yakuman hands are
     * the only ones whose choices contain the word, so a player never has to
     * judge whether *this* hand crossed the line — they just look for the
     * distinctive option and take it. Measured, that tell was perfect: a
     * yakuman option appeared on 100% of yakuman hands and 0% of the rest.
     *
     * It is offered only from 5 han up, where mistaking a big hand for a
     * yakuman is a mistake a learner actually makes. Dangling it beside a 2 han
     * hand would be a different giveaway — the one option that is obviously
     * not it.
     */
    const wantsDecoy = scored.han >= 5 && rng.next() < 0.55

    const renderValue = (value: string) => {
      const n = Number(value.slice(value.indexOf(':') + 1))
      if (value.startsWith('han:')) return t.han(n)
      return n > 1 ? t.t('unit.yakumanMultiple', { n }) : t.t('unit.yakuman')
    }

    /**
     * The decoy takes a slot, rather than joining the pool.
     *
     * `choices` fills three slots from the candidates it is given, so a decoy
     * listed alongside six han counts is mostly shuffled straight back out —
     * it survived 15% of the time, which left the tell nearly as strong as
     * before. Handing it a shortened pool reserves its place.
     */
    const pool = wantsDecoy ? ['yakuman:1', ...near.slice(0, 2)] : near

    return {
      drillId: 'han.count',
      kind: 'choice',
      prompt: t.t('drill.han.count.prompt'),
      hint: t.t('drill.han.count.hint'),
      tiles: built.hand.concealed,
      calls: built.hand.calls,
      winTile: built.hand.winTile,
      context: handContext(built, t),
      choices: choices(rng, `han:${scored.han}`, pool, (v) => v, renderValue),
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
    /**
     * A third of fu hands carry a kan.
     *
     * A kan is the one meld whose fu a player cannot derive from the triplet
     * rules: it quadruples instead of doubling, so a concealed kan of terminals
     * is 32 fu where the triplet is 8 — enough on its own to move a hand two
     * rows up the payment table. Left to chance the builder deals one almost
     * never, so the drill asks for them, and both kinds appear: a closed hand's
     * kan is declared from the hand (ankan), an open hand's is called off a
     * discard (minkan), and the two differ by a factor of two in fu.
     */
    const made = scoredQuestion(seed, { kanChance: 0.33, yakuman: false })
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
 * The scoring drill, easier half: read a hand, then pick what it is worth.
 *
 * Asked as the single total the hand collects, chosen from four options. This
 * is the first scoring question a learner can actually answer: the four values
 * bracket the answer, so a player who has counted han and fu roughly right can
 * recognize which row of the table they landed on even if they could not
 * produce the number cold.
 *
 * `scoreTyped` below is the same reading without the scaffolding. The two are
 * separate drills rather than one that varies, so a learner can stay on this
 * one until the table is familiar and then move on deliberately.
 */
const scorePick: Generator = {
  id: 'score.pick',
  titleKey: 'drill.score.pick.title',
  descriptionKey: 'drill.score.pick.desc',
  generate: (seed, t): Question => {
    const made = scoredQuestion(seed)
    if (!made) return tileRecognition.generate(seed, t)
    const { built, scored } = made
    const rng = makeRng(seed)

    /**
     * The answer is the payment, in the shape the payment is actually made.
     *
     * A self-draw is not collected as one number: the three opponents each pay,
     * and a non-dealer's win takes more from the dealer than from the other two
     * — "2000/3900" is the figure a player says and the figure they have to
     * know. Offering the total instead would teach a number that never changes
     * hands, so the options here are `Payment` values rendered the way the
     * typed drill expects them written.
     */
    const answer = paymentOf(scored.score, built.context.tsumo, built.dealer)

    /**
     * Distractors are the neighbouring rows of the real payment table.
     *
     * They used to be the answer scaled by a factor, which produced figures no
     * hand has ever paid: a quarter of 1300 rounds to "300/400", and the small
     * tsumo rows bottomed out at "100/100". A player did not have to read the
     * hand to rule those out — they are not on the table at all — so the
     * question graded recognition of nonsense rather than scoring.
     *
     * The eight nearest rows are offered to `choices`, which picks three. Near
     * rather than random: a han miscounted or a fu step missed lands a player
     * one or two rows off, so these are exactly the answers a hand read almost
     * right produces, and telling them apart means having read it exactly.
     */
    const near = neighbourPayments(answer, built.dealer, built.context.tsumo).slice(0, 8)

    return {
      drillId: 'score.pick',
      kind: 'choice',
      prompt: t.t('drill.score.pick.prompt'),
      hint: t.t(
        built.context.tsumo
          ? built.dealer
            ? 'drill.score.pick.hintTsumoDealer'
            : 'drill.score.pick.hintTsumoNonDealer'
          : 'drill.score.pick.hintRon',
      ),
      tiles: built.hand.concealed,
      calls: built.hand.calls,
      winTile: built.hand.winTile,
      context: handContext(built, t),
      // Keyed on the rendered figure, which is what makes two options the same
      // option: a distractor that scaled onto the real payment is a duplicate.
      choices: choices(rng, answer, near, t.payment, t.payment),
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

      // Perturb a complete hand into a realistic 14-tile decision. The builder
      // and the swap both cap a face at three copies, so no quad can appear:
      // that is a kan decision, not a discard one.
      const perturbed = replaceTiles(rng, built.hand.concealed, 2 + rng.int(2))
      if (perturbed.length !== 14) continue

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
            <DiscardTable options={options} />
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
  yakuIdentification,
  yakuCompletion,
  hanCount,
  fuCount,
  scorePick,
  scoreCount,
  efficiencyDrill,
}

export const ALL_GENERATORS: Generator[] = Object.values(GENERATORS)
