import { describe, expect, it } from 'vitest'
import {
  type Difficulty,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  DIFFICULTY_SPEEDS,
  fallAcceleration,
  fallDrop,
  fallDurationSeconds,
  GROUND_Y,
  MACHINE_HEIGHT,
  MACHINE_RADIUS,
  machinePoint,
  MAX_STICKS,
  MIN_STICKS,
  STICK_FALL_DISTANCE,
  STICK_MISS_Y,
  stickFallProgress,
} from './gameConfig'

/** Distance from the point to the vertical axis that passes through the player. */
function radiusOf([x, , z]: [number, number, number]): number {
  return Math.hypot(x, z)
}

describe('machinePoint', () => {
  it('draws a horizontal semicircle at the height of the hoop', () => {
    for (let i = 0; i <= 10; i++) {
      const point = machinePoint(i / 10)
      expect(radiusOf(point)).toBeCloseTo(MACHINE_RADIUS, 6)
      expect(point[1]).toBe(MACHINE_HEIGHT)
    }
  })

  it('spreads from left to right in front of the player', () => {
    const [leftX, , leftZ] = machinePoint(0)
    const [frontX, , frontZ] = machinePoint(0.5)
    const [rightX, , rightZ] = machinePoint(1)

    expect(leftX).toBeCloseTo(-MACHINE_RADIUS, 6)
    expect(leftZ).toBeCloseTo(0, 6)
    // The player looks towards -Z: the centre of the hoop is right in front of them.
    expect(frontX).toBeCloseTo(0, 6)
    expect(frontZ).toBeCloseTo(-MACHINE_RADIUS, 6)
    expect(rightX).toBeCloseTo(MACHINE_RADIUS, 6)
    expect(rightZ).toBeCloseTo(0, 6)
  })

  it('advances monotonically in X as t grows', () => {
    let previous = -Infinity
    for (let i = 0; i <= 20; i++) {
      const [x] = machinePoint(i / 20)
      expect(x).toBeGreaterThan(previous)
      previous = x
    }
  })

  it('does not cross behind the player', () => {
    for (let i = 0; i <= 20; i++) {
      const [, , z] = machinePoint(i / 20)
      expect(z).toBeLessThanOrEqual(1e-9)
    }
  })
})

