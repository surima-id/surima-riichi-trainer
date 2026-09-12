import { describe, expect, it } from 'vitest'
import { RECIPES, YAKUMAN_RECIPES, type Recipe, recipeYaku } from '../recipes'
import { buildScoringHand } from '../hands'
import { makeRng } from '../random'
import { scoreHandFull } from '../../engine/explain'
import { ROUND_WINDS, WINDS } from '../../engine/tiles'

/**
 * Recipes exist to make the counting drills cover the whole scoring table, and
 * a recipe that quietly stopped working would not fail anything — it would just
 * deal an ordinary hand, and the han distribution would sag back toward "1 or
 * 2" without a single red test. So each one is run here and asked to actually
 * produce what it claims.
 *
 * The bar is 50%, not 100%. A recipe constrains the tiles and leaves the rest
 * random, and some shapes genuinely slip: four concealed simple triplets is a
 * toitoi until the scorer notices it is also suuankou and scores the yakuman
 * instead, which is correct mahjong and a perfectly good question. Half is far
 * above what chance gives (most of these were under 1%) and low enough not to
 * fail on that kind of legitimate near miss.
 */
const SAMPLES = 200
const MIN_HIT_RATE = 0.5

const ALL: [string, Recipe][] = [
  ...Object.entries(RECIPES).flatMap(([band, list]) =>
    list.map((recipe) => [`${band}/${recipe.id}`, recipe] as [string, Recipe]),
  ),
  ...YAKUMAN_RECIPES.map((recipe) => [`yakuman/${recipe.id}`, recipe] as [string, Recipe]),
]

/** Builds from one recipe repeatedly, returning the hands that scored. */
function sample(recipe: Recipe) {
  const scored = []
  for (let seed = 1; seed <= SAMPLES; seed++) {
    const rng = makeRng(seed * 104729)
    const menzen = recipe.closedOnly ? true : rng.next() < 0.7
    const options = recipe.build(rng)
    const built = buildScoringHand(rng, {
      ...options,
      openMelds: menzen ? 0 : (options.openMelds ?? 1),
      context: {
        seatWind: rng.pick(WINDS),
        roundWind: rng.pick(ROUND_WINDS),
        tsumo: rng.next() < 0.45,
        menzen,
      },
    })
    if (!built) continue
    const result = scoreHandFull(built.hand, built.context, { dealer: built.dealer })
    if (result.valid) scored.push(result)
  }
  return scored
}

describe.each(ALL)('%s', (name, recipe) => {
  it('builds a scoring hand most of the time', () => {
    expect(sample(recipe).length, `${name} rarely built`).toBeGreaterThan(SAMPLES * 0.3)
  })

  it('produces the yaku it claims', () => {
    const scored = sample(recipe)
    const wanted = new Set(recipeYaku(recipe))
    const hits = scored.filter((result) => result.yaku.some((y) => wanted.has(y.id)))
    expect(
      hits.length / scored.length,
      `${name} claims ${[...wanted].join('/')} but produced it in ${hits.length}/${scored.length}`,
    ).toBeGreaterThanOrEqual(MIN_HIT_RATE)
  })
})

describe('yakuman recipes', () => {
  it('actually score as yakuman', () => {
    for (const recipe of YAKUMAN_RECIPES) {
      const scored = sample(recipe)
      const yakuman = scored.filter((result) => result.yakuman > 0)
      expect(
        yakuman.length / scored.length,
        `${recipe.id} produced a yakuman in only ${yakuman.length}/${scored.length}`,
      ).toBeGreaterThanOrEqual(MIN_HIT_RATE)
    }
  })
})
