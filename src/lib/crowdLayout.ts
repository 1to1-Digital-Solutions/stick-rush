import { GROUND_Y } from './gameConfig'
import { facingRotationY, GARLAND_RING_RADIUS, STALL_RING_RADIUS, type Vec3 } from './sceneryLayout'

/**
 * Where the fairground's crowd is.
 *
 * The fairground had a Ferris wheel and stalls but nobody inside. The crowd are
 * silhouettes —a body and a head, no face— spread over a ring between the
 * garland posts and the stalls, all looking at the machine. They are placed
 * with a bit of disorder so they do not look like a fence, and the disorder
 * comes from a hash and not from `Math.random`: the same fairground has the same
 * people every time it is mounted, which is what lets it be measured.
 */

/** How many figures. They are instanced: they are one draw call whether 10 or 100. */
export const CROWD_COUNT = 42
/** The ring it is spread over, halfway between garlands and stalls. */
export const CROWD_RING_RADIUS = (GARLAND_RING_RADIUS + STALL_RING_RADIUS) / 2
/** How far each figure strays from the ring, inwards or outwards, in metres. */
export const CROWD_RING_JITTER = 0.55
/** Height of the shortest figure and of the tallest, as a scale of the silhouette. */
export const CROWD_HEIGHT_RANGE: readonly [number, number] = [0.88, 1.12]

export interface CrowdSpot {
  position: Vec3
  /** Rotation in Y that leaves it looking at the machine. */
  rotationY: number
  /** Vertical scale: height relative to the base silhouette. */
  height: number
  /** Its own phase of the sway, so they do not all move at once. */
  phase: number
  /** Which shade of the palette it wears (index, to be spread with `%`). */
  shade: number
}

/** A value between 0 and 1 from an integer and a salt that separates uses. */
export function crowdHash(value: number, salt: number): number {
  let x = (value * 0x9e3779b1 + salt * 0x85ebca6b) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0
  x = (x ^ (x >>> 15)) >>> 0
  return x / 0x100000000
}

export function crowdSpots(count = CROWD_COUNT, radius = CROWD_RING_RADIUS): CrowdSpot[] {
  return Array.from({ length: Math.max(count, 0) }, (_, index) => {
    // Spread over the ring with a bit of slack in the angle: two figures
    // can end up together, like people, but never in the same place.
    const step = (Math.PI * 2) / Math.max(count, 1)
    const angle = index * step + (crowdHash(index, 1) - 0.5) * step * 0.8
    const distance = radius + (crowdHash(index, 2) - 0.5) * 2 * CROWD_RING_JITTER
    const position: Vec3 = [Math.sin(angle) * distance, GROUND_Y, Math.cos(angle) * distance]
    const [low, high] = CROWD_HEIGHT_RANGE
    return {
      position,
      rotationY: facingRotationY(position),
      height: low + crowdHash(index, 3) * (high - low),
      phase: crowdHash(index, 4) * Math.PI * 2,
      shade: Math.floor(crowdHash(index, 5) * 1024),
    }
  })
}
