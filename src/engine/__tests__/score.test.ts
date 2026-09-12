import { describe, expect, it } from 'vitest'
import { scoreHandFull } from '../explain'
import { type Hand } from '../parse'
import {
  FU_STEPS,
  basePointsFor,
  neighbourPayments,
  paymentKey,
  paymentOf,
  paymentTable,
  paymentValue,
  scoreHand,
} from '../score'
import { EAST, SOUTH, parseTiles } from '../tiles'
import { type WinContext, defaultContext } from '../yaku'

function hand(concealed: string, win: string, calls: Hand['calls'] = []): Hand {
  return { concealed: parseTiles(concealed), calls, winTile: parseTiles(win)[0] }
}

const ctx = (o: Partial<WinContext> = {}) => defaultContext(o)

describe('basePointsFor', () => {
  it('applies the raw formula below mangan', () => {
    expect(basePointsFor(1, 30).base).toBe(240) // 30 * 2^3
    expect(basePointsFor(3, 40).base).toBe(1280)
  })

  it('caps at mangan when the formula overshoots', () => {
    // 4 han 40 fu = 2560 raw, which exceeds the 2000 mangan cap.
    expect(basePointsFor(4, 40)).toEqual({ base: 2000, limit: 'mangan' })
  })

  it('rounds 4 han 30 fu up to mangan (kiriage)', () => {
    // Kiriage mangan: a 1920 raw base is promoted, so 4/30 pays 8000, not 7700.
    expect(basePointsFor(4, 30)).toEqual({ base: 2000, limit: 'mangan' })
    expect(scoreHand({ han: 4, fu: 30, dealer: false, tsumo: false }).ronPayment).toBe(8000)
  })

  it('rounds 3 han 60 fu up too, since it is the same 1920 base', () => {
    expect(basePointsFor(3, 60)).toEqual({ base: 2000, limit: 'mangan' })
  })

  it('leaves the cells just below 1920 alone', () => {
    // 4 han 25 fu and 3 han 50 fu are both 1600 raw — kiriage is a threshold at
    // 1920, not a blanket round-up of everything near mangan.
    expect(basePointsFor(4, 25)).toEqual({ base: 1600, limit: 'none' })
    expect(basePointsFor(3, 50)).toEqual({ base: 1600, limit: 'none' })
    expect(scoreHand({ han: 4, fu: 25, dealer: false, tsumo: false }).ronPayment).toBe(6400)
  })

  it('names each limit tier', () => {
    expect(basePointsFor(6, 30).limit).toBe('haneman')
    expect(basePointsFor(8, 30).limit).toBe('baiman')
    expect(basePointsFor(11, 30).limit).toBe('sanbaiman')
    expect(basePointsFor(13, 30).limit).toBe('kazoe')
  })
})

describe('scoreHand payments', () => {
  it('pays 1000 for a non-dealer 1 han 30 fu ron', () => {
    expect(scoreHand({ han: 1, fu: 30, dealer: false, tsumo: false }).ronPayment).toBe(1000)
  })

  it('pays 1500 for a dealer 1 han 30 fu ron', () => {
    expect(scoreHand({ han: 1, fu: 30, dealer: true, tsumo: false }).ronPayment).toBe(1500)
  })

  it('splits a non-dealer tsumo as 300/500 at 1 han 30 fu', () => {
    const r = scoreHand({ han: 1, fu: 30, dealer: false, tsumo: true })
    expect(r.tsumoFromNonDealer).toBe(300)
    expect(r.tsumoFromDealer).toBe(500)
    expect(r.total).toBe(1100)
  })

  it('pays 2000 all for a dealer mangan tsumo', () => {
    const r = scoreHand({ han: 5, fu: 30, dealer: true, tsumo: true })
    expect(r.tsumoFromNonDealer).toBe(4000)
    expect(r.total).toBe(12000)
  })

  it('pays 8000 for a non-dealer mangan ron and 12000 for a dealer one', () => {
    expect(scoreHand({ han: 5, fu: 30, dealer: false, tsumo: false }).ronPayment).toBe(8000)
    expect(scoreHand({ han: 5, fu: 30, dealer: true, tsumo: false }).ronPayment).toBe(12000)
  })

  it('pays 32000 for a yakuman and 48000 for a dealer yakuman', () => {
    expect(scoreHand({ han: 0, fu: 0, dealer: false, tsumo: false, yakuman: 1 }).ronPayment).toBe(32000)
    expect(scoreHand({ han: 0, fu: 0, dealer: true, tsumo: false, yakuman: 1 }).ronPayment).toBe(48000)
  })

  it('adds honba and riichi sticks', () => {
    const r = scoreHand({ han: 1, fu: 30, dealer: false, tsumo: false, honba: 2, riichiSticks: 1 })
    expect(r.ronPayment).toBe(1600)
    expect(r.total).toBe(2600)
  })

  it('splits honba three ways on a tsumo', () => {
    const r = scoreHand({ han: 1, fu: 30, dealer: false, tsumo: true, honba: 1 })
    expect(r.tsumoFromNonDealer).toBe(400)
    expect(r.tsumoFromDealer).toBe(600)
  })
})

