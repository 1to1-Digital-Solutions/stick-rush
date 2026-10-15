/**
 * The Stick Rush fairground in Godot (`Fairground.tsx` and what it mounts, and the scenery of
 * `GameWorld`): the night square of the HDRI as the background, which also gives the reflections;
 * the lights of the web —the warm spot over the machine and the cold fill from behind—; and around
 * it, the venue:
 *
 * - **the pieces of the asset kit** (`fairKit.ts`): the six stalls of the ring, the eight lampposts
 *   and a banner on each one, loaded from `public/models/kit/` as they are (the colour goes in the
 *   vertices) where `placements()` puts them, one multimesh per piece;
 * - **the garlands** of bulbs between lamppost and lamppost (`garlandBulbs`, `sceneryLayout.ts`);
 * - **the crowd** (`crowdLayout.ts`): forty-two silhouettes —body and head in a single mesh— in
 *   their ring, looking at the machine, which sway higher and faster with the streak (`crowdBob`,
 *   `crowdTempo`). The swaying goes in the shader, as on the web it goes in a single draw call: the
 *   scene only passes it the streak and the clock;
 * - **the Ferris wheel** (`FerrisWheel.tsx`): its two rims, twelve spokes, twelve cabins that do not
 *   turn with it and the bulbs of the outline, turning slowly;
 * - and **the bulbs come alive with the streak** (`fairMood.ts`): they get brighter and, from five
 *   sticks in a row, they throb towards white. The material of the whole family is touched.
 *
 * **Your room** (`xrcade:scenery`) hides the venue and the background —it does not unmount them—
 * and leaves the machine: only with augmented reality in the headset (`showsPlace`), as on the web.
 */
import {
  ArrayMesh,
  BaseMaterial3D,
  Basis,
  BoxMesh,
  CapsuleMesh,
  Color,
  DirectionalLight3D,
  Environment,
  Mesh,
  MeshInstance3D,
  MultiMesh,
  MultiMeshInstance3D,
  Node,
  Node3D,
  OmniLight3D,
  PackedVector3Array,
  PackedScene,
  PanoramaSkyMaterial,
  ResourceLoader,
  Shader,
  ShaderMaterial,
  Sky,
  Texture2D,
  Transform3D,
  Vector3,
  WorldEnvironment,
  type SphereMesh,
  type StandardMaterial3D,
} from 'godot'

import { backgroundColor } from '@kit/runtime/scene/environment'
import { sphere } from '@kit/runtime/scene/shapes'
import { barBetween, torusMesh, cylinderMesh, mesh, matte, multiMesh, withoutShadow } from '@kit/runtime/scene/parts'

import { crowdSpots } from '@/lib/crowdLayout'
import { bulbGlow, bulbPulse, crowdBob, crowdTempo } from '@/lib/fairMood'
import { PIECES, placements, scaleFor, type Piece } from '@/lib/fairKit'
import {
  BACKDROP_COLOR,
  CROWD_SHADES,
  GROUND_Y,
  MACHINE_BULB_COLOR,
  MACHINE_HEIGHT,
  MACHINE_RADIUS,
  MACHINE_STRIPE_COLORS,
  MACHINE_TRUSS_COLOR,
  PARTY_BULB_COLOR,
} from '@/lib/gameConfig'
import {
  GARLAND_POST_COUNT,
  GARLAND_POST_HEIGHT,
  GARLAND_RING_RADIUS,
  WHEEL_CABIN_COUNT,
  WHEEL_CABIN_DROP,
  WHEEL_CABIN_HEIGHT,
  WHEEL_CENTER,
  WHEEL_RADIUS,
  WHEEL_SPEED,
  facingRotationY,
  garlandBulbs,
  ringSlots,
} from '@/lib/sceneryLayout'

/** A sphere of `radius` with `sides` × `rings` (`sphereGeometry`), to spread over a multimesh. */
function ball(radius: number, sides: number, rings: number): SphereMesh {
  const sphereMesh = sphere(sides, rings)
  sphereMesh.radius = radius
  sphereMesh.height = radius * 2
  return sphereMesh
}

