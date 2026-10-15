/**
 * The visual hints of Stick Rush in Godot (`Hints.tsx` of the web): what has to be done, shown
 * without a single letter. The **footprints** on the ground say where to stand —in the centre of
 * the hoop, facing the machine—; the **ghost stick**, a cylinder slightly fatter than the stick,
 * falls again and again from the front stick down to chest height, which is where they are going
 * to pass; and **the real controller** beside it, with the grab button throbbing, says what they
 * are grabbed with.
 *
 * **None of them stays on.** When each one lights up and goes off is decided by the script of the
 * web (`lib/hintScript.ts`) on the games' common engine (`lib/hints.ts`), both as they are, and
 * the dimensions are theirs (`FOOTPRINTS`, `ghostStick`, `ghostFall`, `controllerByTheStick`): here
 * it is only painted. Everything is mounted at once and lit with `visible` and the opacity.
 *
 * As on the web, **only with the headset on** (`showing`); `-- --ayudas` shows them flat.
 */
import { Node3D, Vector3, type MeshInstance3D, type StandardMaterial3D } from 'godot'

import { arcTriangles } from '@kit/lib/ui/icons'
import type { HandSide } from '@kit/lib/xr/hands'
import type { RealController } from '@kit/runtime/ui/controller'

import { HINT_MARK_COLOR, THROB, moveToward, advanceHints, throb, sweepPhase, noHints } from '@/lib/hints'
import {
  FALL,
  GHOST,
  HINT_SCRIPT,
  FOOTPRINT,
  FOOTPRINTS,
  FOOTPRINTS_Y,
  CONTROLLER_BY_THE_STICK,
  ghostFall,
  controllerByTheStick,
  ghostStick,
  type MachineHint,
  type HintFact,
} from '@/lib/hintScript'
import { TUTORIAL_BUTTONS } from '@/lib/tutorial'

import { cylinder, mesh, flatMesh, opacidad, withoutShadow, translucent } from '@kit/runtime/scene/parts'

/** How transparent each hint gets when fully lit (`OPACITY` of `Hints.tsx`). */
export const HINT_OPACITY = { ground: 0.75, stick: 0.6 } as const

/** Below this, a hint that is going off is no longer painted (the `0.004` of the web). */
const OFF_OPACITY = 0.004

/**
 * How much the footprints are raised above the ground: the web separates them by biasing the depth
 * (`polygonOffset`), which Godot does not have; they go on top with the priority of their material
 * and, in case the depth fights, two millimetres up.
 */
const DECAL_LIFT = 0.002

/** What the hints need to know each frame. */
export interface HintsMoment {
  /** With the headset on (or forced flat): without that, they are not shown and their deadlines do not run. */
  showing: boolean
  /** What has already happened: a stick caught, sticks about to fall. It accumulates here. */
  facts: Readonly<Record<HintFact, boolean>>
  /** The height of the hoop, from which the front stick hangs. */
  hoop: number
  hand: HandSide
  /** Without motion (`prefers-reduced-motion` on the web): it neither throbs nor falls. */
  still?: boolean
}

interface Part {
  node: MeshInstance3D
  material: StandardMaterial3D
}

export class GameHints {
  readonly node = new Node3D()
  private readonly state = noHints()
  private readonly strengths: Record<MachineHint, number> = { ground: 0, stick: 0, controller: 0 }
  private readonly facts: Record<HintFact, boolean> = { grab: false, falling: false }
  private readonly footprints: Part[] = []
  private readonly ghost: Part
  private readonly controllerPlacement = new Node3D()
  private clock = 0
  private placed = ''
  /** Whether none of them was visible in the last frame. */
  private allOff = false

