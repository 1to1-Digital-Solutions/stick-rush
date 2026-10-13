// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  HEIGHTS,
  BANNER_ON_THE_LAMPPOST,
  MODEL_TURN,
  PIECES,
  anchorAtBase,
  placements,
  scaleFor,
  piecePath,
  type Box,
  type Piece,
} from './fairKit'
import { GROUND_Y, MACHINE_HEIGHT } from './gameConfig'
import {
  GARLAND_POST_COUNT,
  GARLAND_POST_HEIGHT,
  GARLAND_RING_RADIUS,
  SCENERY_CLEARANCE,
  STALL_COUNT,
  STALL_RING_RADIUS,
  facingRotationY,
} from './sceneryLayout'

/**
 * The kit pieces in the fairground: that the models are what they are believed to be, and that
 * placed at their size none gets into the player's gap.
 *
 * The measurements come from the real `.glb` files, read from their header: if the kit remakes a
 * wider piece, this goes off before a stall gets into where the player moves their arms.
 */

const PUBLIC = join(import.meta.dirname, '../../public')

/** The box of the vertices of the only mesh of a `.glb`, read from its JSON header. */
function boxOf(piece: Piece): Box {
  const glb = readFileSync(join(PUBLIC, piecePath(piece)))
  const length = glb.readUInt32LE(12)
  const gltf = JSON.parse(glb.subarray(20, 20 + length).toString('utf8')) as {
    meshes: { primitives: { attributes: { POSITION: number } }[] }[]
    accessors: Box[]
  }
  expect(gltf.meshes, `${piece} brings more than one mesh`).toHaveLength(1)
  expect(gltf.meshes[0].primitives, `${piece} brings more than one primitive`).toHaveLength(1)
  return gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION]
}

/** How far the piece reaches from its support point, at its size in the fairground and seen from above. */
function overhangOf(piece: Piece): number {
  const { min, max } = boxOf(piece)
  const scale = scaleFor(HEIGHTS[piece], max[1] - min[1])
  return (Math.hypot(max[0] - min[0], max[2] - min[2]) / 2) * scale
}

/** Where the local +Z of a piece turned by `turn` faces, in the world. */
function front(turn: number): [number, number] {
  return [Math.sin(turn), Math.cos(turn)]
}

describe('the kit pieces', () => {
  it.each(PIECES)('%s is in public/ and is a single mesh', (piece) => {
    expect(existsSync(join(PUBLIC, piecePath(piece)))).toBe(true)
    const { min, max } = boxOf(piece)
    expect(max[1] - min[1]).toBeGreaterThan(0)
  })

  it('the banner is a cloth: thin in X and wide in Z, which is what its quarter turn rotates', () => {
    const { min, max } = boxOf('banderola')
    expect(max[0] - min[0]).toBeLessThan((max[2] - min[2]) / 4)
  })
})

describe('the fairground', () => {
  const all = placements()
  const of = (piece: Piece) => all.filter((c) => c.piece === piece)

  it('puts one stall per booth, and one lamppost and one banner per post', () => {
    expect(of('puesto')).toHaveLength(STALL_COUNT)
    expect(of('farol')).toHaveLength(GARLAND_POST_COUNT)
    expect(of('banderola')).toHaveLength(GARLAND_POST_COUNT)
    for (const { piece, height } of all) expect(height).toBe(HEIGHTS[piece])
  })

  it('plants the stalls on their ring and the lampposts on the garlands\' one', () => {
    for (const { position: [x, y, z] } of of('puesto')) {
      expect(Math.hypot(x, z)).toBeCloseTo(STALL_RING_RADIUS, 6)
      expect(y).toBe(GROUND_Y)
    }
    for (const { position: [x, y, z] } of of('farol')) {
      expect(Math.hypot(x, z)).toBeCloseTo(GARLAND_RING_RADIUS, 6)
      expect(y).toBe(GROUND_Y)
    }
  })

  it('the lamppost reaches exactly where the garlands are hung', () => {
    expect(HEIGHTS.farol).toBe(GARLAND_POST_HEIGHT)
  })

  it('no stall nor lamppost gets into the player\'s gap', () => {
    for (const { piece, position: [x, , z] } of all) {
      expect(Math.hypot(x, z) - overhangOf(piece), piece).toBeGreaterThanOrEqual(
        SCENERY_CLEARANCE,
      )
    }
  })

  it('each piece looks at the player, with the turn proper to its model', () => {
    for (const { piece, position, turn } of all) {
      const [fx, fz] = front(turn - MODEL_TURN[piece])
      const [ex, ez] = front(facingRotationY(position))
      expect(fx * ex + fz * ez, piece).toBeCloseTo(1, 6)
    }
  })

  it('hangs each banner from its lamppost, in front and above the machine', () => {
    const lamps = of('farol')
    of('banderola').forEach(({ position: [x, y, z] }, index) => {
      const [fx, , fz] = lamps[index].position
      // In front: between the lamppost and the centre, by how far it comes forward.
      expect(Math.hypot(fx, fz) - Math.hypot(x, z)).toBeCloseTo(BANNER_ON_THE_LAMPPOST.forward, 6)
      expect(Math.atan2(x, z)).toBeCloseTo(Math.atan2(fx, fz), 6)
      // Above the machine and below the tip, where the garlands come out from.
      expect(y).toBeGreaterThan(MACHINE_HEIGHT)
      expect(y + HEIGHTS.banderola).toBeLessThan(GARLAND_POST_HEIGHT)
    })
  })
})

describe('scaleFor', () => {
  it('takes the box of the model to the requested height', () => {
    expect(scaleFor(2.8, 1.4)).toBeCloseTo(2)
    expect(scaleFor(0.5, 0.25)).toBeCloseTo(2)
  })
})

describe('anchorAtBase', () => {
  it('takes the centre of the base of the box to the origin', () => {
    expect(anchorAtBase({ min: [0.375, 0.16, -0.25], max: [0.425, 1, 0.25] })).toEqual([
      -0.4, -0.16, -0,
    ])
    expect(anchorAtBase({ min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] })).toEqual([-0, -0, -0])
  })
})
