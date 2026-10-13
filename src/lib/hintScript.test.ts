import { describe, expect, it } from 'vitest'

import { advanceHints, scriptProblems, noHints } from './hints'
import { MACHINE_RADIUS, PLAYER_OFFSET_Z, STICK_CORD_LENGTH, STICK_LENGTH } from './gameConfig'
import {
  FALL,
  HINT_SCRIPT,
  FOOTPRINT,
  FOOTPRINTS,
  CONTROLLER_BY_THE_STICK,
  ghostFall,
  controllerByTheStick,
  ghostStick,
  aboutToFall,
  type HintFact,
} from './hintScript'
import { HOOP_RISE_ABOVE_EYES, hoopHeightFor } from './hoopHeight'
import { TUTORIAL_BUTTONS } from './tutorial'

/**
 * The machine's hints, measured without a browser: that they switch off on their own, that they
 * go before anything falls, and that what is painted covers neither the machine nor the sticks.
 */

const NOTHING: Record<HintFact, boolean> = { grab: false, falling: false }

function litAfter(facts: Record<HintFact, boolean>, seconds: number) {
  const state = noHints()
  advanceHints(HINT_SCRIPT, facts, state, seconds)
  return [...state.lit].sort()
}

/** Statures of whoever plays, from seated to very tall, and the hoop each one gets. */
const EYES = [1.1, 1.3, 1.6, 1.8, 2.0]
const hoopFor = (eyes: number) => hoopHeightFor({ eyeHeight: eyes, adjustment: 0 })

describe('the hint script', () => {
  it('passes the common guard: expiries between the minimum and the maximum, and nothing duplicated', () => {
    expect(scriptProblems(HINT_SCRIPT)).toEqual([])
  })

  it('on entering the cabinet everything is shown: where to stand, the falling stick and the controller', () => {
    expect(litAfter(NOTHING, 0)).toEqual(['controller', 'ground', 'stick'])
  })

  it('the ghost and the controller go before the first stick falls', () => {
    // They float where a stick passes as it falls: they are only good while none passes.
    expect(litAfter({ ...NOTHING, falling: true }, 0)).toEqual(['ground'])
  })

  it('the footprints stay while playing, until the first stick caught', () => {
    expect(litAfter({ grab: true, falling: true }, 0)).toEqual([])
  })

  it('and if nobody does anything, they all go on their own', () => {
    const expiry = Math.max(...HINT_SCRIPT.map((hint) => hint.expiresAfter))
    expect(litAfter(NOTHING, expiry)).toEqual([])
  })

  it('the controller shows the button used to catch, the same as the tutorial', () => {
    expect(TUTORIAL_BUTTONS.grab).toBe('agarre')
  })
})

describe('when the sticks are going to fall', () => {
  it('in the menu and at the start of the countdown, not yet', () => {
    expect(aboutToFall('menu', 0)).toBe(false)
    expect(aboutToFall('countdown', 3)).toBe(false)
    expect(aboutToFall('countdown', 2)).toBe(false)
  })

  it('in the last second of the count, yes: what floats has half a second to go', () => {
    expect(aboutToFall('countdown', 1)).toBe(true)
    expect(aboutToFall('playing', 0)).toBe(true)
  })

  it('with the run finished nothing falls', () => {
    expect(aboutToFall('finished', 0)).toBe(false)
  })
})

describe('the fall of the ghost', () => {
  it('appears still where the stick hangs', () => {
    expect(ghostFall(0)).toEqual({ drop: 0, visible: 0 })
    expect(ghostFall(FALL.appears / 2)).toEqual({ drop: 0, visible: 0.5 })
  })

  it('falls accelerating, the way something really falls', () => {
    const stretch = (FALL.falls - FALL.appears) / 4
    const drops = [1, 2, 3].map((i) => ghostFall(FALL.appears + stretch * i).drop)
    expect(drops[1] - drops[0]).toBeGreaterThan(drops[0])
    expect(drops[2] - drops[1]).toBeGreaterThan(drops[1] - drops[0])
  })

  it('stops down low, which is the catch, and only then fades out', () => {
    expect(ghostFall(FALL.falls)).toEqual({ drop: FALL.travel, visible: 1 })
    expect(ghostFall((FALL.falls + FALL.leaves) / 2)).toEqual({ drop: FALL.travel, visible: 1 })
    expect(ghostFall(1)).toEqual({ drop: FALL.travel, visible: 0 })
  })

  it('outside the loop it stays at its ends', () => {
    expect(ghostFall(-1)).toEqual(ghostFall(0))
    expect(ghostFall(2)).toEqual(ghostFall(1))
  })
})

