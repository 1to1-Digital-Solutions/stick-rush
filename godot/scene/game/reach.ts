/**
 * Which stick the hand or the mouse touches: the part of the web's pointers
 * (`@pmndrs/pointer-events`) that Godot does not have, as engine-free arithmetic.
 *
 * - **With the hand** (`grab`): on the web, a sphere in the fist (`DefaultXRControllerGrabPointer`)
 *   that fires `pointerdown` on what it touches when the side trigger is **squeezed**. The same
 *   here: on squeezing, the stick whose body lies within the radius of that sphere from the centre
 *   of the fist; if there are several, the nearest, which is the one the web's pointer picks.
 * - **With the mouse**: the camera's ray against the cylinder of each stick; the first one it
 *   crosses wins, like three's `raycast`.
 *
 * The body of the stick is taken as a segment with the thickness of the stick (`STICK_RADIUS`): the
 * capsule that wraps it, which at the tips goes half a thickness beyond what the cylinder is.
 */
import { STICK_RADIUS } from '@/lib/gameConfig'

import { stickBody, type Stick, type Vec3 } from './round'

/**
 * The radius of the controller's grab sphere on the web (`CONTROLLER_GRAB_RADIUS` in
 * `components/xr/XRController.tsx`, which is React and cannot be imported here): 9 cm, a bit more
 * than the library's default 7, because the stick is thin and falls.
 */
export const GRAB_RADIUS = 0.09

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function length(a: Vec3): number {
  return Math.sqrt(dot(a, a))
}

/** The distance from a point to the segment `a`–`b`. */
export function distanceToSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = subtract(b, a)
  const l2 = dot(ab, ab)
  const t = l2 > 0 ? Math.min(1, Math.max(0, dot(subtract(p, a), ab) / l2)) : 0
  return length(subtract(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]))
}

/**
 * The closest a ray (origin `o`, direction `d`, unit length) and the segment `a`–`b` get, and at
 * what distance from the ray's origin: the closest points of two lines, with the segment's one
 * inside it and the ray's one ahead of its origin. A parallel ray and stick are resolved from the
 * top tip.
 */
export function rayAgainstSegment(o: Vec3, d: Vec3, a: Vec3, b: Vec3): { distance: number; along: number } {
  const u = subtract(b, a)
  const w = subtract(a, o)
  const uu = dot(u, u)
  const ud = dot(u, d)
  const uw = dot(u, w)
  const dw = dot(d, w)
  // With a unit `d`: the segment at `a + s·u`, the ray at `o + t·d`.
  const det = uu - ud * ud
  let s = det > 1e-12 ? (ud * dw - uw) / det : 0
  s = Math.min(1, Math.max(0, s))
  const q: Vec3 = [a[0] + u[0] * s, a[1] + u[1] * s, a[2] + u[2] * s]
  const along = Math.max(0, dot(subtract(q, o), d))
  const nearest: Vec3 = [o[0] + d[0] * along, o[1] + d[1] * along, o[2] + d[2] * along]
  return { distance: length(subtract(q, nearest)), along }
}

/** The stick that a hand closed at `fist` (in the machine's space) catches, or `null`. */
export function stickInHand(sticks: readonly Stick[], fist: Vec3, radius = GRAB_RADIUS): Stick | null {
  let chosen: Stick | null = null
  let nearest = Infinity
  for (const stick of sticks) {
    const { top, bottom } = stickBody(stick)
    const d = distanceToSegment(fist, top, bottom)
    if (d <= radius + STICK_RADIUS && d < nearest) {
      chosen = stick
      nearest = d
    }
  }
  return chosen
}

/** The stick the mouse's ray crosses (in the machine's space), the first one, or `null`. */
export function stickOnRay(sticks: readonly Stick[], origin: Vec3, direction: Vec3): Stick | null {
  let chosen: Stick | null = null
  let first = Infinity
  for (const stick of sticks) {
    const { top, bottom } = stickBody(stick)
    const { distance, along } = rayAgainstSegment(origin, direction, top, bottom)
    if (distance <= STICK_RADIUS && along < first) {
      chosen = stick
      first = along
    }
  }
  return chosen
}
