import { GROUND_Y } from './gameConfig'

/**
 * Fairground that surrounds the player when the scenery is on.
 *
 * Up to here the scenery was only the HDRI: a photo of a square at night
 * wrapping the scene. From afar it works, but in the headset it gives itself away as
 * soon as the player moves their head —a photo has no parallax— and the machine
 * ends up planted in the middle of nowhere. This adds volume around: stalls,
 * garlands of bulbs and a Ferris wheel at the back, with the photo behind acting as
 * sky and as light.
 *
 * Here lives **where** each thing goes, which is what can spoil the run
 * (scenery inside the arm's reach, bulbs at face height), and
 * that is why it is tested apart. The components only draw.
 */

export type Vec3 = [number, number, number]

/**
 * Free radius around the player: not a single part of the
 * scenery goes in there. The machine, with its splayed posts and its braces, reaches ~1.7 m
 * (the foot of the strut, see `legs` in `StickMachine`); the rest is room to
 * move and so that nothing appears right up against the face on turning round.
 */
export const SCENERY_CLEARANCE = 3

/**
 * Stalls of the fairground, laid out in a circle looking at the player. How much they measure
 * is said by their kit piece (`fairKit.ts`).
 */
export const STALL_COUNT = 6
export const STALL_RING_RADIUS = 6.4

/**
 * Garlands of bulbs: lamp posts in a circle, nearer than the stalls, with a
 * span hanging between each two. They are what turns a vacant lot with stalls
 * into a fairground: they close the space from above without covering the sky.
 */
export const GARLAND_POST_COUNT = 8
export const GARLAND_RING_RADIUS = 4.6
export const GARLAND_POST_HEIGHT = 3.4
/** How much the midpoint of the span drops relative to the posts. */
export const GARLAND_SAG = 0.5
export const GARLAND_BULBS_PER_SPAN = 7

/**
 * Ferris wheel at the back, outside the fairground: it gives scale and depth, which is exactly
 * what a background photo cannot give. It goes offset from the front so as not to end up
 * behind the machine, and high enough to peek over the
 * booths.
 */
export const WHEEL_CENTER: Vec3 = [-7.4, 7.4, -10.6]
export const WHEEL_RADIUS = 5.6
export const WHEEL_CABIN_COUNT = 12
/**
 * How much the **centre** of a cabin drops below the point of the ring it
 * hangs from. What grazes the floor is its bottom, half a gondola further down.
 */
export const WHEEL_CABIN_DROP = 1.05
/** Height of the gondola of a cabin. */
export const WHEEL_CABIN_HEIGHT = 0.6
/** Turning speed in radians per second: one turn every ~85 s. */
export const WHEEL_SPEED = 0.074

/** Turn in Y that leaves whatever is at `position` looking at the centre of the fairground. */
export function facingRotationY([x, , z]: Vec3): number {
  // The front of a part is its local +Z, and a turn of `angle` takes it to
  // (sin, cos). Half a turn more and it points the other way: towards the centre.
  return Math.atan2(x, z) + Math.PI
}

/** Slot of a part of the fairground: where it is planted and which way it faces. */
export interface RingSlot {
  /** Point of the ring, at floor level. */
  position: Vec3
  /** Turn in Y that leaves the part looking at the player. */
  rotationY: number
}

/**
 * Lays out `count` parts in a ring around the player, all facing them.
 *
 * The ring is travelled from `startAngle`, which is what allows turning the
 * booths relative to the posts of the garlands so that they do not end up right
 * behind one another.
 */
export function ringSlots(
  count: number,
  radius: number,
  startAngle = 0,
): RingSlot[] {
  return Array.from({ length: Math.max(count, 0) }, (_, index) => {
    const angle = startAngle + (index / count) * Math.PI * 2
    const position: Vec3 = [
      Math.sin(angle) * radius,
      GROUND_Y,
      Math.cos(angle) * radius,
    ]
    return { position, rotationY: facingRotationY(position) }
  })
}

/**
 * Bulbs of a span of garland hung between two posts.
 *
 * The curve is a parabola and not a real catenary: at this distance one cannot be
 * told from the other, and the parabola is read at a glance. The ends carry
 * no bulb —the tip of the post is there— so they are laid out inside
 * the span.
 */
export function garlandBulbs({
  from,
  to,
  count = GARLAND_BULBS_PER_SPAN,
  sag = GARLAND_SAG,
}: {
  from: Vec3
  to: Vec3
  count?: number
  sag?: number
}): Vec3[] {
  return Array.from({ length: Math.max(count, 0) }, (_, index) => {
    const t = (index + 1) / (count + 1)
    // 4t(1−t) is worth 0 at the posts and 1 at the centre of the span.
    const drop = sag * 4 * t * (1 - t)
    return [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t - drop,
      from[2] + (to[2] - from[2]) * t,
    ]
  })
}
