import { describe, expect, it, vi } from 'vitest'
import {
  DIFFICULTY_SPEEDS,
  MACHINE_HEIGHT,
  PLAYER_SHOULDER_HEIGHT,
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_MISS_Y,
  machinePoint,
  PLAYER_POSITION,
} from './gameConfig'
import {
  HOOP_ADJUST_KEY,
  HOOP_ADJUST_RANGE,
  HOOP_ADJUST_STEP,
  HOOP_MAX_HEIGHT,
  HOOP_MIN_HEIGHT,
  HOOP_RISE_ABOVE_EYES,
  MAX_EYE_HEIGHT,
  MIN_EYE_HEIGHT,
  REFERENCE_EYE_HEIGHT,
  clampHoopAdjustment,
  hasFloorReference,
  headsetEyeHeight,
  hoopFallSpeed,
  hoopHeightFor,
  parseHoopAdjustment,
  readHoopAdjustment,
  writeHoopAdjustment,
} from './hoopHeight'

/** Comfortable reach of the arm from the shoulder, the same as in `xrInteraction.test.ts`. */
const ARM_REACH = 0.75

/**
 * Shoulder height of whoever has their eyes there. It comes from the pair the machine was
 * designed with (1.60 for the eyes, 1.45 for the shoulder), so a shorter player
 * drags their shoulder along.
 */
function shoulderHeightFor(eyeHeight: number): number {
  return eyeHeight - (REFERENCE_EYE_HEIGHT - PLAYER_SHOULDER_HEIGHT)
}

/** How far from the player the stick hanging from point `t` of the hoop is. */
function reachTo(t: number, hoopHeight: number, eyeHeight: number): number {
  const [x, y, z] = machinePoint(t, hoopHeight)
  const [px, , pz] = PLAYER_POSITION
  const center = y - STICK_CORD_LENGTH - STICK_LENGTH / 2
  return Math.hypot(x - px, center - shoulderHeightFor(eyeHeight), z - pz)
}

/**
 * How many metres of its fall the stick of point `t` spends inside the arm: the stretch of the
 * vertical, between where it hangs and where it is given up for lost, that is less than
 * `ARM_REACH` from the shoulder.
 */
function reachableFall(t: number, hoopHeight: number, eyeHeight: number): number {
  const [x, , z] = machinePoint(t, hoopHeight)
  const [px, , pz] = PLAYER_POSITION
  const horizontal = Math.hypot(x - px, z - pz)
  if (horizontal >= ARM_REACH) return 0
  const half = Math.sqrt(ARM_REACH ** 2 - horizontal ** 2)
  const shoulder = shoulderHeightFor(eyeHeight)
  const hanging = hoopHeight - STICK_CORD_LENGTH - STICK_LENGTH / 2
  const lost = STICK_MISS_Y - STICK_CORD_LENGTH - STICK_LENGTH / 2
  return Math.max(0, Math.min(hanging, shoulder + half) - Math.max(lost, shoulder - half))
}

/**
 * The least a stick has to spend inside the arm, in metres. On Impossible it falls at
 * some 2 m/s: with a 40 cm band the hand has a couple of tenths to close.
 */
const MIN_REACHABLE_FALL = 0.4

/**
 * Test statures: seated, short, the reference one and very tall, plus the two
 * extremes that are accepted as a person —which are exactly where the absolute cap
 * can come in to trim and separate the hoop from the arm—.
 */
const EYE_HEIGHTS = [
  MIN_EYE_HEIGHT,
  1.05,
  1.35,
  REFERENCE_EYE_HEIGHT,
  1.9,
  MAX_EYE_HEIGHT,
]