/** Where the pieces of the kit travel in the package (`public/models/kit/` of the web). */
export const FAIRGROUND_DIR = 'res://games/stick-rush/feria'
/** The HDRI of the night square (`HDRI_PATH`), in the package. */
export const SKY_PATH = 'res://games/stick-rush/hdri/plaza_pueblo_1k.exr'

/**
 * From the intensities of three to those of Godot. They are not the same unit —three spreads the
 * spot's over the distance in candelas and applies its tone curve; Godot, its energy and its own—,
 * so they go with one scale per light, set by eye on the screenshots of the port. What is not
 * touched is the proportion between the lights of the web.
 */
export const ENERGY_PER_UNIT = { spot: 0.16, fill: 1.2, sky: 0.55, ambient: 1 } as const

/** The lights of `GameWorld.tsx`: the warm spot over the machine and the cold fill from behind. */
export const LIGHTS = {
  ambient: 0.35,
  spot: { position: [0, MACHINE_HEIGHT + 1, -MACHINE_RADIUS * 0.4] as const, intensity: 16, color: '#ffd479', range: 10 },
  fill: { position: [2.5, 4, 3] as const, intensity: 0.35, color: '#9fb6d6' },
  /** `environmentIntensity` of the HDRI. */
  environment: 1.4,
} as const

/** The radius of the bulbs of the garlands (`GARLAND_BULB_RADIUS`). */
const GARLAND_BULB_RADIUS = 0.055
/** How much the glow of the bulbs approaches the one the streak asks for, per second (`GLOW_EASE`). */
const GLOW_EASE = 3

// The Ferris wheel (`FerrisWheel.tsx`).
const RIM_GAP = 1.3
const RIM_TUBE = 0.12
const SPOKE_THICKNESS = 0.11
const WHEEL_BULB_RADIUS = 0.14
const LEG_HEIGHT = WHEEL_CENTER[1] - GROUND_Y
const LEG_SPREAD = 3.2

/** How much a silhouette leans per metre it rises (`SWAY_PER_METRE` of `Crowd.tsx`). */
const SWAY_PER_METRE = 0.6

/**
 * The crowd on the GPU: each silhouette rises what its wave asks for (only the top half, as on the
 * web) and leans sideways with it. The copy carries its phase and its height in `INSTANCE_CUSTOM`,
 * and its height already goes in the scale of the copy: the turn of the web goes **between** the
 * heading and the scale, so here the scale is undone to turn and put back again.
 */
const CROWD_SHADER = `
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;
uniform float uTime = 0.0;
uniform float uBob = 0.012;
uniform float uTempo = 1.1;
uniform float uSway = ${SWAY_PER_METRE.toFixed(2)};
varying vec3 vColor;
void vertex() {
  float phase = INSTANCE_CUSTOM.r;
  float height = max(INSTANCE_CUSTOM.g, 0.001);
  float wave = sin(uTime * uTempo * 6.2831853 + phase);
  float turn = wave * uBob * uSway;
  float c = cos(turn);
  float s = sin(turn);
  vec3 v = VERTEX;
  vec3 real = vec3(v.x, v.y * height, v.z);
  vec3 turned = vec3(c * real.x - s * real.y, s * real.x + c * real.y, real.z);
  VERTEX = vec3(turned.x, turned.y / height + max(0.0, wave) * uBob / height, turned.z);
  vec3 n = NORMAL;
  NORMAL = normalize(vec3(c * n.x - s * n.y, s * n.x + c * n.y, n.z));
  vColor = COLOR.rgb;
}
void fragment() {
  ALBEDO = vColor;
  ROUGHNESS = 0.9;
  METALLIC = 0.0;
}
`

/** The first mesh of an imported scene. */
function meshOf(node: Node): MeshInstance3D | null {
  if (node instanceof MeshInstance3D) return node
  for (let i = 0; i < node.get_child_count(); i++) {
    const found = meshOf(node.get_child(i)!)
    if (found != null) return found
  }
  return null
}