  constructor(
    /** The space of the machine: the script is written relative to the centre of the hoop. */
    machine: Node3D,
    /** The real controller of each hand, beside the ghost stick (the kit's), or none. */
    readonly controllers: readonly RealController[] = [],
  ) {
    this.node.set_name('Hints')
    machine.add_child(this.node)
    FOOTPRINTS.forEach((h, i) => {
      // A footprint is an oval: the twelve-sided circle stretched along the foot.
      const material = translucent(HINT_MARK_COLOR, 0, 3)
      const node = mesh(flatMesh(arcTriangles(0, 1, 0, Math.PI * 2, 12)), material)
      node.set_name(`Footprint${i}`)
      node.position = new Vector3(h.x, FOOTPRINTS_Y + DECAL_LIFT, h.z)
      node.rotation = new Vector3(-Math.PI / 2, 0, 0)
      node.scale = new Vector3(FOOTPRINT.width / 2, FOOTPRINT.length / 2, 1)
      node.visible = false
      this.node.add_child(node)
      this.footprints.push({ node, material })
    })
    const material = translucent(HINT_MARK_COLOR, 0, 4)
    const stick = cylinder(GHOST.radius, GHOST.radius, GHOST.length, material, undefined, 12)
    stick.set_name('GhostStick')
    stick.visible = false
    this.node.add_child(stick)
    this.ghost = { node: stick, material }
    this.controllerPlacement.set_name('ControllerByTheStick')
    this.node.add_child(this.controllerPlacement)
    for (const controller of controllers) this.controllerPlacement.add_child(controller.nodo)
    // A hint is not scenery: it casts no shadow, as on the web.
    withoutShadow(this.node)
  }

  /** How much of each hint is visible right now, from 0 to 1. */
  get strength(): Readonly<Record<MachineHint, number>> {
    return this.strengths
  }

  /** Places the controller beside where the ghost stops, on the side of the hand. */
  private place(hoop: number, hand: HandSide): void {
    const key = `${hoop}:${hand}`
    if (key === this.placed) return
    this.placed = key
    const { position, turn } = controllerByTheStick(hoop, hand)
    this.controllerPlacement.position = new Vector3(position[0], position[1], position[2])
    this.controllerPlacement.rotation = new Vector3(0, turn, 0)
    const k = CONTROLLER_BY_THE_STICK.scale
    this.controllerPlacement.scale = new Vector3(k, k, k)
  }

  update(delta: number, moment: HintsMoment): void {
    this.clock += delta
    const { showing } = moment
    this.place(moment.hoop, moment.hand)
    // They accumulate: doing something is not undone.
    for (const h of Object.keys(this.facts) as HintFact[]) this.facts[h] = this.facts[h] || moment.facts[h]
    const step = advanceHints(HINT_SCRIPT, this.facts, this.state, showing ? delta : 0)
    const pulse = moment.still ? 1 : throb(this.clock, THROB.strength)
    let anyLit = false
    for (const hint of HINT_SCRIPT) {
      const wanted = showing && step.lit.has(hint.id) ? 1 : 0
      this.strengths[hint.id] = moveToward(this.strengths[hint.id], wanted, delta)
      if (this.strengths[hint.id] > OFF_OPACITY) anyLit = true
    }
    // All off and already hidden: nothing to paint, and the engine is not touched.
    if (!anyLit && this.allOff) return
    this.allOff = !anyLit
    const f = this.strengths

    // The footprints, throbbing: it is what sets them apart from one more paving stone of the square.
    for (const h of this.footprints) {
      h.node.visible = f.ground > OFF_OPACITY
      opacidad(h.material, f.ground * HINT_OPACITY.ground * pulse)
    }
    // The ghost stick, falling from the front one. It does not throb: it already moves.
    const sweep = moment.still ? { drop: FALL.travel / 2, visible: 1 } : ghostFall(sweepPhase(this.clock, FALL.period).progress)
    const [x, y, z] = ghostStick(moment.hoop)
    this.ghost.node.position = new Vector3(x, y - sweep.drop, z)
    this.ghost.node.visible = f.stick > OFF_OPACITY
    opacidad(this.ghost.material, f.stick * HINT_OPACITY.stick * sweep.visible)

    // The real controller of the dominant hand, with the grab throbbing.
    for (const controller of this.controllers) {
      if (f.controller > OFF_OPACITY && controller.mano === moment.hand) {
        controller.encender(TUTORIAL_BUTTONS.grab)
        controller.actualizar(delta)
      } else controller.apagar()
    }
  }

  /** What is really seen: the hints with something painted right now. */
  visible(): MachineHint[] {
    const visible: Record<MachineHint, boolean> = {
      ground: this.footprints.some((h) => h.node.visible),
      stick: this.ghost.node.visible,
      controller: this.controllers.some((m) => m.visible),
    }
    return HINT_SCRIPT.map((a) => a.id).filter((id) => visible[id])
  }
}