describe('eye height the headset delivers', () => {
  it('with the space referred to the floor it is worth what the head measures', () => {
    expect(headsetEyeHeight(1.72, true)).toBe(1.72)
    expect(headsetEyeHeight(1.1, true)).toBe(1.1)
  })

  it('with no space referred to the floor there is no valid data', () => {
    // In a `local` space the head is born at zero: its height measures from where
    // the session started, not from the floor, and taking it for a stature would put
    // the hoop at knee height.
    expect(headsetEyeHeight(1.72, false)).toBeNull()
    expect(headsetEyeHeight(0.02, false)).toBeNull()
  })

  it('discards what cannot be a person', () => {
    expect(headsetEyeHeight(0, true)).toBeNull()
    expect(headsetEyeHeight(-1.6, true)).toBeNull()
    expect(headsetEyeHeight(42, true)).toBeNull()
    expect(headsetEyeHeight(Number.NaN, true)).toBeNull()
    expect(headsetEyeHeight(Number.POSITIVE_INFINITY, true)).toBeNull()
  })

  it('the space of the session is taken as good if it brings a floor', () => {
    expect(hasFloorReference(['local-floor', 'hand-tracking'])).toBe(true)
    expect(hasFloorReference(['bounded-floor'])).toBe(true)
  })

  it('a space with no floor is rejected', () => {
    expect(hasFloorReference(['local', 'hand-tracking'])).toBe(false)
    expect(hasFloorReference([])).toBe(false)
  })

  it('a browser that does not publish its features does not prevent measuring', () => {
    // `enabledFeatures` is optional in the specification, and `local-floor` goes
    // as required when the session opens: had it not been granted, there would be no
    // session. Demanding the list would be giving up measuring in headsets where the data
    // is good; and if the space were not a floor one, the height would be born next to zero
    // and the stature filter would discard it anyway.
    expect(hasFloorReference(undefined)).toBe(true)
    expect(hasFloorReference(null)).toBe(true)
    expect(headsetEyeHeight(0.05, hasFloorReference(undefined))).toBeNull()
  })

  it('accepts the extremes of the range, which are real people', () => {
    expect(headsetEyeHeight(MIN_EYE_HEIGHT, true)).toBe(MIN_EYE_HEIGHT)
    expect(headsetEyeHeight(MAX_EYE_HEIGHT, true)).toBe(MAX_EYE_HEIGHT)
  })
})