export class Fairground {
  /** What is hidden in your room: the whole venue. */
  readonly venue = new Node3D()
  readonly environment: Environment
  readonly spot: OmniLight3D
  readonly fill: DirectionalLight3D
  /** The pieces of the kit that have been mounted, and how many copies of each one. */
  readonly pieces: Partial<Record<Piece, number>> = {}
  readonly silhouettes: number
  private readonly bulbs: StandardMaterial3D
  private readonly crowd: ShaderMaterial
  private readonly wheel = new Node3D()
  private readonly cabins: Node3D[] = []
  private glow = bulbGlow(0)
  private clock = 0
  private angle = 0
  private squareShown: boolean | null = null
  private readonly sky: Sky | null

  constructor(scene: Node3D, world: Node3D) {
    this.environment = new Environment()
    // The tone before the background: `backgroundColor` reads it to undo the ACES the web does not apply.
    this.environment.tonemap_mode = Environment.ToneMapper.TONE_MAPPER_ACES
    const panorama = ResourceLoader.exists(SKY_PATH) ? ResourceLoader.load(SKY_PATH) : null
    if (panorama instanceof Texture2D) {
      const material = new PanoramaSkyMaterial()
      material.panorama = panorama
      material.energy_multiplier = ENERGY_PER_UNIT.sky
      this.sky = new Sky()
      this.sky.sky_material = material
      this.environment.sky = this.sky
      this.environment.background_mode = Environment.BGMode.BG_SKY
      this.environment.ambient_light_source = Environment.AmbientSource.AMBIENT_SOURCE_SKY
      this.environment.reflected_light_source = Environment.ReflectionSource.REFLECTION_SOURCE_SKY
      this.environment.ambient_light_sky_contribution = 1
      this.environment.ambient_light_energy = LIGHTS.environment * ENERGY_PER_UNIT.ambient
    } else {
      // Without the HDRI, the night background of the web while it loads (`Backdrop`).
      this.sky = null
      this.environment.background_mode = Environment.BGMode.BG_COLOR
      this.environment.background_color = backgroundColor(BACKDROP_COLOR, this.environment)
      this.environment.ambient_light_source = Environment.AmbientSource.AMBIENT_SOURCE_COLOR
      this.environment.ambient_light_color = Color.html('#ffffff')
      this.environment.ambient_light_energy = LIGHTS.ambient
    }
    const worldEnvironment = new WorldEnvironment()
    worldEnvironment.environment = this.environment
    scene.add_child(worldEnvironment)

    // The lights go with the machine, in the world: they are planted and turn with it.
    this.spot = new OmniLight3D()
    this.spot.set_name('Spot')
    const f = LIGHTS.spot
    this.spot.position = new Vector3(f.position[0], f.position[1], f.position[2])
    this.spot.light_color = Color.html(f.color)
    this.spot.light_energy = f.intensity * ENERGY_PER_UNIT.spot
    this.spot.omni_range = f.range
    this.spot.omni_attenuation = 2
    world.add_child(this.spot)
    this.fill = new DirectionalLight3D()
    this.fill.set_name('Fill')
    const r = LIGHTS.fill
    const from = new Vector3(r.position[0], r.position[1], r.position[2])
    this.fill.transform = new Transform3D(Basis.looking_at(Vector3.MULTIPLY(from, -1), Vector3.UP), from)
    this.fill.light_color = Color.html(r.color)
    this.fill.light_energy = r.intensity * ENERGY_PER_UNIT.fill
    world.add_child(this.fill)

    this.venue.set_name('Venue')
    world.add_child(this.venue)
    for (const piece of PIECES) this.plantPiece(piece)
    this.bulbs = this.mountBulbs()
    const { material, count } = this.mountCrowd()
    this.crowd = material
    this.silhouettes = count
    this.mountFerrisWheel()
    // Nothing in the venue casts a shadow: on the web nothing casts one.
    withoutShadow(this.venue)
  }

