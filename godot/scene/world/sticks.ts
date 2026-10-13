/**
 * The painted sticks (`Stick.tsx` of the web): the cord each one hangs from while it hangs, the
 * stick of wood painted yellow —with the relief and the roughness of the web's wood and without
 * its colour, which left it brown— and the green ring of the catch. And the hook of each stick on
 * the hoop (`StickMachine.tsx`).
 *
 * What decides where each stick is and how it is doing is `game/round.ts`; here it is only taken
 * to the nodes:
 *
 * - **on catching it** the stick turns green at once, lights up, grows by half and fades while the
 *   ring leaves from where it was and opens up;
 * - **on missing it** it stays on the ground and is tinted red, so that the ground counts the
 *   misses.
 *
 * There are thirteen of each thing, as many as fit (`MAX_STICKS`), mounted at once: a round with
 * fewer hides the spare ones. Each stick carries its own material (the flash is its own), all of
 * the same type, so none compiles a new shader on being caught: **transparent from the start**,
 * as on the web, because changing it on the fly recompiles right at the flash.
 */
import {
  BaseMaterial3D,
  Color,
  Node3D,
  ResourceLoader,
  StandardMaterial3D,
  Texture2D,
  Vector3,
  type MeshInstance3D,
} from 'godot'

import {
  MACHINE_FRAME_COLOR,
  MAX_STICKS,
  STICK_CAUGHT_COLOR,
  STICK_COLOR,
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_MISSED_COLOR,
  STICK_RADIUS,
  WOOD_TEXTURES,
} from '@/lib/gameConfig'

import { STICK_BEHIND_MENU, opacityToward, stickCoversMenu } from '@/lib/xrLayout'

import type { Stick, Round } from '../game/round'
import { TUBE_RADIUS } from './machine'
import { cylinder, mesh, torusMesh, matte, opacidad, translucent } from '@kit/runtime/scene/parts'

/** Where the maps of the wood travel in the package (`public/textures/` of the web). */
export const TEXTURES_DIR = 'res://games/stick-rush/texturas'

/** The file of each map of `WOOD_TEXTURES`, in the package. */
export function texturePath(path: string): string {
  return `${TEXTURES_DIR}/${path.split('/').pop()}`
}

const BASE = Color.html(STICK_COLOR)
const GREEN = Color.html(STICK_CAUGHT_COLOR)
const RED = Color.html(STICK_MISSED_COLOR)

interface PaintedStick {
  group: Node3D
  cord: MeshInstance3D
  body: MeshInstance3D
  material: StandardMaterial3D
  ring: MeshInstance3D
  ringMaterial: StandardMaterial3D
  hook: MeshInstance3D
  /** The last thing that was painted on it, so as not to touch the engine if it has not changed. */
  painted: string
  /** How much of the hanging stick is visible: 1 whole, `STICK_BEHIND_MENU` with the menu behind. */
  veil: number
  placement: string
}

function wood(): StandardMaterial3D {
  const m = matte(STICK_COLOR, { rugosidad: 0.75, metal: 0 })
  const normal = ResourceLoader.load(texturePath(WOOD_TEXTURES.normalMap))
  const roughness = ResourceLoader.load(texturePath(WOOD_TEXTURES.roughnessMap))
  if (normal instanceof Texture2D) {
    m.normal_enabled = true
    m.normal_texture = normal
    m.normal_scale = 0.8
  }
  if (roughness instanceof Texture2D) {
    m.roughness_texture = roughness
    // three reads the roughness from the green channel.
    m.roughness_texture_channel = BaseMaterial3D.TextureChannel.TEXTURE_CHANNEL_GREEN
  }
  // The grain runs along the stick, much longer than it is wide (`repeat.set(1, 3)`).
  m.uv1_scale = new Vector3(1, 3, 1)
  // Able to light up and transparent from the start: enabling it at the flash would recompile.
  m.emission_enabled = true
  m.emission = BASE
  m.emission_energy_multiplier = 0
  m.transparency = BaseMaterial3D.Transparency.TRANSPARENCY_ALPHA_DEPTH_PRE_PASS
  return m
}

export class PaintedSticks {
  readonly node = new Node3D()
  private readonly painted: PaintedStick[] = []