describe('height of the hoop', () => {
  it('with no data from the headset it leaves the hoop where it has always been', () => {
    // It is what makes the desktop and a session with no floor play the same
    // as before the height was adjustable.
    expect(hoopHeightFor({})).toBeCloseTo(MACHINE_HEIGHT, 6)
    expect(hoopHeightFor({ eyeHeight: null })).toBeCloseTo(MACHINE_HEIGHT, 6)
    expect(hoopHeightFor({ eyeHeight: undefined })).toBeCloseTo(MACHINE_HEIGHT, 6)
  })

  it('raises the hoop with whoever plays and lowers it with whoever is seated', () => {
    const tall = hoopHeightFor({ eyeHeight: 1.9 })
    const seated = hoopHeightFor({ eyeHeight: 1.1 })

    expect(tall).toBeCloseTo(1.9 + HOOP_RISE_ABOVE_EYES, 6)
    expect(seated).toBeCloseTo(1.1 + HOOP_RISE_ABOVE_EYES, 6)
    expect(seated).toBeLessThan(MACHINE_HEIGHT)
    expect(tall).toBeGreaterThan(MACHINE_HEIGHT)
  })

  it('an absurd measurement does not move the hoop from its place', () => {
    // A headset left on the table, a badly calibrated space or someone
    // tinkering: better the usual height than an unreachable one.
    for (const absurd of [0, -3, 50, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(hoopHeightFor({ eyeHeight: absurd })).toBeCloseTo(MACHINE_HEIGHT, 6)
    }
  })

  it('the manual correction adds metres on top of what the headset says', () => {
    const base = hoopHeightFor({ eyeHeight: 1.5 })
    expect(hoopHeightFor({ eyeHeight: 1.5, adjustment: 0.1 })).toBeCloseTo(
      base + 0.1,
      6,
    )
    expect(hoopHeightFor({ eyeHeight: 1.5, adjustment: -0.1 })).toBeCloseTo(
      base - 0.1,
      6,
    )
  })

  it('the manual correction does not leave its range', () => {
    expect(clampHoopAdjustment(5)).toBe(HOOP_ADJUST_RANGE)
    expect(clampHoopAdjustment(-5)).toBe(-HOOP_ADJUST_RANGE)
    expect(clampHoopAdjustment(Number.NaN)).toBe(0)
    expect(clampHoopAdjustment(Number.NEGATIVE_INFINITY)).toBe(0)

    // And the calculation bounds it even if it arrives unbounded.
    expect(hoopHeightFor({ eyeHeight: 1.6, adjustment: 99 })).toBeCloseTo(
      1.6 + HOOP_RISE_ABOVE_EYES + HOOP_ADJUST_RANGE,
      6,
    )
    expect(hoopHeightFor({ adjustment: -99 })).toBeCloseTo(
      MACHINE_HEIGHT - HOOP_ADJUST_RANGE,
      6,
    )
  })

  it('never leaves the hoop inside the floor nor up in the clouds', () => {
    const extremes = [
      { eyeHeight: MIN_EYE_HEIGHT, adjustment: -HOOP_ADJUST_RANGE },
      { eyeHeight: MAX_EYE_HEIGHT, adjustment: HOOP_ADJUST_RANGE },
      { eyeHeight: 0, adjustment: -99 },
      { eyeHeight: 99, adjustment: 99 },
    ]

    for (const input of extremes) {
      const height = hoopHeightFor(input)
      expect(height).toBeGreaterThanOrEqual(HOOP_MIN_HEIGHT)
      expect(height).toBeLessThanOrEqual(HOOP_MAX_HEIGHT)
      // And with fall travel to spare: a hoop at the height at which the stick
      // already counts as lost would not let any run be played.
      expect(height).toBeGreaterThan(STICK_MISS_Y + 0.5)
    }
  })

  it('the hoop ends up above the head at any stature', () => {
    // Even lowering it all the way: if it fell below the eyes, the sticks
    // would hang in front of the face instead of around.
    for (const eyeHeight of EYE_HEIGHTS) {
      const height = hoopHeightFor({ eyeHeight, adjustment: -HOOP_ADJUST_RANGE })
      expect(height).toBeGreaterThan(eyeHeight)
    }
  })

  it('each stick crosses the reach of the arm as it falls, wherever the hoop is put', () => {
    // The invariant that makes the machine playable. With the hoop half a metre above the
    // eyes, a hanging stick can end up above the hand —it is what was asked for:
    // that they do not hang in front of the face—, so what is demanded is that **as it
    // falls** it spends a good stretch inside the arm. If the adjustment could take them out,
    // the headset's menu would be a way of breaking the run.
    for (const eyeHeight of EYE_HEIGHTS) {
      for (const adjustment of [-HOOP_ADJUST_RANGE, 0, HOOP_ADJUST_RANGE]) {
        const height = hoopHeightFor({ eyeHeight, adjustment })
        for (let i = 0; i <= 20; i++) {
          expect(
            reachableFall(i / 20, height, eyeHeight),
            `eyes ${eyeHeight}, adjustment ${adjustment}, stick ${i}/20`,
          ).toBeGreaterThanOrEqual(MIN_REACHABLE_FALL)
        }
      }
    }
  })

  it('and with the default hoop, the stick is caught even while hanging', () => {
    for (let i = 0; i <= 20; i++) {
      expect(reachTo(i / 20, hoopHeightFor({ eyeHeight: REFERENCE_EYE_HEIGHT }), REFERENCE_EYE_HEIGHT)).toBeLessThanOrEqual(
        ARM_REACH,
      )
    }
  })

  it('the sticks hang above the face, not in front', () => {
    // «The machine higher», with the headset: the bottom tip of the hanging stick ends up
    // above the eyes at any stature.
    for (const eyeHeight of EYE_HEIGHTS) {
      const height = hoopHeightFor({ eyeHeight })
      expect(height - STICK_CORD_LENGTH - STICK_LENGTH).toBeGreaterThan(eyeHeight - 0.2)
    }
  })

  it('moves in steps that are noticed without overdoing it', () => {
    // A step that is too fine forces hammering the button; one that is too coarse
    // jumps over the good height.
    expect(HOOP_ADJUST_STEP).toBeGreaterThanOrEqual(0.02)
    expect(HOOP_ADJUST_STEP).toBeLessThanOrEqual(HOOP_ADJUST_RANGE / 2)
  })
})

describe('fall speed with the hoop moved', () => {
  it('each difficulty lasts the same wherever the hoop is', () => {
    // Without this, whoever plays standing would have more reaction margin than whoever
    // plays seated, with the same difficulty chosen.
    const reference =
      (MACHINE_HEIGHT - STICK_MISS_Y) / DIFFICULTY_SPEEDS.medium

    for (const eyeHeight of EYE_HEIGHTS) {
      const height = hoopHeightFor({ eyeHeight })
      const speed = hoopFallSpeed(DIFFICULTY_SPEEDS.medium, height)
      expect((height - STICK_MISS_Y) / speed).toBeCloseTo(reference, 6)
    }
  })

  it('at the usual height it does not touch the speed', () => {
    expect(hoopFallSpeed(DIFFICULTY_SPEEDS.hard, MACHINE_HEIGHT)).toBeCloseTo(
      DIFFICULTY_SPEEDS.hard,
      6,
    )
  })

  it('an impossible height leaves the speed as it was', () => {
    // Rather than returning 0 (the stick would stay hanging forever) or a
    // negative (it would go up), the game is played with the difficulty's speed.
    expect(hoopFallSpeed(1.2, STICK_MISS_Y)).toBe(1.2)
    expect(hoopFallSpeed(1.2, Number.NaN)).toBe(1.2)
  })
})

/** Fake storage, with just what the height of the hoop uses. */
function fakeStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(HOOP_ADJUST_KEY, initial)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  } as unknown as Storage
}