  /**
   * The copies of a piece of the kit where `placements()` puts them. The scale comes from measuring
   * the box of the model that arrives (`scaleFor`) and the anchor, from its base (`anchorAtBase`).
   * If the piece is not in the package, the venue carries on without it.
   */
  private plantPiece(piece: Piece): void {
    const path = `${FAIRGROUND_DIR}/${piece}.glb`
    if (!ResourceLoader.exists(path)) return
    const packed = ResourceLoader.load(path)
    if (!(packed instanceof PackedScene)) return
    const root = packed.instantiate()!
    const found = meshOf(root)
    const pieceMesh = found?.mesh ?? null
    root.free()
    if (pieceMesh == null) return
    const box = pieceMesh.get_aabb()
    const anchor = new Vector3(-(box.position.x + box.size.x / 2), -box.position.y, -(box.position.z + box.size.z / 2))
    const own = placements().filter((c) => c.piece === piece)
    const transforms = own.map((c) => {
      const k = scaleFor(c.height, box.size.y)
      const base = new Basis(Vector3.UP, c.turn).scaled(new Vector3(k, k, k))
      const [x, y, z] = c.position
      // The anchor first: the piece is centred on its base and then scaled, turned and placed.
      return new Transform3D(base, new Vector3(x, y, z)).translated_local(anchor)
    })
    const material = matte('#ffffff', { rugosidad: 1 })
    // The colour of the kit goes in the vertices.
    material.vertex_color_use_as_albedo = true
    const node = multiMesh(pieceMesh, material, transforms)
    node.set_name(`Pieces-${piece}`)
    this.venue.add_child(node)
    this.pieces[piece] = own.length
  }

  /** The bulbs of the garlands and of the Ferris wheel: one family, one material (`BulbInstances`). */
  private mountBulbs(): StandardMaterial3D {
    const posts = ringSlots(GARLAND_POST_COUNT, GARLAND_RING_RADIUS, Math.PI / GARLAND_POST_COUNT)
    const top = (i: number) => {
      const [x, , z] = posts[i].position
      return [x, GARLAND_POST_HEIGHT, z] as [number, number, number]
    }
    const transforms: Transform3D[] = []
    posts.forEach((_, i) => {
      for (const [x, y, z] of garlandBulbs({ from: top(i), to: top((i + 1) % posts.length) })) {
        transforms.push(new Transform3D(Basis.IDENTITY.scaled(new Vector3(GARLAND_BULB_RADIUS, GARLAND_BULB_RADIUS, GARLAND_BULB_RADIUS)), new Vector3(x, y, z)))
      }
    })
    const material = matte(MACHINE_BULB_COLOR)
    material.shading_mode = BaseMaterial3D.ShadingMode.SHADING_MODE_UNSHADED
    const bulb = sphere(8, 6)
    const garlands = multiMesh(bulb, material, transforms)
    garlands.set_name('Garlands')
    this.venue.add_child(garlands)
    this.paintBulbs(material, bulbGlow(0), 0)
    return material
  }

  /** The glow and the colour of the bulbs: the `emissive` of the web, which saturates (`toneMapped={false}`). */
  private paintBulbs(material: StandardMaterial3D, glow: number, party: number): void {
    const base = Color.html(MACHINE_BULB_COLOR)
    const white = Color.html(PARTY_BULB_COLOR)
    const c = base.lerp(white, party)
    // Unshaded and above 1: what on the web is the emissive without a tone curve.
    const k = glow / bulbGlow(0)
    material.albedo_color = new Color(c.r * k, c.g * k, c.b * k, 1)
  }