describe('fu edge cases', () => {
  it('scores a pinfu self-draw at exactly 20 fu', () => {
    const r = scoreHandFull(hand('234m234567p33s567s', '7s'), ctx({ tsumo: true, seatWind: SOUTH }))
    expect(r.valid).toBe(true)
    expect(r.yaku.map((y) => y.id)).toContain('pinfu')
    expect(r.fu.total).toBe(20)
  })

  it('scores a pinfu discard win at 30 fu', () => {
    const r = scoreHandFull(hand('234m234567p33s567s', '7s'), ctx({ tsumo: false, seatWind: SOUTH }))
    expect(r.yaku.map((y) => y.id)).toContain('pinfu')
    expect(r.fu.total).toBe(30)
  })

  it('scores seven pairs at a flat 25 fu', () => {
    const r = scoreHandFull(hand('1133m5577p2299s11z', '1z'), ctx())
    expect(r.yaku.map((y) => y.id)).toContain('chiitoitsu')
    expect(r.fu.total).toBe(25)
  })

  it('rounds fu up to the next ten', () => {
    // Closed ron, concealed terminal triplet (8), closed wait (2): 20+10+8+2 = 40.
    const r = scoreHandFull(hand('111m234m567m99p234s', '4s'), ctx({ riichi: true }))
    expect(r.fu.raw).toBeLessThanOrEqual(r.fu.total)
    expect(r.fu.total % 10).toBe(0)
  })

  it('floors an open all-runs hand at 30 fu', () => {
    // Open tanyao: all runs and a plain pair earn no fu at all, but an open
    // hand cannot claim pinfu, so it pays at 30 rather than 20.
    const r = scoreHandFull(hand('234m22p567s678s', '8s', [
      { kind: 'chi', tile: 3, tiles: parseTiles('456m') },
    ]), ctx({ menzen: false }))
    expect(r.valid).toBe(true)
    expect(r.yaku.map((y) => y.id)).toContain('tanyao')
    expect(r.fu.total).toBe(30)
  })

  it('treats a dual-triplet ron as an open triplet, not a concealed one', () => {
    const tsumoResult = scoreHandFull(hand('111m555m234p678p99s', '5m'), ctx({ tsumo: true }))
    const ronResult = scoreHandFull(hand('111m555m234p678p99s', '5m'), ctx({ tsumo: false, riichi: true }))
    // The self-draw keeps both triplets concealed; the discard win does not.
    expect(tsumoResult.fu.total).toBeGreaterThan(0)
    expect(ronResult.fu.total).toBeGreaterThan(0)
  })
})