describe('difficulties', () => {
  it('defines label, colour and speed for each level', () => {
    for (const level of DIFFICULTY_ORDER) {
      expect(DIFFICULTY_SPEEDS[level]).toBeGreaterThan(0)
      expect(DIFFICULTY_LABELS[level]).toBeTruthy()
      expect(DIFFICULTY_COLORS[level]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('leaves no declared difficulty out of the selector', () => {
    expect([...DIFFICULTY_ORDER].sort()).toEqual(
      Object.keys(DIFFICULTY_SPEEDS).sort(),
    )
  })

  it('orders the levels from slowest to fastest', () => {
    const speeds = DIFFICULTY_ORDER.map((level) => DIFFICULTY_SPEEDS[level])
    const ascending = [...speeds].sort((a, b) => a - b)
    expect(speeds).toEqual(ascending)
    expect(new Set(speeds).size).toBe(speeds.length)
  })
})

describe('fallDurationSeconds', () => {
  it('measures the fall from the hoop until the tip touches the ground', () => {
    expect(STICK_MISS_Y).toBeGreaterThan(GROUND_Y)
    expect(STICK_MISS_Y).toBeLessThan(MACHINE_HEIGHT)
    expect(STICK_FALL_DISTANCE).toBeCloseTo(MACHINE_HEIGHT - STICK_MISS_Y, 6)
  })

  it('keeps the reaction margin of each difficulty', () => {
    // Ranges of the design (see ESTADO.md): Easy ~5.7 s, Impossible ~0.7 s. If an
    // adjustment of geometry or of speed takes them out of here, the game stops
    // being playable at one end or becomes trivial at the other.
    expect(fallDurationSeconds('easy')).toBeGreaterThan(4)
    expect(fallDurationSeconds('easy')).toBeLessThan(8)
    expect(fallDurationSeconds('impossible')).toBeGreaterThan(0.4)
    expect(fallDurationSeconds('impossible')).toBeLessThan(1)
  })

  it('shortens the margin as the difficulty rises', () => {
    const durations = DIFFICULTY_ORDER.map(fallDurationSeconds)
    const descending = [...durations].sort((a, b) => b - a)
    expect(durations).toEqual(descending)
  })
})

describe('fallAcceleration', () => {
  /** Height of the anchor `t` seconds after being released from `height`. */
  function anchorAt(t: number, difficulty: Difficulty, height = MACHINE_HEIGHT) {
    const distance = height - STICK_MISS_Y
    const speed = DIFFICULTY_SPEEDS[difficulty] * (distance / STICK_FALL_DISTANCE)
    return height - fallDrop(t, fallAcceleration(speed, distance))
  }

  it('reaches the ground in the same time as when it fell at a fixed speed', () => {
    // Moving to gravity cannot recalibrate the fifteen levels nor their stars:
    // the duration of each difficulty is the usual one, distance over speed.
    for (const difficulty of DIFFICULTY_ORDER) {
      const total = STICK_FALL_DISTANCE / DIFFICULTY_SPEEDS[difficulty]
      expect(fallDurationSeconds(difficulty)).toBe(total)
      expect(anchorAt(total, difficulty)).toBeCloseTo(STICK_MISS_Y, 9)
      expect(anchorAt(total * 0.99, difficulty)).toBeGreaterThan(STICK_MISS_Y)
    }
  })

  it('lasts the same with the hoop higher or lower', () => {
    for (const height of [MACHINE_HEIGHT - 0.3, MACHINE_HEIGHT + 0.25]) {
      const total = fallDurationSeconds('hard')
      expect(anchorAt(total, 'hard', height)).toBeCloseTo(STICK_MISS_Y, 9)
    }
  })

  it('releases the stick at rest and accelerates it', () => {
    const a = fallAcceleration(DIFFICULTY_SPEEDS.medium)
    const dt = 0.1
    const stretches = [0, 1, 2, 3].map((i) => fallDrop((i + 1) * dt, a) - fallDrop(i * dt, a))
    expect(fallDrop(0, a)).toBe(0)
    for (let i = 1; i < stretches.length; i++) {
      expect(stretches[i]).toBeGreaterThan(stretches[i - 1])
    }
  })

  it('on no level does it pass through a height earlier than at a fixed speed', () => {
    // It is what guarantees that the reaction margin does not drop: to reach
    // any point of the distance the stick takes the same or longer than before, and
    // it stays longer up high, which is where the arm reaches it.
    for (const difficulty of DIFFICULTY_ORDER) {
      const total = fallDurationSeconds(difficulty)
      for (let i = 1; i < 20; i++) {
        const t = (i / 20) * total
        const before = MACHINE_HEIGHT - DIFFICULTY_SPEEDS[difficulty] * t
        expect(anchorAt(t, difficulty)).toBeGreaterThan(before)
      }
    }
  })

  it('grows with the difficulty and not even Impossible goes past real gravity', () => {
    // Each level is the same fall at another playback speed: Easy in very
    // slow motion, Impossible almost in real time.
    const accelerations = DIFFICULTY_ORDER.map((d) => fallAcceleration(DIFFICULTY_SPEEDS[d]))
    const ascending = [...accelerations].sort((x, y) => x - y)
    expect(accelerations).toEqual(ascending)
    expect(accelerations[accelerations.length - 1]).toBeLessThan(9.81)
  })

  it('with an impossible distance it does not move the stick', () => {
    // Rather than NaN (the stick would disappear) or a negative (it would go up).
    expect(fallAcceleration(1, 0)).toBe(0)
    expect(fallAcceleration(1, Number.NaN)).toBe(0)
    expect(fallAcceleration(Number.NaN)).toBe(0)
    expect(fallDrop(-1, 3)).toBe(0)
    expect(fallDrop(Number.NaN, 3)).toBe(0)
  })
})

describe('stick limits', () => {
  it('respects the 5–13 range of the statement', () => {
    expect(MIN_STICKS).toBe(5)
    expect(MAX_STICKS).toBe(13)
  })
})

describe('how far the stick has fallen', () => {
  it('just released it has not fallen at all, and at the very bottom it has fallen completely', () => {
    // It is what decides the reward for reflexes: catching it up high is worth more.
    expect(stickFallProgress(MACHINE_HEIGHT)).toBe(0)
    expect(stickFallProgress(STICK_MISS_Y)).toBe(1)
  })

  it('it is measured in time: halfway down, more than half the fall has already gone by', () => {
    // The stick accelerates, so halfway through its time it has only dropped a quarter.
    const quarter = MACHINE_HEIGHT - STICK_FALL_DISTANCE / 4
    expect(stickFallProgress(quarter)).toBeCloseTo(0.5, 6)
    const half = (MACHINE_HEIGHT + STICK_MISS_Y) / 2
    expect(stickFallProgress(half)).toBeCloseTo(Math.SQRT1_2, 6)
  })

  it('matches the clock of the fall on each difficulty', () => {
    // It is the real fraction of time, not an approximation: the same gesture
    // scores the same on Easy as on Impossible.
    for (const difficulty of DIFFICULTY_ORDER) {
      const total = fallDurationSeconds(difficulty)
      const a = fallAcceleration(DIFFICULTY_SPEEDS[difficulty])
      for (const fraction of [0.1, 0.3, 0.6, 0.9]) {
        const y = MACHINE_HEIGHT - fallDrop(fraction * total, a)
        expect(stickFallProgress(y)).toBeCloseTo(fraction, 6)
      }
    }
  })

  it('it is measured against the hoop height of each player, not against the nominal one', () => {
    // With the machine set at the height of whoever plays the distance changes:
    // always measuring it against the nominal one would give away reflexes to whoever
    // has it low and take them from whoever has it high.
    const low = MACHINE_HEIGHT - 0.4
    expect(stickFallProgress(low, low)).toBe(0)
    expect(stickFallProgress(low)).toBeGreaterThan(0)
  })

  it('what goes outside the distance is clamped', () => {
    expect(stickFallProgress(MACHINE_HEIGHT + 5)).toBe(0)
    expect(stickFallProgress(STICK_MISS_Y - 5)).toBe(1)
  })

  it('an impossible height reads as just released', () => {
    // It arrives from the scene every frame: in a lost one it can come as NaN, and
    // with that the reward for reflexes would come out of nowhere.
    expect(stickFallProgress(Number.NaN)).toBe(0)
    expect(stickFallProgress(1, Number.NaN)).toBe(0)
    expect(stickFallProgress(1, STICK_MISS_Y)).toBe(0)
  })
})
