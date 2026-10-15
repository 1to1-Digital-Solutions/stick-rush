/**
 * The Stick Rush machine in Godot (`StickMachine.tsx` and `MachinePieces.tsx` of the web): a
 * horizontal semicircular hoop from which the sticks hang, mounted on a truss —the top ring,
 * uprights and zigzag diagonals— with its bulbs, and held up by two posts braced outwards and
 * backwards, with their feet.
 *
 * **The dimensions are those of the web**: the curve is `machinePoint` of `gameConfig.ts`, at the
 * hoop height the run gives (`hoopHeight.ts`), and the radii, segments and gaps are the numbers of
 * `StickMachine.tsx`, with their name beside them. Each family of pieces is a multimesh —the five
 * of `MachinePieces.tsx`, with their materials—, and the machine is rebuilt whole when the hoop
 * changes height, which only happens in the menu.
 *
 * The sticks do not belong here: they hang from the machine but belong to the run
 * (`world/sticks.ts`).
 */
import { Basis, Color, Node3D, Transform3D, Vector3, type MultiMeshInstance3D, type SphereMesh } from 'godot'

import { sphere } from '@kit/runtime/scene/shapes'
import { barBetween, cylinder, emissive, cylinderMesh, matte, multiMesh } from '@kit/runtime/scene/parts'

import {
  GROUND_Y,
  MACHINE_BULB_COLOR,
  MACHINE_FRAME_COLOR,
  MACHINE_STRIPE_COLORS,
  MACHINE_TRUSS_COLOR,
  machinePoint,
} from '@/lib/gameConfig'

/** A sphere of `radius` with `sides` × `rings` (`sphereGeometry`), to spread over a multimesh. */
function ball(radius: number, sides: number, rings: number): SphereMesh {
  const mesh = sphere(sides, rings)
  mesh.radius = radius
  mesh.height = radius * 2
  return mesh
}

/** Segments of the main hoop, in alternating stripes (`ARC_SEGMENTS`). */
export const ARC_SEGMENTS = 24
/** Vertical uprights between the main hoop and the top ring (`TRUSS_POSTS`). */
export const TRUSS_POSTS = 9
/** The thickness of the sticks' hoop (`TUBE_RADIUS`): it also lowers the hook of each stick. */
export const TUBE_RADIUS = 0.032
/** What separates the sticks' hoop from the top ring of the truss (`TRUSS_RISE`). */
export const TRUSS_RISE = 0.34

type Point = Vector3

function point(t: number, height: number, rise = 0): Point {
  const [x, y, z] = machinePoint(t, height)
  return new Vector3(x, y + rise, z)
}

/** How many there are of each family, for whoever wants to count them (the web counts it in `limits`). */
export interface MachinePieceCounts {
  matte: number
  frame: number
  truss: number
  bulbs: number
}

export class Machine {
  readonly node = new Node3D()
  private height: number | null = null
  private parts: Node3D | null = null
  private _pieces: MachinePieceCounts = { matte: 0, frame: 0, truss: 0, bulbs: 0 }

  // The materials of the five families (`MachinePieces.tsx`): they are created once and reused when
  // the machine is rebuilt, which that way does not compile any shader again.
  private readonly matteTube = matte('#ffffff', { rugosidad: 0.55, metal: 0.1 })
  private readonly frameTube = matte('#ffffff', { rugosidad: 0.35, metal: 0.7 })
  private readonly trussTube = matte('#ffffff', { rugosidad: 0.4, metal: 0.6 })
  private readonly bulbSocket = matte('#3b3630', { rugosidad: 0.6, metal: 0.5 })
  private readonly bulbGlass = emissive(MACHINE_BULB_COLOR, 1.8, { sinLuz: true })
  private readonly postFoot = matte(MACHINE_FRAME_COLOR, { rugosidad: 0.4, metal: 0.7 })
  private readonly braceFoot = matte(MACHINE_TRUSS_COLOR, { rugosidad: 0.45, metal: 0.6 })

  constructor(parent: Node3D) {
    this.node.set_name('Machine')
    parent.add_child(this.node)
  }

  get pieces(): MachinePieceCounts {
    return this._pieces
  }

