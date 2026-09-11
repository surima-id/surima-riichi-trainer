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
import { discardOptions, shanten, waits } from '../engine/shanten'
import { paymentOf } from '../engine/score'
import {
  ALL_FACES,
  NUM_FACES,
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
    // Only meaningful under a riichi, and `randomContext` only deals one then,
    // so an empty array here is the ordinary case rather than a missing field.
    uraIndicators: context.uraIndicators,
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
        explanation: <Breakdown scored={scored} dealer={built.dealer} />,
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
       * The named tile must be the only one that completes the hand.
       *
       * A hand waiting on several tiles has several right answers, and only one
       * can be marked correct — so a multi-tile wait is not this question. The
       * wait drill is where those belong.
       */
      const winning = waits(tenpai, built.hand.calls.length)
      if (winning.length !== 1 || face(winning[0]) !== face(built.hand.winTile)) continue

      /**
       * The yaku named is the one worth the most han, which is the one a player
       * would actually be playing toward.
       */
      const target = [...shapeYaku].sort((a, b) => b.han - a.han)[0]
      const answer = face(built.hand.winTile)

      /**
       * Distractors are the neighbours of the real tile, then other tiles the
       * hand already holds — the tiles a player reaches for when they have read
       * the shape one position off, rather than arbitrary tiles that can be
       * eliminated on sight.
       *
       * `choices` shuffles whatever pool it is handed, so the pool itself is
       * trimmed to the three best candidates here; passing a longer list in
       * priority order would silently throw that order away. `ALL_FACES` only
       * backfills a hand too narrow to supply three of its own.
       */
      const near = [answer - 2, answer - 1, answer + 1, answer + 2].filter(
        (f) => f >= 0 && f < NUM_FACES && suitOf(f) === suitOf(answer),
      )
      const held = tenpai.map(face)
      const ranked = [...new Set([...near, ...held, ...ALL_FACES])].filter((f) => f !== answer)
      const wrong = ranked.slice(0, 3)

      return {
        drillId: 'yaku.complete',
        kind: 'choice',
        prompt: t.t('drill.yaku.complete.prompt', {
          yaku: `${t.romaji(target.id)} (${t.yaku(target.id)})`,
        }),
        hint: t.t('drill.yaku.complete.hint'),
        tiles: sortTiles(tenpai),
        calls: built.hand.calls,
        context: {
          seatWind: built.context.seatWind,
          roundWind: built.context.roundWind,
        },
        // An option that draws its tile needs no notation beside it, so the
        // label is left empty and the picture carries the option.
        choices: choices(rng, answer, wrong, String, () => '', 4, (f) => [f]),
        explanation: (
          <div className="space-y-3 text-sm">
            <p>
              {t.t('drill.yaku.complete.explain', {
                tile: t.tile(answer),
                yaku: `${t.romaji(target.id)} (${t.yaku(target.id)})`,
              })}
            </p>
            <Breakdown scored={scored} dealer={built.dealer} />
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
 * Shared setup for the three counting drills — they all pose a scored hand.
 *
 * `kanChance` is the probability that the hand is dealt a kan. Zero for most
 * drills; the fu drill raises it, because a kan is the one meld whose fu does
 * not follow from the triplet rules — see `kanChance` at its call site.
 */
function scoredQuestion(seed: number, kanChance = 0) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const inner = makeRng(seed + attempt * 15485863)
    const menzen = inner.next() < 0.7
    const kans = inner.next() < kanChance ? 1 : 0
    const built = buildScoringHand(inner, {
      // A kan occupies the first meld slot, and `openMelds` exposes that same
      // slot — so an open hand's single call *is* the kan when it has one,
      // making it a minkan, and a closed hand's kan is declared as an ankan.
      openMelds: menzen ? 0 : 1,
      kans,
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
     *
     * The window widens upward rather than stopping at ±2, because near the
     * bottom of the range half of it is clipped away — a 1 han hand has no 0 or
     * -1 to offer — and a question that fell back to three options was visibly
     * the easy one before it was read.
     */
    const rng = makeRng(seed)
    const near = [-2, -1, 1, 2, 3, 4]
      .map((offset) => scored.han + offset)
      .filter((n) => n >= 1 && n !== scored.han)

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
    const made = scoredQuestion(seed, 0.33)
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
    const total = scored.score.total

    /**
     * Distractors are the neighbouring rows of the payment table, not arbitrary
     * numbers. Doubling and halving are where a real miscount lands — one han
     * out in either direction — and 1.5x catches the dealer/non-dealer mix-up,
     * which is the other classic error. Rounded to 100, the granularity every
     * payment in the game uses, so no option is identifiable as the odd one out
     * by its shape alone.
     */
    const round100 = (n: number) => Math.max(100, Math.round(n / 100) * 100)
    const near = [total * 2, total / 2, total * 1.5, total * 4, total / 4]
      .map(round100)
      .filter((n) => n !== total)

    return {
      drillId: 'score.pick',
      kind: 'choice',
      prompt: t.t('drill.score.pick.prompt'),
      hint: t.t(
        built.context.tsumo ? 'drill.score.pick.hintTsumo' : 'drill.score.pick.hintRon',
      ),
      tiles: built.hand.concealed,
      calls: built.hand.calls,
      winTile: built.hand.winTile,
      context: handContext(built, t),
      choices: choices(rng, total, near, String, (n) => t.t('unit.points', { n })),
      explanation: <Breakdown scored={scored} dealer={built.dealer} />,
      seed,
    }
  },
}

/**
 * The scoring drill, harder half: read a hand, then state what it pays.
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
  yakuIdentification,
  yakuCompletion,
  hanCount,
  fuCount,
  scorePick,
  scoreCount,
  efficiencyDrill,
}

export const ALL_GENERATORS: Generator[] = Object.values(GENERATORS)