/** The one browsers have in private mode: it throws instead of failing. */
function blockedStorage(): Storage {
  return {
    getItem: () => {
      throw new DOMException('blocked', 'SecurityError')
    },
    setItem: () => {
      throw new DOMException('quota exhausted', 'QuotaExceededError')
    },
  } as unknown as Storage
}

describe('the correction is remembered between visits', () => {
  it('reads what was stored', () => {
    expect(readHoopAdjustment(fakeStorage('-0.15'))).toBeCloseTo(-0.15, 6)
    expect(readHoopAdjustment(fakeStorage('0.1'))).toBeCloseTo(0.1, 6)
  })

  it('discards what is not a correction', () => {
    expect(parseHoopAdjustment(null)).toBe(0)
    expect(parseHoopAdjustment('')).toBe(0)
    expect(parseHoopAdjustment('   ')).toBe(0)
    expect(parseHoopAdjustment('a hand span')).toBe(0)
    expect(parseHoopAdjustment('Infinity')).toBe(0)
  })

  it('bounds what was stored by hand from the browser', () => {
    // Editing it from the browser's tools cannot place the hoop
    // outside what the menu itself allows.
    expect(parseHoopAdjustment('99')).toBe(HOOP_ADJUST_RANGE)
    expect(parseHoopAdjustment('-99')).toBe(-HOOP_ADJUST_RANGE)
  })

  it('writes the correction under its key', () => {
    const storage = fakeStorage()
    writeHoopAdjustment(storage, -0.1)
    expect(storage.getItem(HOOP_ADJUST_KEY)).toBe('-0.1')
  })

  it('stores nothing the reading would discard', () => {
    const storage = fakeStorage()
    const setItem = vi.spyOn(storage, 'setItem')

    writeHoopAdjustment(storage, Number.NaN)
    writeHoopAdjustment(storage, Number.POSITIVE_INFINITY)

    expect(setItem).not.toHaveBeenCalled()
  })

  it('stores bounded whatever goes out of range', () => {
    const storage = fakeStorage()
    writeHoopAdjustment(storage, 5)
    expect(storage.getItem(HOOP_ADJUST_KEY)).toBe(String(HOOP_ADJUST_RANGE))
  })

  it('with no storage the game is played with the hoop where the headset leaves it', () => {
    expect(readHoopAdjustment(null)).toBe(0)
    expect(() => writeHoopAdjustment(null, 0.1)).not.toThrow()
  })

  it('a blocked storage does not break the run', () => {
    expect(readHoopAdjustment(blockedStorage())).toBe(0)
    expect(() => writeHoopAdjustment(blockedStorage(), 0.1)).not.toThrow()
  })
})
