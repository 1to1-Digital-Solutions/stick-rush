import { describe, expect, it } from 'vitest'
import { GROUND_Y, MACHINE_HEIGHT } from './gameConfig'
import {
  GARLAND_BULBS_PER_SPAN,
  GARLAND_POST_COUNT,
  GARLAND_POST_HEIGHT,
  GARLAND_RING_RADIUS,
  SCENERY_CLEARANCE,
  STALL_RING_RADIUS,
  WHEEL_CABIN_DROP,
  WHEEL_CABIN_HEIGHT,
  WHEEL_CENTER,
  WHEEL_RADIUS,
  facingRotationY,
  garlandBulbs,
  ringSlots,
  type Vec3,
} from './sceneryLayout'
import { HEIGHTS } from './fairKit'

/** Which way a part turned `rotationY` faces: its local +Z, in the world. */
function facingDirection(rotationY: number): [number, number] {
  return [Math.sin(rotationY), Math.cos(rotationY)]
}

describe('ringSlots', () => {
  it('plants all the parts at the requested distance', () => {
    for (const slot of ringSlots(6, 6.4)) {
      const [x, y, z] = slot.position
      expect(Math.hypot(x, z)).toBeCloseTo(6.4, 6)
      expect(y).toBe(GROUND_Y)
    }
  })

  it('lays them out at equal intervals', () => {
    const angles = ringSlots(8, 3)
      .map(({ position: [x, , z] }) => Math.atan2(x, z))
      // atan2 jumps from +π to −π halfway round: it is normalised to [0, 2π).
      .map((angle) => (angle + Math.PI * 2) % (Math.PI * 2))
      .sort((a, b) => a - b)

    const gaps = angles.slice(1).map((angle, i) => angle - angles[i])
    for (const gap of gaps) {
      expect(gap).toBeCloseTo((Math.PI * 2) / 8, 6)
    }
  })

  it('leaves each part looking at the player and not with its back turned', () => {
    for (const slot of ringSlots(5, 6.4, 0.3)) {
      const [fx, fz] = facingDirection(slot.rotationY)
      const [x, , z] = slot.position
      const distance = Math.hypot(x, z)
      // The front of the part and the direction towards the centre are the same
      // vector: their dot product is worth 1.
      expect(fx * (-x / distance) + fz * (-z / distance)).toBeCloseTo(1, 6)
    }
  })

  it('does not break with an empty ring', () => {
    expect(ringSlots(0, 5)).toEqual([])
  })

  it('is pure: two equal calls give the same ring', () => {
    expect(ringSlots(6, 6.4, 0.2)).toEqual(ringSlots(6, 6.4, 0.2))
  })
})

describe('facingRotationY', () => {
  it('turns half a turn what is right in front of the player', () => {
    // In front is −Z; facing them from there is looking towards +Z, that is, with no turn.
    const [fx, fz] = facingDirection(facingRotationY([0, 0, -5]))
    expect(fx).toBeCloseTo(0, 6)
    expect(fz).toBeCloseTo(1, 6)
  })
})

describe('fairground', () => {
  it('leaves the playing space around the player free', () => {
    // The stalls are measured with their kit piece, in `fairKit.test.ts`.
    expect(GARLAND_RING_RADIUS).toBeGreaterThanOrEqual(SCENERY_CLEARANCE)
  })

  it('does not put the stalls inside the Ferris wheel', () => {
    const [x, , z] = WHEEL_CENTER
    expect(Math.hypot(x, z) - WHEEL_RADIUS).toBeGreaterThan(STALL_RING_RADIUS)
  })

  it('lets the Ferris wheel turn without dragging the cabins along the floor', () => {
    // The lowest cabin is the one at the bottom point of the ring, with all its overhang.
    // What grazes is the bottom of the gondola, not the point it hangs from.
    const cabinFloor =
      WHEEL_CENTER[1] -
      WHEEL_RADIUS -
      WHEEL_CABIN_DROP -
      WHEEL_CABIN_HEIGHT / 2
    expect(cabinFloor).toBeGreaterThan(GROUND_Y)
  })

  it('makes the Ferris wheel peek over the stalls', () => {
    expect(WHEEL_CENTER[1] + WHEEL_RADIUS).toBeGreaterThan(HEIGHTS.puesto * 2)
  })

  it('hangs the garlands inside the ring of stalls', () => {
    expect(GARLAND_RING_RADIUS).toBeLessThan(STALL_RING_RADIUS)
  })
})

describe('garlandBulbs', () => {
  const spans = ringSlots(GARLAND_POST_COUNT, GARLAND_RING_RADIUS).map(
    (slot, index, slots): [Vec3, Vec3] => {
      const next = slots[(index + 1) % slots.length]
      const top = (slot: { position: Vec3 }): Vec3 => [
        slot.position[0],
        GARLAND_POST_HEIGHT,
        slot.position[2],
      ]
      return [top(slot), top(next)]
    },
  )

  it('hangs one bulb per gap, without putting them on the posts', () => {
    const bulbs = garlandBulbs({ from: [0, 3, 0], to: [4, 3, 0], count: 3 })
    expect(bulbs).toHaveLength(3)
    expect(bulbs.map(([x]) => x)).toEqual([1, 2, 3])
  })

  it('sinks the span in the centre, it does not leave it taut', () => {
    const bulbs = garlandBulbs({ from: [0, 3, 0], to: [4, 3, 0], count: 3, sag: 0.5 })
    const heights = bulbs.map(([, y]) => y)
    expect(heights[1]).toBeCloseTo(3 - 0.5, 6)
    // Symmetric: the two ends hang the same and above the centre.
    expect(heights[0]).toBeCloseTo(heights[2], 6)
    expect(heights[0]).toBeGreaterThan(heights[1])
  })

  it('follows the slope between two posts of different height', () => {
    const bulbs = garlandBulbs({ from: [0, 2, 0], to: [4, 4, 0], count: 3, sag: 0 })
    expect(bulbs.map(([, y]) => y)).toEqual([2.5, 3, 3.5])
  })

  it('keeps the bulbs above the machine', () => {
    // If a span hangs down to the height of the hoop, the player finds
    // bulbs right where they look for sticks.
    for (const [from, to] of spans) {
      for (const [, y] of garlandBulbs({ from, to })) {
        expect(y).toBeGreaterThan(MACHINE_HEIGHT)
      }
    }
  })

  it('strings a garland between each two posts, closing the circle', () => {
    expect(spans).toHaveLength(GARLAND_POST_COUNT)
    const bulbs = spans.flatMap(([from, to]) => garlandBulbs({ from, to }))
    expect(bulbs).toHaveLength(GARLAND_POST_COUNT * GARLAND_BULBS_PER_SPAN)
    // None leaves the fairground nor sneaks inside it: they go along the chord,
    // which goes from post to post.
    for (const [x, , z] of bulbs) {
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(GARLAND_RING_RADIUS + 1e-9)
      expect(Math.hypot(x, z)).toBeGreaterThan(SCENERY_CLEARANCE * 0.9)
    }
  })

  it('does not break with a span with no bulbs', () => {
    expect(garlandBulbs({ from: [0, 3, 0], to: [1, 3, 0], count: 0 })).toEqual([])
  })
})