describe('nothing covers the machine nor the sticks', () => {
  it('the ghost comes out of the front stick, in its place', () => {
    const [x, y, z] = ghostStick(1.95)
    expect(x).toBe(0)
    expect(z).toBe(-MACHINE_RADIUS)
    expect(y).toBeCloseTo(1.95 - STICK_CORD_LENGTH - STICK_LENGTH / 2, 9)
  })

  it('and it stops at chest height, below everything that hangs, whoever it is', () => {
    for (const eyes of EYES) {
      const hoop = hoopFor(eyes)
      const [, y] = ghostStick(hoop)
      const bottom = y - FALL.travel
      const tipOfTheSticks = hoop - STICK_CORD_LENGTH - STICK_LENGTH
      // Its top tip ends up under the tips of the hanging sticks: stopped, it does not get into
      // the curtain of sticks.
      expect(bottom + STICK_LENGTH / 2, `eyes at ${eyes}`).toBeLessThan(tipOfTheSticks)
      // And where the hand reaches without stretching: below the eyes and above the waist.
      expect(bottom, `eyes at ${eyes}`).toBeLessThan(eyes)
      expect(bottom, `eyes at ${eyes}`).toBeGreaterThan(eyes - 0.6)
    }
  })

  it('the controller goes below the eyes and in front of the hoop: behind it there is only ground', () => {
    // Looking down, the line from the eyes to the controller goes on towards the ground, not towards
    // the sticks that hang above the eyes (`HOOP_RISE_ABOVE_EYES`).
    expect(HOOP_RISE_ABOVE_EYES - STICK_CORD_LENGTH - STICK_LENGTH).toBeGreaterThanOrEqual(0)
    for (const eyes of EYES) {
      for (const hand of ['left', 'right'] as const) {
        const { position } = controllerByTheStick(hoopFor(eyes), hand)
        const [x, y, z] = position
        const top = y + 0.06 * CONTROLLER_BY_THE_STICK.scale
        expect(top, `eyes at ${eyes}, ${hand}`).toBeLessThan(eyes)
        expect(Math.hypot(x, z), `eyes at ${eyes}, ${hand}`).toBeLessThan(MACHINE_RADIUS)
      }
    }
  })

  it('the footprints are at the feet of whoever plays, far from where the sticks fall', () => {
    for (const { x, z } of FOOTPRINTS) {
      expect(z).toBe(PLAYER_OFFSET_Z)
      const far = Math.hypot(Math.abs(x) + FOOTPRINT.width / 2, Math.abs(z) + FOOTPRINT.length / 2)
      expect(far).toBeLessThan(MACHINE_RADIUS - 0.2)
    }
  })
})

describe('the controller next to the ghost', () => {
  it('goes on the side of the good hand', () => {
    expect(controllerByTheStick(1.95, 'right').position[0]).toBeGreaterThan(0)
    expect(controllerByTheStick(1.95, 'left').position[0]).toBeLessThan(0)
  })

  it('at the height where the ghost stops', () => {
    const [, y] = ghostStick(1.95)
    expect(controllerByTheStick(1.95, 'right').position[1]).toBeCloseTo(y - FALL.travel, 9)
  })

  it('turned with the grip side facing whoever plays', () => {
    // The grip of the right one is on its −X and that of the left one on its +X; turned about the
    // vertical, that side has to point at the footprints.
    for (const hand of ['left', 'right'] as const) {
      const { position, turn } = controllerByTheStick(1.95, hand)
      const side = hand === 'right' ? -1 : 1
      const facing = [side * Math.cos(turn), -side * Math.sin(turn)]
      const towardPlayer = [-position[0], PLAYER_OFFSET_Z - position[2]]
      const length = Math.hypot(towardPlayer[0], towardPlayer[1])
      const cosine = (facing[0] * towardPlayer[0] + facing[1] * towardPlayer[1]) / length
      expect(cosine, hand).toBeCloseTo(1, 9)
    }
  })
})
