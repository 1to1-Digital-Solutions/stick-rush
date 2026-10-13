import { describe, expect, it } from 'vitest'
import {
  SWING_AMPLITUDE,
  SWING_CROSS_RATIO,
  hangingSwing,
} from './stickSwing'

/** A dense sampling of one particular phase, to measure the travel. */
function sample(phase: number, seconds = 20, step = 1 / 60) {
  const tilts = []
  for (let time = 0; time <= seconds; time += step) {
    tilts.push(hangingSwing(time, phase))
  }
  return tilts
}

const PHASES = [0, 0.13, 0.37, 0.5, 0.62, 0.88, 0.999]

describe('hangingSwing', () => {
  it('rocks the stick a few degrees, it does not knock it over', () => {
    // The stick hangs from a fixed hook: if the swing goes beyond that, it separates
    // from its neighbours or crosses them.
    expect(SWING_AMPLITUDE).toBeLessThan((6 * Math.PI) / 180)

    for (const phase of PHASES) {
      for (const tilt of sample(phase, 5)) {
        expect(Math.abs(tilt.z)).toBeLessThanOrEqual(SWING_AMPLITUDE)
        expect(Math.abs(tilt.x)).toBeLessThanOrEqual(
          SWING_AMPLITUDE * SWING_CROSS_RATIO,
        )
      }
    }
  })

  it('really moves: it covers almost all its amplitude in a few seconds', () => {
    // It is what the machine did not do: staying still. A swing that is too short
    // (or stopped) fixes nothing even if the code calls it a sway.
    for (const phase of PHASES) {
      const zs = sample(phase, 4).map((tilt) => tilt.z)
      const travel = Math.max(...zs) - Math.min(...zs)
      expect(travel).toBeGreaterThan(SWING_AMPLITUDE * 1.8)
    }
  })

  it('does not jerk between frames', () => {
    // At 60 fps the jump from one frame to the next has to be
    // imperceptible: a swing in jumps reads as a bug, not as inertia.
    for (const phase of PHASES) {
      const tilts = sample(phase, 5)
      tilts.slice(1).forEach((tilt, index) => {
        const previous = tilts[index]
        expect(Math.abs(tilt.z - previous.z)).toBeLessThan(0.005)
        expect(Math.abs(tilt.x - previous.x)).toBeLessThan(0.005)
      })
    }
  })

  it('does not move all the sticks at once', () => {
    // Thirteen sticks with the same recipe and the same clock would move as one
    // block, which is worse than not moving: it looks mechanical.
    const apart = PHASES.slice(1).filter((phase) => {
      const own = sample(phase, 6).map((tilt) => tilt.z)
      const other = sample(PHASES[0], 6).map((tilt) => tilt.z)
      const largestDifference = Math.max(
        ...own.map((z, index) => Math.abs(z - other[index])),
      )
      return largestDifference > SWING_AMPLITUDE
    })
    expect(apart).toEqual(PHASES.slice(1))
  })

  it('describes an ellipse, not a line', () => {
    // The two axes go at different paces, so the stick does not always repeat the
    // same stroke: at some instants it tilts towards the same side on both
    // axes and at others towards opposite sides.
    const signs = sample(0.4, 20).map((tilt) => Math.sign(tilt.x * tilt.z))
    expect(signs).toContain(1)
    expect(signs).toContain(-1)
  })

  it('is pure: same instant and same phase, same tilt', () => {
    expect(hangingSwing(3.5, 0.42)).toEqual(hangingSwing(3.5, 0.42))
  })
})
