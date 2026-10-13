import {
  GARLAND_POST_COUNT,
  GARLAND_POST_HEIGHT,
  GARLAND_RING_RADIUS,
  STALL_COUNT,
  STALL_RING_RADIUS,
  ringSlots,
  type Vec3,
} from './sceneryLayout'

/**
 * The pieces of the xrcade kit that make up the fairground: the stalls of the ring, the lampposts
 * the garlands hang from and a banner on each lamppost.
 *
 * They are from Kenney's Fantasy Town Kit (CC0; see `public/CREDITS.md`), prepared in the hall's
 * shared kit, and they are painted with one `InstancedMesh` per type: one draw call per
 * piece and not one per stall. Here there is only **where** each one goes, without three, so that
 * what matters when playing can be tested without a scene: that nothing gets into the player's
 * gap nor into the machine.
 *
 * The places are the fairground's (`sceneryLayout.ts`): the stalls, on the booth ring and
 * looking at the player; the lampposts, where the garland posts used to be, and the garlands
 * are still strung from tip to tip.
 */

/** The kit pieces the fairground uses; each one is `public/models/kit/<piece>.glb`. */
export const PIECES = ['puesto', 'farol', 'banderola'] as const

export type Piece = (typeof PIECES)[number]

/** Path of a piece inside `public/`, for `assetUrl`. */
export function piecePath(piece: Piece): string {
  return `models/kit/${piece}.glb`
}

/**
 * How tall each piece is in the fairground, in metres.
 *
 * - **Stall** (`puesto`), 2.8 m up to the tip of the awning: enough to read as a booth at
 *   six and a half metres, and low so that the Ferris wheel shows above it.
 * - **Lamp** (`farol`), the height of the garland posts: the stretches of bulbs hang
 *   from its tip, so it has to reach exactly there.
 * - **Banner** (`banderola`), one metre: it reads from the centre without covering the lamppost nor the bulbs.
 */
export const HEIGHTS: Record<Piece, number> = {
  puesto: 2.8,
  farol: GARLAND_POST_HEIGHT,
  banderola: 1,
}

/**
 * How much each model has to be turned so that its front ends up at +Z, which is where the
 * ring faces the pieces (see `ringSlots`). The banner is a cloth thin in X and wide in Z:
 * without the quarter turn, the player would see it edge-on.
 */
export const MODEL_TURN: Record<Piece, number> = {
  puesto: 0,
  farol: 0,
  banderola: -Math.PI / 2,
}

/**
 * Where the banner hangs from its lamppost: how far it comes forward towards the centre of the
 * fairground —just enough not to get into the post— and at what height its bottom edge ends up:
 * above the machine, so that it does not read as something of the game, and below the lamp.
 */
export const BANNER_ON_THE_LAMPPOST = { forward: 0.2, below: 2 } as const

/** A piece already placed. */
export interface Placement {
  piece: Piece
  /** Where the centre of the base of its box goes, in world metres. */
  position: Vec3
  /** Height of the box, from bottom to top, in metres. */
  height: number
  /** Turn about the vertical axis, in radians, that leaves the front of the model looking at the player. */
  turn: number
}

/** The whole fairground: six stalls, eight lampposts and their eight banners. */
export function placements(): Placement[] {
  const stalls = ringSlots(STALL_COUNT, STALL_RING_RADIUS).map(
    ({ position, rotationY }): Placement => ({
      piece: 'puesto',
      position,
      height: HEIGHTS.puesto,
      turn: rotationY + MODEL_TURN.puesto,
    }),
  )

  // Offset half a gap with respect to the stalls, as the posts were, so that they do not end up
  // right in front of one another.
  const lamppostSlots = ringSlots(GARLAND_POST_COUNT, GARLAND_RING_RADIUS, Math.PI / GARLAND_POST_COUNT)
  const lamps = lamppostSlots.map(
    ({ position, rotationY }): Placement => ({
      piece: 'farol',
      position,
      height: HEIGHTS.farol,
      turn: rotationY + MODEL_TURN.farol,
    }),
  )
  const banners = lamppostSlots.map(({ position: [x, y, z], rotationY }): Placement => {
    // Towards the centre: the lamppost is at `GARLAND_RING_RADIUS` and the centre, at the origin.
    const inward = BANNER_ON_THE_LAMPPOST.forward / GARLAND_RING_RADIUS
    return {
      piece: 'banderola',
      position: [x - x * inward, y + BANNER_ON_THE_LAMPPOST.below, z - z * inward],
      height: HEIGHTS.banderola,
      turn: rotationY + MODEL_TURN.banderola,
    }
  })

  return [...stalls, ...lamps, ...banners]
}

/**
 * The scale that leaves a piece at the requested height, given what its box measures in the model.
 *
 * The box of the model that arrives is measured and no number is noted here: if the kit remakes a
 * piece with another size, the fairground still measures the same.
 */
export function scaleFor(height: number, boxHeight: number): number {
  return height / boxHeight
}

/** The box of a model's vertices, in its units. */
export interface Box {
  min: Vec3
  max: Vec3
}

/**
 * How much the model has to be moved, in its units, so that the centre of the base of its box
 * ends up at its origin.
 *
 * Kenney's grid pieces are not centred: the banner is stuck to the edge of its
 * cell (x ≈ 0.4). Without this it would hang half a metre from its lamppost, and on a different
 * side depending on the turn.
 */
export function anchorAtBase({ min, max }: Box): Vec3 {
  return [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2]
}