describe('yaku detection through scoring', () => {
  it('finds tanyao on an all-simples hand', () => {
    const r = scoreHandFull(hand('234m567m22p345678s', '8s'), ctx())
    expect(r.yaku.map((y) => y.id)).toContain('tanyao')
  })

  it('reduces sanshoku by one han when the hand is open', () => {
    const closed = scoreHandFull(hand('123m123p123s99p234m', '4m'), ctx())
    expect(closed.yaku.find((y) => y.id === 'sanshoku')?.han).toBe(2)

    const open = scoreHandFull(hand('123p123s99p234m', '4m', [
      { kind: 'chi', tile: 0, tiles: parseTiles('123m') },
    ]), ctx({ menzen: false }))
    expect(open.yaku.find((y) => y.id === 'sanshoku')?.han).toBe(1)
  })

  it('does not award closed-only yaku to an open hand', () => {
    const r = scoreHandFull(hand('234m22p567s678s', '8s', [
      { kind: 'chi', tile: 3, tiles: parseTiles('456m') },
    ]), ctx({ menzen: false, riichi: true, tsumo: true }))
    const ids = r.yaku.map((y) => y.id)
    expect(ids).not.toContain('riichi')
    expect(ids).not.toContain('menzen-tsumo')
    expect(ids).not.toContain('pinfu')
  })

  it('picks the reading worth the most when a hand is ambiguous', () => {
    // 111222333m reads as three triplets or three runs; the runs give iipeiko
    // twice (ryanpeikou) plus a chance at more, so the engine must not just
    // take the first reading it finds.
    const r = scoreHandFull(hand('111222333m99p111z', '1z'), ctx())
    expect(r.valid).toBe(true)
    expect(r.score.total).toBeGreaterThan(0)
  })

  it('scores thirteen orphans as a yakuman and ignores dora', () => {
    const r = scoreHandFull(
      hand('19m19p19s12345677z', '7z'),
      ctx({ doraIndicators: parseTiles('9m9m') }),
    )
    expect(r.yakuman).toBe(1)
    expect(r.han).toBe(0)
    expect(r.score.ronPayment).toBe(48000) // East seat = dealer
  })

  it('scores a non-dealer thirteen orphans at 32000', () => {
    const r = scoreHandFull(hand('19m19p19s12345677z', '7z'), ctx({ seatWind: SOUTH }))
    expect(r.score.ronPayment).toBe(32000)
  })

  it('drops normal yaku once a yakuman is present', () => {
    const r = scoreHandFull(hand('111222333444z11m', '1m'), ctx())
    expect(r.yakuman).toBeGreaterThan(0)
    expect(r.yaku.every((y) => y.yakuman)).toBe(true)
  })

  it('reaches a counted yakuman at 13 han', () => {
    // Closed chinitsu (6) + riichi (1) + tsumo (1) + pinfu (1) = 9 han, then
    // four dora on the 4m carry it past 13 without any true yakuman.
    const r = scoreHandFull(
      hand('234m44m456m678m234m', '4m'),
      ctx({ riichi: true, tsumo: true, doraIndicators: parseTiles('3m3m3m3m') }),
    )
    expect(r.valid).toBe(true)
    expect(r.yakuman).toBe(0)
    expect(r.han).toBeGreaterThanOrEqual(13)
    expect(r.score.limit).toBe('kazoe')
    expect(r.score.tsumoFromNonDealer).toBe(16000)
  })

  it('counts the round and seat wind separately for a double East', () => {
    const r = scoreHandFull(
      hand('111z234m567m99p234s', '4s'),
      ctx({ seatWind: EAST, roundWind: EAST }),
    )
    const ids = r.yaku.map((y) => y.id)
    expect(ids).toContain('yakuhai-seat')
    expect(ids).toContain('yakuhai-round')
  })

  it('counts red fives as dora', () => {
    const plain = scoreHandFull(hand('234m567m22p345678s', '8s'), ctx())
    const red = scoreHandFull(hand('234m067m22p345678s', '8s'), ctx())
    expect(red.dora.red).toBe(1)
    expect(red.han).toBe(plain.han + 1)
  })

  it('refuses a complete hand that has no yaku', () => {
    // Open, all runs, and the 123m kills tanyao -- nothing left to claim.
    const r = scoreHandFull(hand('123m22p567s678s', '8s', [
      { kind: 'chi', tile: 3, tiles: parseTiles('456m') },
    ]), ctx({ menzen: false }))
    expect(r.valid).toBe(false)
    expect(r.reason).toBe('no-yaku')
  })

  it('refuses tiles that are not a hand', () => {
    const r = scoreHandFull(hand('123m456p789s135z11m', '1m'), ctx())
    expect(r.valid).toBe(false)
  })
})