  /** Mounts the machine at that hoop height; if it is already at that height, it touches nothing. */
  place(height: number): void {
    if (height === this.height) return
    this.height = height
    if (this.parts != null) {
      this.node.remove_child(this.parts)
      this.parts.queue_free()
    }
    this.parts = new Node3D()
    this.node.add_child(this.parts)
    this.mount(this.parts, height)
  }

  private mount(parts: Node3D, height: number): void {
    const tube = cylinderMesh(0.5, 0.5, 1, 10)
    const stripes: Transform3D[] = []
    const colors = []
    const truss: Transform3D[] = []
    // The sticks' hoop, striped, and the top ring, which closes the truss.
    for (let i = 0; i < ARC_SEGMENTS; i++) {
      const from = point(i / ARC_SEGMENTS, height)
      const to = point((i + 1) / ARC_SEGMENTS, height)
      stripes.push(barBetween(from, to, TUBE_RADIUS))
      colors.push(Color.html(MACHINE_STRIPE_COLORS[i % MACHINE_STRIPE_COLORS.length]))
      truss.push(barBetween(point(i / ARC_SEGMENTS, height, TRUSS_RISE), point((i + 1) / ARC_SEGMENTS, height, TRUSS_RISE), 0.02))
    }
    // Uprights and zigzag diagonals.
    for (let i = 0; i < TRUSS_POSTS; i++) {
      const base = point(i / (TRUSS_POSTS - 1), height)
      truss.push(barBetween(base, Vector3.ADD(base, new Vector3(0, TRUSS_RISE, 0)), 0.013))
      if (i < TRUSS_POSTS - 1) {
        const next = point((i + 1) / (TRUSS_POSTS - 1), height)
        truss.push(
          i % 2 === 0
            ? barBetween(base, Vector3.ADD(next, new Vector3(0, TRUSS_RISE, 0)), 0.013)
            : barBetween(Vector3.ADD(base, new Vector3(0, TRUSS_RISE, 0)), next, 0.013),
        )
      }
    }
    // The posts, spread outwards and backwards so as not to block the way of whoever plays, and
    // their brace.
    const posts: Transform3D[] = []
    for (const side of [0, 1]) {
      const top = point(side, height, TRUSS_RISE)
      const foot = new Vector3(top.x * 1.9, GROUND_Y, top.z + 0.45)
      const braceFoot = new Vector3(top.x * 2.3, GROUND_Y, top.z + 1.05)
      posts.push(barBetween(foot, top, 0.042))
      truss.push(barBetween(braceFoot, point(side, height, TRUSS_RISE * 0.35), 0.019))
      parts.add_child(cylinder(0.13, 0.16, 0.04, this.postFoot, new Vector3(foot.x, GROUND_Y + 0.025, foot.z), 20))
      parts.add_child(cylinder(0.075, 0.095, 0.032, this.braceFoot, new Vector3(braceFoot.x, GROUND_Y + 0.02, braceFoot.z), 16))
    }
    // The bulbs on the top ring, each one with its socket.
    const sockets: Transform3D[] = []
    const bulbs: Transform3D[] = []
    for (let i = 0; i < TRUSS_POSTS - 1; i++) {
      const p = point((i + 0.5) / (TRUSS_POSTS - 1), height)
      sockets.push(new Transform3D(Basis.IDENTITY, Vector3.ADD(p, new Vector3(0, TRUSS_RISE + 0.03, 0))))
      bulbs.push(new Transform3D(Basis.IDENTITY, Vector3.ADD(p, new Vector3(0, TRUSS_RISE + 0.085, 0))))
    }

    const families: MultiMeshInstance3D[] = [
      multiMesh(tube, this.matteTube, stripes, colors),
      multiMesh(tube, this.frameTube, posts, posts.map(() => Color.html(MACHINE_FRAME_COLOR))),
      multiMesh(tube, this.trussTube, truss, truss.map(() => Color.html(MACHINE_TRUSS_COLOR))),
      multiMesh(cylinderMesh(0.012, 0.015, 0.038, 8), this.bulbSocket, sockets),
      multiMesh(ball(0.024, 14, 14), this.bulbGlass, bulbs),
    ]
    for (const family of families) parts.add_child(family)
    this._pieces = { matte: stripes.length, frame: posts.length, truss: truss.length, bulbs: bulbs.length }
  }
}
