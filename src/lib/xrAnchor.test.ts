import { describe, expect, it } from 'vitest'
import {
  XR_ANCHOR_DEADZONE,
  angleDelta,
  approachAngle,
  followRatio,
  initialAnchorState,
  normalizeAngle,
  stepAnchor,
  type AnchorState,
} from './xrAnchor'

/**
 * The immersive ui always has to fall inside the field of view.
 *
 * This is not cosmetic: hung from `<XROrigin>` at a fixed position, on entering
 * the headset it appeared behind the player's back —the origin's −Z is decided by the
 * calibration of the room, not by where they look—. They did not see the menu, could not
 * choose anything and the exit button was unreachable. The tests here pin down that
 * this does not happen again, and they run without a browser or a headset.
 */

/** Simulates a few seconds of reframing at 90 fps. */
function settle(state: AnchorState, gazeYaw: number, seconds = 3): AnchorState {
  const step = 1 / 90
  let current = state
  for (let t = 0; t < seconds; t += step) {
    current = stepAnchor(current, gazeYaw, step)
  }
  return current
}

describe('angle arithmetic', () => {
  it('normalises any turn to the range [−π, π)', () => {
    expect(normalizeAngle(0)).toBeCloseTo(0)
    expect(normalizeAngle(Math.PI * 2)).toBeCloseTo(0)
    expect(normalizeAngle(-Math.PI * 2.5)).toBeCloseTo(-Math.PI / 2)
    // The antipode is the same angle by ±π; it is resolved as −π.
    expect(Math.abs(normalizeAngle(Math.PI * 3))).toBeCloseTo(Math.PI)
  })

  it('survives a camera that has not yet given a valid pose', () => {
    // In the first frame of the session the matrix may come uninitialised.
    expect(normalizeAngle(Number.NaN)).toBe(0)
    expect(normalizeAngle(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('goes the short way even if it has to cross behind', () => {
    // From 170° to −170° is 20° turning behind, not 340° going all the way round.
    const from = (170 * Math.PI) / 180
    const to = (-170 * Math.PI) / 180
    expect(Math.abs(angleDelta(from, to))).toBeCloseTo((20 * Math.PI) / 180, 5)
  })

  it('does not overshoot on approaching', () => {
    // With the fraction at its maximum it arrives right at the target, never beyond.
    expect(approachAngle(0, 1, 1)).toBeCloseTo(1)
    expect(approachAngle(0, 1, 0)).toBeCloseTo(0)
    // Fractions out of range break nothing.
    expect(approachAngle(0, 1, 5)).toBeCloseTo(1)
    expect(approachAngle(0, 1, -3)).toBeCloseTo(0)
  })

  it('the reframing takes the same at 72 fps as at 120', () => {
    // With a bare `factor * delta`, a fast headset would reframe more slowly
    // than a slow one. The exponential travels the same in the same real time.
    const slow = settle(initialAnchorState(0), 2, 1)
    const fastStep = 1 / 120
    let fast = initialAnchorState(0)
    for (let t = 0; t < 1; t += fastStep) {
      fast = stepAnchor(fast, 2, fastStep)
    }
    expect(fast.yaw).toBeCloseTo(slow.yaw, 2)
  })

  it('an absurd delta does not shoot the reframing beyond the target', () => {
    expect(followRatio(0)).toBe(0)
    expect(followRatio(-1)).toBe(0)
    expect(followRatio(1000)).toBeLessThanOrEqual(1)
  })
})

describe('the ui catches up with the player wherever they look', () => {
  it('entering with the back to the origin brings it in front', () => {
    // The real case that broke the headset: the session starts with the player
    // looking right opposite the −Z of the room's space.
    const anchored = settle(initialAnchorState(0), Math.PI)
    expect(Math.abs(angleDelta(anchored.yaw, Math.PI))).toBeLessThan(
      XR_ANCHOR_DEADZONE,
    )
  })

  it('ends up still and aligned, not chasing forever', () => {
    const anchored = settle(initialAnchorState(0), Math.PI)
    expect(anchored.following).toBe(false)
    expect(angleDelta(anchored.yaw, Math.PI)).toBeCloseTo(0, 2)
  })

  it('from any starting orientation it ends up facing front', () => {
    for (let deg = -180; deg <= 180; deg += 15) {
      const gaze = (deg * Math.PI) / 180
      const anchored = settle(initialAnchorState(0), gaze)
      expect(Math.abs(angleDelta(anchored.yaw, gaze))).toBeLessThan(
        XR_ANCHOR_DEADZONE,
      )
    }
  })
})

describe('but it does not stick to the face', () => {
  it('glancing sideways does not move it: you have to be able to aim at it', () => {
    // If the ui followed the gaze frame by frame, the target would flee from the
    // ray and there would be no way to press a button.
    const state = initialAnchorState(0)
    const nudged = stepAnchor(state, XR_ANCHOR_DEADZONE * 0.9, 1 / 90)
    expect(nudged).toBe(state)
  })

  it('once it starts, it does not stop at the edge of the dead zone', () => {
    // Without hysteresis the ui would stop as soon as it entered the dead
    // zone again and would be left permanently crooked at the edge.
    let state = initialAnchorState(0)
    state = stepAnchor(state, Math.PI, 1 / 90)
    expect(state.following).toBe(true)

    const anchored = settle(state, Math.PI)
    expect(anchored.following).toBe(false)
    expect(angleDelta(anchored.yaw, Math.PI)).toBeCloseTo(0, 2)
  })

  it('the turn is progressive, not a jump', () => {
    // An instant 180° jerk is dizzying. In one frame it must travel only a
    // part of the way.
    const state = stepAnchor(initialAnchorState(0), Math.PI, 1 / 90)
    expect(Math.abs(state.yaw)).toBeGreaterThan(0)
    expect(Math.abs(state.yaw)).toBeLessThan(Math.PI / 2)
  })
})

describe('with the column to one side, looking at it does not scare it away', () => {
  const options = { leftDeadzone: XR_ANCHOR_DEADZONE + 1 }

  it('turning left as far as the column leaves the ui still', () => {
    const state = initialAnchorState(0)
    expect(stepAnchor(state, XR_ANCHOR_DEADZONE + 0.9, 1 / 90, options)).toBe(state)
  })

  it('to the right the dead zone is still the usual one', () => {
    const state = initialAnchorState(0)
    expect(stepAnchor(state, -(XR_ANCHOR_DEADZONE + 0.1), 1 / 90, options).following).toBe(true)
  })

  it('and beyond the column, the ui does come behind', () => {
    const state = initialAnchorState(0)
    expect(stepAnchor(state, XR_ANCHOR_DEADZONE + 1.1, 1 / 90, options).following).toBe(true)
  })
})