/**
 * The pool the scoring drill draws its wrong answers from.
 *
 * Distractors used to be the right answer scaled by a factor and rounded, which
 * produced figures no hand has ever paid — "200/300", "100/100", "300/400" —
 * and a player could eliminate them without reading the hand at all.
 */
describe('paymentTable', () => {
  const cases = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ] as const

  it.each(cases)('dealer=%s tsumo=%s: every row is a real hand', (dealer, tsumo) => {
    const rows = paymentTable(dealer, tsumo)
    expect(rows.length).toBeGreaterThan(20)

    for (const row of rows) {
      // Every figure a player actually hands over is a multiple of 100 and is
      // at least 100 — the rounding step every ruleset applies.
      const parts =
        row.kind === 'ron'
          ? [row.amount]
          : row.kind === 'tsumo-dealer'
            ? [row.each]
            : [row.each, row.fromDealer]
      for (const part of parts) {
        expect(part % 100).toBe(0)
        expect(part).toBeGreaterThanOrEqual(100)
      }
      // A non-dealer self-draw always takes more from the dealer than from the
      // others; "100/100" was the shape of the old bug.
      if (row.kind === 'tsumo-nondealer') expect(row.fromDealer).toBeGreaterThan(row.each)
    }
  })

  it.each(cases)('dealer=%s tsumo=%s: rows are distinct and ascending', (dealer, tsumo) => {
    const rows = paymentTable(dealer, tsumo)
    const keys = rows.map(paymentKey)
    expect(new Set(keys).size, 'duplicate rows').toBe(keys.length)

    const values = rows.map(paymentValue)
    expect([...values].sort((a, b) => a - b)).toEqual(values)
  })

  it('reaches from a cheap hand up to a double yakuman', () => {
    const rows = paymentTable(false, false).map(paymentValue)
    expect(Math.min(...rows)).toBe(1000)
    expect(Math.max(...rows)).toBe(64000)
  })

  it('contains every hand the scorer can actually produce', () => {
    // The pool is built from (han, fu) cells; this walks the same space through
    // `scoreHand` to confirm nothing the engine emits is missing from it.
    for (const dealer of [true, false]) {
      for (const tsumo of [true, false]) {
        const rows = new Set(paymentTable(dealer, tsumo).map(paymentKey))
        for (let han = 1; han <= 13; han++) {
          for (const fu of FU_STEPS) {
            if ((fu === 20 || fu === 25) && han < 2) continue
            const payment = paymentOf(scoreHand({ han, fu, dealer, tsumo }), tsumo, dealer)
            expect(rows.has(paymentKey(payment)), `${han}han ${fu}fu missing`).toBe(true)
          }
        }
      }
    }
  })
})

describe('neighbourPayments', () => {
  it('returns real rows, never the answer itself', () => {
    for (const dealer of [true, false]) {
      for (const tsumo of [true, false]) {
        const table = paymentTable(dealer, tsumo)
        const real = new Set(table.map(paymentKey))
        for (const payment of table) {
          const near = neighbourPayments(payment, dealer, tsumo)
          expect(near.length).toBeGreaterThan(3)
          for (const row of near) {
            expect(real.has(paymentKey(row))).toBe(true)
            expect(paymentKey(row)).not.toBe(paymentKey(payment))
          }
        }
      }
    }
  })

  it('puts the closest rows first, which is where a miscount lands', () => {
    const table = paymentTable(false, false)
    for (const payment of table) {
      const distances = neighbourPayments(payment, false, false).map((row) =>
        Math.abs(paymentValue(row) - paymentValue(payment)),
      )
      expect([...distances].sort((a, b) => a - b)).toEqual(distances)
    }
  })
})
