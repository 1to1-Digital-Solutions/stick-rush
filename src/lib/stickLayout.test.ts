import { describe, expect, it } from 'vitest'
import { MACHINE_RADIUS, MAX_STICKS, MIN_STICKS } from './gameConfig'
import {
  buildStickLayout,
  fallOrder,
  stickStatuses,
} from './stickLayout'

describe('buildStickLayout', () => {
  it('creates one stick for each unit requested', () => {
    for (let count = MIN_STICKS; count <= MAX_STICKS; count++) {
      expect(buildStickLayout(count, 1)).toHaveLength(count)
    }
  })

  it('hangs all the sticks from the hoop, without resting them on the posts', () => {
    const layout = buildStickLayout(MAX_STICKS, 1)
    for (const stick of layout) {
      const [x, , z] = stick.anchor
      expect(Math.hypot(x, z)).toBeCloseTo(MACHINE_RADIUS, 6)
      // The exact ends of the semicircle are where the posts go.
      expect(Math.abs(x)).toBeLessThan(MACHINE_RADIUS)
    }
  })

  it('lays them out from left to right without overlapping them', () => {
    const xs = buildStickLayout(9, 1).map((stick) => stick.anchor[0])
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    expect(new Set(xs).size).toBe(xs.length)
  })

  it('centres the layout: it is symmetric about the front of the player', () => {
    const xs = buildStickLayout(7, 1).map((stick) => stick.anchor[0])
    expect(xs[3]).toBeCloseTo(0, 6)
    expect(xs[0]).toBeCloseTo(-xs[6], 6)
  })

  it('staggers the fall: one goes right away and the rest are spread out', () => {
    const delays = buildStickLayout(MAX_STICKS, 4).map((stick) => stick.delay)

    // Exactly one stick opens the run, and each turn waits around one
    // second more than the previous one, plus the jitter.
    expect(delays.filter((delay) => delay === 0)).toHaveLength(1)
    const sorted = [...delays].sort((a, b) => a - b)
    sorted.forEach((delay, turn) => {
      expect(delay).toBeGreaterThanOrEqual(turn)
      expect(delay).toBeLessThanOrEqual(turn * 1.5)
    })
  })

  it('does not release the sticks in the order in which they hang', () => {
    // The bug that was seen in the headset: they always fell from left to right,
    // so the run was predictable. It is checked in several runs
    // because one particular shuffle could come out almost sorted by chance.
    const correlated = [1, 2, 3, 4, 5].filter((runId) => {
      const delays = buildStickLayout(MAX_STICKS, runId).map((s) => s.delay)
      const ascending = delays.every(
        (delay, i) => i === 0 || delay > delays[i - 1],
      )
      return ascending
    })
    expect(correlated).toEqual([])
  })

  it('deals different turns in each run', () => {
    const first = fallOrder(MAX_STICKS, 1)
    const second = fallOrder(MAX_STICKS, 2)
    expect(first).not.toEqual(second)
  })

  it('each stick falls exactly once', () => {
    for (let count = MIN_STICKS; count <= MAX_STICKS; count++) {
      const order = fallOrder(count, 7)
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: count }, (_, i) => i),
      )
    }
  })

  it('scrambles the delays without making them metronomic', () => {
    const delays = buildStickLayout(MAX_STICKS, 4).map((stick) => stick.delay)
    const gaps = delays.slice(1).map((delay, i) => delay - delays[i])
    expect(new Set(gaps.map((gap) => gap.toFixed(4))).size).toBeGreaterThan(1)
  })

  it('gives each stick a slot of its own in the swing cycle', () => {
    const phases = buildStickLayout(MAX_STICKS, 4).map(
      (stick) => stick.swingPhase,
    )
    for (const phase of phases) {
      expect(phase).toBeGreaterThanOrEqual(0)
      expect(phase).toBeLessThan(1)
    }
    // If two sticks share a phase they rock at once, which is the block effect
    // the swing wants to avoid.
    expect(new Set(phases).size).toBe(phases.length)
  })

  it('keeps the swing stable within the run and changes it between runs', () => {
    const first = buildStickLayout(MAX_STICKS, 4).map((s) => s.swingPhase)
    expect(buildStickLayout(MAX_STICKS, 4).map((s) => s.swingPhase)).toEqual(
      first,
    )
    expect(buildStickLayout(MAX_STICKS, 5).map((s) => s.swingPhase)).not.toEqual(
      first,
    )
  })

  it('gives unique keys, different in each run', () => {
    const first = buildStickLayout(MIN_STICKS, 1).map((stick) => stick.key)
    const second = buildStickLayout(MIN_STICKS, 2).map((stick) => stick.key)
    expect(new Set(first).size).toBe(first.length)
    expect(first).not.toEqual(second)
  })

  it('is pure: two equal calls give the same layout', () => {
    expect(buildStickLayout(8, 3)).toEqual(buildStickLayout(8, 3))
  })

  it('with a 32-bit seed, like the one of the challenge, it is still the same round', () => {
    // The hall's seeds are huge unsigned integers; the round cannot depend on
    // anything other than it.
    const seed = 4_000_000_123
    expect(buildStickLayout(MAX_STICKS, seed)).toEqual(buildStickLayout(MAX_STICKS, seed))
    expect(fallOrder(MAX_STICKS, seed)).not.toEqual(fallOrder(MAX_STICKS, seed + 1))
  })

  it('varies the sequence between runs with the same sticks', () => {
    const first = buildStickLayout(8, 3).map((stick) => stick.delay)
    const second = buildStickLayout(8, 4).map((stick) => stick.delay)
    expect(first).not.toEqual(second)
  })

  it('places the single stick in the centre', () => {
    const [only] = buildStickLayout(1, 1)
    expect(only.anchor[0]).toBeCloseTo(0, 6)
    expect(only.anchor[2]).toBeCloseTo(-MACHINE_RADIUS, 6)
  })
})

describe('stickStatuses', () => {
  it('draws the caught ones first, then the lost ones and at the end the pending ones', () => {
    expect(stickStatuses(2, 3, 5)).toEqual([
      'caught',
      'caught',
      'missed',
      'pending',
      'pending',
    ])
  })

  it('marks all the sticks when the run ends', () => {
    expect(stickStatuses(5, 5, 5)).toEqual(Array(5).fill('caught'))
    expect(stickStatuses(0, 5, 5)).toEqual(Array(5).fill('missed'))
  })

  it('starts the run with everything pending', () => {
    expect(stickStatuses(0, 0, 3)).toEqual(['pending', 'pending', 'pending'])
  })

  it('does not break with an empty scoreboard', () => {
    expect(stickStatuses(0, 0, 0)).toEqual([])
  })
})
