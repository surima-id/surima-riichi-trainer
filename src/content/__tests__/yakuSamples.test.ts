import { describe, expect, it } from 'vitest'
import { YAKU_SAMPLES } from '../yakuSamples'
import { scoreHandFull } from '../../engine/explain'
import { parseTiles } from '../../engine/tiles'
import { YAKU_LIST, defaultContext, type YakuId } from '../../engine/yaku'

/**
 * The reference page shows one example hand per yaku. A hand-written example
 * can be subtly wrong in a way nobody notices by eye, so every sample is run
 * through the real detector here: if a sample does not actually produce the
 * yaku it is filed under, this fails.
 */
describe('yaku samples', () => {
  const ids = YAKU_LIST.map((y) => y.id)

  it('covers every yaku the engine knows', () => {
    expect(Object.keys(YAKU_SAMPLES).sort()).toEqual([...ids].sort())
  })

  it.each(ids.map((id) => [id] as const))('%s is demonstrated by its sample', (id: YakuId) => {
    const sample = YAKU_SAMPLES[id]
    const context = defaultContext({ ...sample.context })
    const scored = scoreHandFull(
      {
        concealed: parseTiles(sample.hand),
        calls: sample.calls ?? [],
        winTile: parseTiles(sample.win)[0],
      },
      context,
    )

    expect(scored.valid, `${id}: sample does not score at all`).toBe(true)
    expect(
      scored.yaku.map((y) => y.id),
      `${id}: sample scores as ${scored.yaku.map((y) => y.id).join(', ')}`,
    ).toContain(id)
  })
})