  constructor(parent: Node3D) {
    this.node.set_name('Sticks')
    parent.add_child(this.node)
    const cordMaterial = matte('#4a4038', { rugosidad: 0.9, metal: 0.1 })
    const hookMaterial = matte(MACHINE_FRAME_COLOR, { rugosidad: 0.3, metal: 0.8 })
    for (let i = 0; i < MAX_STICKS; i++) {
      const group = new Node3D()
      group.set_name(`Stick${i}`)
      const cord = cylinder(0.005, 0.005, STICK_CORD_LENGTH, cordMaterial, new Vector3(0, -STICK_CORD_LENGTH / 2, 0), 6)
      const material = wood()
      const body = cylinder(STICK_RADIUS, STICK_RADIUS, STICK_LENGTH, material, new Vector3(0, -STICK_CORD_LENGTH - STICK_LENGTH / 2, 0), 16)
      const ringMaterial = translucent(STICK_CAUGHT_COLOR, 0, 2)
      const ring = mesh(torusMesh(0.05, 0.006, 24, 6), ringMaterial, new Vector3(0, -STICK_CORD_LENGTH - STICK_LENGTH / 2, 0))
      ring.visible = false
      group.add_child(cord)
      group.add_child(body)
      group.add_child(ring)
      // The hook, a ring fastened to the hoop: it goes with the stick and does not swing with it.
      const hook = mesh(torusMesh(0.022, 0.006, 16, 8), hookMaterial)
      group.visible = false
      hook.visible = false
      this.node.add_child(group)
      this.node.add_child(hook)
      this.painted.push({ group, cord, body, material, ring, ringMaterial, hook, painted: '', placement: '', veil: 1 })
    }
  }

  /** The body of a stick, for whoever wants to know where it is painted (the tests). */
  body(index: number): MeshInstance3D {
    return this.painted[index].body
  }

  /**
   * Paints the round: each stick in its place and with its look; those that are not of the round, out.
   *
   * `inMenu`: the menu column ends up behind the sticks of that side, which dim while choosing and
   * come back little by little on pressing Play (`stickCoversMenu`, like `Stick.tsx`).
   */
  paint(round: Round | null, delta = 0, inMenu = false): void {
    const sticks = round?.sticks ?? []
    this.painted.forEach((p, i) => {
      const stick = sticks[i]
      const visible = stick != null && stick.visible
      if (p.group.visible !== visible) p.group.visible = visible
      if (p.hook.visible !== (stick != null)) p.hook.visible = stick != null
      if (stick == null) return
      const target = inMenu && stick.state === 'hanging' && stickCoversMenu(stick.layout.anchor) ? STICK_BEHIND_MENU : 1
      if (p.veil !== target) p.veil = stick.state === 'hanging' ? opacityToward(p.veil, target, delta) : 1
      this.paintOne(p, stick)
    })
  }

  private paintOne(p: PaintedStick, stick: Stick): void {
    const [x, ay, z] = stick.layout.anchor
    // The node is only touched if it has moved: thirteen still sticks in the menu cost nothing.
    const placement = `${x}:${ay}:${z}:${stick.y}:${stick.tilt.x}:${stick.tilt.z}`
    if (placement !== p.placement) {
      p.placement = placement
      p.group.position = new Vector3(x, stick.y, z)
      p.group.rotation = new Vector3(stick.tilt.x, 0, stick.tilt.z)
      p.hook.position = new Vector3(x, ay - TUBE_RADIUS - 0.012, z)
    }
    const hanging = stick.state === 'hanging' && p.veil >= 1
    if (p.cord.visible !== hanging) p.cord.visible = hanging
    // What does not change frame by frame is painted only on changing: the flash, the tint and the veil.
    const key = `${stick.state}:${stick.flash.toFixed(3)}:${stick.missTint.toFixed(3)}:${p.veil.toFixed(3)}`
    if (key === p.painted) return
    p.painted = key
    const m = p.material
    if (stick.state === 'caught') {
      // The green comes in at once: the flash is already the confirmation.
      const t = stick.flash
      const k = 1 + (1 - t) * 0.5
      p.group.scale = new Vector3(k, k, k)
      m.albedo_color = new Color(GREEN.r, GREEN.g, GREEN.b, Math.min(t * 1.6, 1))
      m.emission = GREEN
      m.emission_energy_multiplier = t * 2.4
      p.ring.visible = t > 0
      const r = 0.3 + (1 - t) * 2.6
      p.ring.scale = new Vector3(r, r, r)
      opacidad(p.ringMaterial, t * 0.7)
      return
    }
    p.group.scale = Vector3.ONE
    p.ring.visible = false
    if (stick.state === 'missed') {
      const k = stick.missTint
      m.albedo_color = new Color(BASE.r + (RED.r - BASE.r) * k, BASE.g + (RED.g - BASE.g) * k, BASE.b + (RED.b - BASE.b) * k, 1)
      m.emission = RED
      m.emission_energy_multiplier = 0.35 * k
      return
    }
    m.albedo_color = new Color(BASE.r, BASE.g, BASE.b, p.veil)
    m.emission = BASE
    m.emission_energy_multiplier = 0
  }
}