  /** The crowd: body and head in one mesh, one copy per silhouette, swaying on the GPU. */
  private mountCrowd(): { material: ShaderMaterial; count: number } {
    const body = new CapsuleMesh()
    body.radius = 0.2
    body.height = 1.05 + 0.4
    body.radial_segments = 8
    body.rings = 3
    const head = ball(0.13, 8, 6)
    const silhouette = new ArrayMesh()
    // Each part in its place (`translate` of the web): the capsule centred at 0.725, the head at 1.58.
    for (const [part, height] of [[body, 0.725], [head, 1.58]] as const) {
      const arrays = part.get_mesh_arrays()
      const moved = (arrays.get(Mesh.ArrayType.ARRAY_VERTEX) as PackedVector3Array).duplicate()
      for (let i = 0; i < moved.size(); i++) {
        const v = moved.get(i)
        moved.set(i, new Vector3(v.x, v.y + height, v.z))
      }
      arrays.set(Mesh.ArrayType.ARRAY_VERTEX, moved)
      silhouette.add_surface_from_arrays(Mesh.PrimitiveType.PRIMITIVE_TRIANGLES, arrays)
    }
    const spots = crowdSpots()
    const multi = new MultiMesh()
    multi.transform_format = MultiMesh.TransformFormat.TRANSFORM_3D
    multi.use_colors = true
    multi.use_custom_data = true
    multi.mesh = silhouette
    multi.instance_count = spots.length
    spots.forEach((s, i) => {
      const [x, y, z] = s.position
      const base = new Basis(Vector3.UP, s.rotationY).scaled(new Vector3(1, s.height, 1))
      multi.set_instance_transform(i, new Transform3D(base, new Vector3(x, y, z)))
      multi.set_instance_color(i, Color.html(CROWD_SHADES[s.shade % CROWD_SHADES.length]))
      multi.set_instance_custom_data(i, new Color(s.phase, s.height, 0, 0))
    })
    const material = new ShaderMaterial()
    const shader = new Shader()
    shader.code = CROWD_SHADER
    material.shader = shader
    const node = new MultiMeshInstance3D()
    node.set_name('Crowd')
    node.multimesh = multi
    node.material_override = material
    // They sway outside their box: without this, the ones at the edge of the view would be clipped.
    node.extra_cull_margin = 0.2
    this.venue.add_child(node)
    return { material, count: spots.length }
  }

  /** The Ferris wheel (`FerrisWheel.tsx`), facing the machine. */
  private mountFerrisWheel(): void {
    const ferrisWheel = new Node3D()
    ferrisWheel.set_name('FerrisWheel')
    ferrisWheel.position = new Vector3(WHEEL_CENTER[0], WHEEL_CENTER[1], WHEEL_CENTER[2])
    ferrisWheel.rotation = new Vector3(0, facingRotationY(WHEEL_CENTER), 0)
    this.venue.add_child(ferrisWheel)
    const iron = matte(MACHINE_TRUSS_COLOR, { rugosidad: 0.6, metal: 0.25 })
    const rimMaterial = matte(MACHINE_TRUSS_COLOR, { rugosidad: 0.5, metal: 0.5 })
    const board = matte('#ffffff', { rugosidad: 0.85, metal: 0.05 })
    const pole = cylinderMesh(0.5, 0.5, 1, 8)
    // The legs, spread forwards and backwards, and the axle.
    const fixed: Transform3D[] = []
    for (const side of [-1, 1]) {
      fixed.push(barBetween(new Vector3(0, 0, 0), new Vector3(0, -LEG_HEIGHT, side * LEG_SPREAD), 0.2))
    }
    fixed.push(barBetween(new Vector3(0, 0, -(RIM_GAP + 0.6) / 2), new Vector3(0, 0, (RIM_GAP + 0.6) / 2), 0.21))
    ferrisWheel.add_child(multiMesh(pole, iron, fixed))

    this.wheel.set_name('Wheel')
    ferrisWheel.add_child(this.wheel)
    for (const side of [-1, 1]) {
      const rim = mesh(torusMesh(WHEEL_RADIUS, RIM_TUBE, 48, 6), rimMaterial, new Vector3(0, 0, (side * RIM_GAP) / 2))
      rim.rotation = new Vector3(Math.PI / 2, 0, 0)
      this.wheel.add_child(rim)
    }
    const spokes: Transform3D[] = []
    const bulbs: Transform3D[] = []
    for (let i = 0; i < WHEEL_CABIN_COUNT; i++) {
      const a = (i / WHEEL_CABIN_COUNT) * Math.PI * 2
      const tip = new Vector3(Math.cos(a) * WHEEL_RADIUS, Math.sin(a) * WHEEL_RADIUS, 0)
      spokes.push(barBetween(Vector3.ZERO, tip, SPOKE_THICKNESS / 2))
      for (const side of [-1, 1]) {
        const b = new Vector3(tip.x, tip.y, (side * RIM_GAP) / 2)
        bulbs.push(new Transform3D(Basis.IDENTITY.scaled(new Vector3(WHEEL_BULB_RADIUS, WHEEL_BULB_RADIUS, WHEEL_BULB_RADIUS)), b))
      }
      // The cabin hangs from its tip and does not turn with the wheel.
      const cabin = new Node3D()
      cabin.position = tip
      const hang = WHEEL_CABIN_DROP - WHEEL_CABIN_HEIGHT / 2
      const rod = mesh(pole, iron, new Vector3(0, -hang / 2, 0))
      rod.scale = new Vector3(0.08, hang, 0.08)
      cabin.add_child(rod)
      const body = new MeshInstance3D()
      const box = new BoxMesh()
      box.size = new Vector3(0.78, WHEEL_CABIN_HEIGHT, 0.95)
      body.mesh = box
      const color = board.duplicate() as StandardMaterial3D
      color.albedo_color = Color.html(MACHINE_STRIPE_COLORS[i % MACHINE_STRIPE_COLORS.length])
      body.material_override = color
      body.position = new Vector3(0, -WHEEL_CABIN_DROP, 0)
      cabin.add_child(body)
      this.wheel.add_child(cabin)
      this.cabins.push(cabin)
    }
    this.wheel.add_child(multiMesh(pole, iron, spokes))
    // The bulbs of the Ferris wheel are of the same family as those of the garlands: the same material.
    this.wheel.add_child(multiMesh(sphere(8, 6), this.bulbs, bulbs))
  }

  /** How many of each thing, for whoever wants to count them. */
  get counts(): { pieces: Partial<Record<Piece, number>>; silhouettes: number; cabins: number } {
    return { pieces: this.pieces, silhouettes: this.silhouettes, cabins: this.cabins.length }
  }

  /**
   * One frame: the streak livens up the bulbs and the crowd, and the Ferris wheel turns. With
   * `still` (`prefers-reduced-motion` on the web) nothing moves on its own, but the glow does rise.
   */
  update(delta: number, streak: number, still = false): void {
    this.clock += delta
    this.glow += (bulbGlow(streak) - this.glow) * Math.min(1, delta * GLOW_EASE)
    this.paintBulbs(this.bulbs, this.glow, still ? 0 : bulbPulse(streak, this.clock))
    this.crowd.set_shader_parameter('uTime', still ? 0 : this.clock)
    this.crowd.set_shader_parameter('uBob', still ? 0 : crowdBob(streak))
    this.crowd.set_shader_parameter('uTempo', crowdTempo(streak))
    if (!still) {
      this.angle += delta * WHEEL_SPEED
      this.wheel.rotation = new Vector3(0, 0, this.angle)
      for (const cabin of this.cabins) cabin.rotation = new Vector3(0, 0, -this.angle)
    }
  }

  /** Shows the square or takes it away to see the room. */
  inSquare(on: boolean): void {
    if (on === this.squareShown) return
    this.squareShown = on
    this.venue.visible = on
    // In the room there is no background: an opaque one would cover it. The HDRI keeps giving the reflections.
    this.environment.background_mode = on && this.sky != null ? Environment.BGMode.BG_SKY : Environment.BGMode.BG_COLOR
    this.environment.background_color = on ? backgroundColor(BACKDROP_COLOR, this.environment) : new Color(0, 0, 0, 0)
  }
}
