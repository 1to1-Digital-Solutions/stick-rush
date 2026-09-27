/**
 * La feria de Stick Rush en Godot (`Fairground.tsx` y lo que monta, y el escenario de `GameWorld`):
 * la plaza de noche del HDRI de fondo, que además da los reflejos; las luces de la web —el foco
 * cálido sobre la máquina y el relleno frío por detrás—; y alrededor, el recinto:
 *
 * - **las piezas del kit de assets** (`feriaKit.ts`): los seis puestos del anillo, las ocho farolas
 *   y una banderola en cada una, cargadas de `public/models/kit/` tal cual (el color va en los
 *   vértices) donde las pone `colocaciones()`, una malla múltiple por pieza;
 * - **las guirnaldas** de bombillas entre farola y farola (`garlandBulbs`, `sceneryLayout.ts`);
 * - **el público** (`crowdLayout.ts`): cuarenta y dos siluetas —cuerpo y cabeza en una sola malla—
 *   en su anillo, mirando a la máquina, que se mecen más alto y más deprisa con la racha
 *   (`crowdBob`, `crowdTempo`). El vaivén va en el shader, como en la web va en una sola llamada de
 *   dibujo: la escena solo le pasa la racha y el reloj;
 * - **la noria** (`FerrisWheel.tsx`): sus dos llantas, doce radios, doce cabinas que no giran con
 *   ella y las bombillas del contorno, girando despacio;
 * - y **las bombillas se animan con la racha** (`fairMood.ts`): suben de brillo y, a partir de cinco
 *   palos seguidos, palpitan hacia el blanco. Se toca el material de la familia entera.
 *
 * **Tu habitación** (`xrcade:scenery`) oculta el recinto y el fondo —no los desmonta— y deja la
 * máquina: solo con realidad aumentada en el visor (`showsPlace`), como en la web.
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

import { colorDeFondo } from '@kit/runtime/escena/entorno'
import { esfera } from '@kit/runtime/escena/formas'
import { barraEntre, mallaDeToro, mallaDeCilindro, malla, mate, multimalla, sinSombra } from '@kit/runtime/escena/piezas'

import { crowdSpots } from '@/lib/crowdLayout'
import { bulbGlow, bulbPulse, crowdBob, crowdTempo } from '@/lib/fairMood'
import { PIEZAS, colocaciones, escalaPara, type Pieza } from '@/lib/feriaKit'
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

/** Una esfera de `radio` con `lados` × `anillos` (`sphereGeometry`), para repartir por una malla múltiple. */
function bola(radio: number, lados: number, anillos: number): SphereMesh {
  const mesh = esfera(lados, anillos)
  mesh.radius = radio
  mesh.height = radio * 2
  return mesh
}

/** Donde viajan en el paquete las piezas del kit (`public/models/kit/` de la web). */
export const DIR_DE_LA_FERIA = 'res://games/stick-rush/feria'
/** El HDRI de la plaza de noche (`HDRI_PATH`), en el paquete. */
export const RUTA_DEL_CIELO = 'res://games/stick-rush/hdri/plaza_pueblo_1k.exr'

/**
 * De las intensidades de three a las de Godot. No son la misma unidad —three reparte la del foco
 * por la distancia en candelas y aplica su curva de tono; Godot, su energía y la suya—, así que van
 * con una escala por luz, puesta a ojo sobre las capturas del port. Lo que no se toca es la
 * proporción entre las luces de la web.
 */
export const ENERGIA_POR_UNIDAD = { foco: 0.16, relleno: 1.2, cielo: 0.55, ambiente: 1 } as const

/** Las luces de `GameWorld.tsx`: el foco cálido sobre la máquina y el relleno frío por detrás. */
export const LUCES = {
  ambiente: 0.35,
  foco: { posicion: [0, MACHINE_HEIGHT + 1, -MACHINE_RADIUS * 0.4] as const, intensidad: 16, color: '#ffd479', alcance: 10 },
  relleno: { posicion: [2.5, 4, 3] as const, intensidad: 0.35, color: '#9fb6d6' },
  /** `environmentIntensity` del HDRI. */
  entorno: 1.4,
} as const

/** El radio de las bombillas de las guirnaldas (`GARLAND_BULB_RADIUS`). */
const GARLAND_BULB_RADIUS = 0.055
/** Cuánto se acerca el brillo de las bombillas al que pide la racha, por segundo (`GLOW_EASE`). */
const GLOW_EASE = 3

// La noria (`FerrisWheel.tsx`).
const RIM_GAP = 1.3
const RIM_TUBE = 0.12
const SPOKE_THICKNESS = 0.11
const WHEEL_BULB_RADIUS = 0.14
const LEG_HEIGHT = WHEEL_CENTER[1] - GROUND_Y
const LEG_SPREAD = 3.2

/** Lo que se inclina una silueta por metro que sube (`SWAY_PER_METRE` de `Crowd.tsx`). */
const SWAY_PER_METRE = 0.6

/**
 * El público en la GPU: cada silueta sube lo que pide su ola (solo la mitad de arriba, como en la
 * web) y se inclina a los lados con ella. La copia lleva su fase y su estatura en `INSTANCE_CUSTOM`,
 * y su estatura va ya en la escala de la copia: el giro de la web va **entre** el rumbo y la
 * escala, así que aquí se deshace la escala para girar y se vuelve a poner.
 */
const SHADER_DEL_PUBLICO = `
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;
uniform float uTime = 0.0;
uniform float uBob = 0.012;
uniform float uTempo = 1.1;
uniform float uSway = ${SWAY_PER_METRE.toFixed(2)};
varying vec3 vColor;
void vertex() {
  float fase = INSTANCE_CUSTOM.r;
  float alto = max(INSTANCE_CUSTOM.g, 0.001);
  float ola = sin(uTime * uTempo * 6.2831853 + fase);
  float giro = ola * uBob * uSway;
  float c = cos(giro);
  float s = sin(giro);
  vec3 v = VERTEX;
  vec3 real = vec3(v.x, v.y * alto, v.z);
  vec3 girado = vec3(c * real.x - s * real.y, s * real.x + c * real.y, real.z);
  VERTEX = vec3(girado.x, girado.y / alto + max(0.0, ola) * uBob / alto, girado.z);
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

/** La primera malla de una escena importada. */
function mallaDe(nodo: Node): MeshInstance3D | null {
  if (nodo instanceof MeshInstance3D) return nodo
  for (let i = 0; i < nodo.get_child_count(); i++) {
    const hallada = mallaDe(nodo.get_child(i)!)
    if (hallada != null) return hallada
  }
  return null
}

export class Feria {
  /** Lo que se oculta en tu habitación: el recinto entero. */
  readonly recinto = new Node3D()
  readonly entorno: Environment
  readonly foco: OmniLight3D
  readonly relleno: DirectionalLight3D
  /** Las piezas del kit que se han montado, y cuántas copias de cada una. */
  readonly piezas: Partial<Record<Pieza, number>> = {}
  readonly siluetas: number
  private readonly bombillas: StandardMaterial3D
  private readonly publico: ShaderMaterial
  private readonly rueda = new Node3D()
  private readonly cabinas: Node3D[] = []
  private brillo = bulbGlow(0)
  private reloj = 0
  private angulo = 0
  private conPlaza: boolean | null = null
  private readonly cielo: Sky | null

  constructor(escena: Node3D, mundo: Node3D) {
    this.entorno = new Environment()
    // El tono antes que el fondo: `colorDeFondo` lo lee para deshacer el ACES que la web no pone.
    this.entorno.tonemap_mode = Environment.ToneMapper.TONE_MAPPER_ACES
    const panorama = ResourceLoader.exists(RUTA_DEL_CIELO) ? ResourceLoader.load(RUTA_DEL_CIELO) : null
    if (panorama instanceof Texture2D) {
      const material = new PanoramaSkyMaterial()
      material.panorama = panorama
      material.energy_multiplier = ENERGIA_POR_UNIDAD.cielo
      this.cielo = new Sky()
      this.cielo.sky_material = material
      this.entorno.sky = this.cielo
      this.entorno.background_mode = Environment.BGMode.BG_SKY
      this.entorno.ambient_light_source = Environment.AmbientSource.AMBIENT_SOURCE_SKY
      this.entorno.reflected_light_source = Environment.ReflectionSource.REFLECTION_SOURCE_SKY
      this.entorno.ambient_light_sky_contribution = 1
      this.entorno.ambient_light_energy = LUCES.entorno * ENERGIA_POR_UNIDAD.ambiente
    } else {
      // Sin el HDRI, el fondo de noche de la web mientras carga (`Backdrop`).
      this.cielo = null
      this.entorno.background_mode = Environment.BGMode.BG_COLOR
      this.entorno.background_color = colorDeFondo(BACKDROP_COLOR, this.entorno)
      this.entorno.ambient_light_source = Environment.AmbientSource.AMBIENT_SOURCE_COLOR
      this.entorno.ambient_light_color = Color.html('#ffffff')
      this.entorno.ambient_light_energy = LUCES.ambiente
    }
    const world = new WorldEnvironment()
    world.environment = this.entorno
    escena.add_child(world)

    // Las luces van con la máquina, en el mundo: se plantan y giran con ella.
    this.foco = new OmniLight3D()
    this.foco.set_name('Foco')
    const f = LUCES.foco
    this.foco.position = new Vector3(f.posicion[0], f.posicion[1], f.posicion[2])
    this.foco.light_color = Color.html(f.color)
    this.foco.light_energy = f.intensidad * ENERGIA_POR_UNIDAD.foco
    this.foco.omni_range = f.alcance
    this.foco.omni_attenuation = 2
    mundo.add_child(this.foco)
    this.relleno = new DirectionalLight3D()
    this.relleno.set_name('Relleno')
    const r = LUCES.relleno
    const desde = new Vector3(r.posicion[0], r.posicion[1], r.posicion[2])
    this.relleno.transform = new Transform3D(Basis.looking_at(Vector3.MULTIPLY(desde, -1), Vector3.UP), desde)
    this.relleno.light_color = Color.html(r.color)
    this.relleno.light_energy = r.intensidad * ENERGIA_POR_UNIDAD.relleno
    mundo.add_child(this.relleno)

    this.recinto.set_name('Recinto')
    mundo.add_child(this.recinto)
    for (const pieza of PIEZAS) this.plantar(pieza)
    this.bombillas = this.montarBombillas()
    const { material, cuantas } = this.montarPublico()
    this.publico = material
    this.siluetas = cuantas
    this.montarNoria()
    // Nada del recinto echa sombra: en la web no la echa nada.
    sinSombra(this.recinto)
  }

  /**
   * Las copias de una pieza del kit donde las pone `colocaciones()`. La escala sale de medir la
   * caja del modelo que llega (`escalaPara`) y el ancla, de su base (`anclaEnLaBase`). Si la pieza
   * no está en el paquete, el recinto sigue sin ella.
   */
  private plantar(pieza: Pieza): void {
    const ruta = `${DIR_DE_LA_FERIA}/${pieza}.glb`
    if (!ResourceLoader.exists(ruta)) return
    const escena = ResourceLoader.load(ruta)
    if (!(escena instanceof PackedScene)) return
    const raiz = escena.instantiate()!
    const hallada = mallaDe(raiz)
    const mesh = hallada?.mesh ?? null
    raiz.free()
    if (mesh == null) return
    const caja = mesh.get_aabb()
    const ancla = new Vector3(-(caja.position.x + caja.size.x / 2), -caja.position.y, -(caja.position.z + caja.size.z / 2))
    const suyas = colocaciones().filter((c) => c.pieza === pieza)
    const transformaciones = suyas.map((c) => {
      const k = escalaPara(c.altura, caja.size.y)
      const base = new Basis(Vector3.UP, c.giro).scaled(new Vector3(k, k, k))
      const [x, y, z] = c.posicion
      // Primero el ancla: la pieza se centra en su base y luego se escala, gira y coloca.
      return new Transform3D(base, new Vector3(x, y, z)).translated_local(ancla)
    })
    const material = mate('#ffffff', { rugosidad: 1 })
    // El color del kit va en los vértices.
    material.vertex_color_use_as_albedo = true
    const nodo = multimalla(mesh, material, transformaciones)
    nodo.set_name(`Piezas-${pieza}`)
    this.recinto.add_child(nodo)
    this.piezas[pieza] = suyas.length
  }

  /** Las bombillas de las guirnaldas y de la noria: una familia, un material (`BulbInstances`). */
  private montarBombillas(): StandardMaterial3D {
    const postes = ringSlots(GARLAND_POST_COUNT, GARLAND_RING_RADIUS, Math.PI / GARLAND_POST_COUNT)
    const arriba = (i: number) => {
      const [x, , z] = postes[i].position
      return [x, GARLAND_POST_HEIGHT, z] as [number, number, number]
    }
    const transformaciones: Transform3D[] = []
    postes.forEach((_, i) => {
      for (const [x, y, z] of garlandBulbs({ from: arriba(i), to: arriba((i + 1) % postes.length) })) {
        transformaciones.push(new Transform3D(Basis.IDENTITY.scaled(new Vector3(GARLAND_BULB_RADIUS, GARLAND_BULB_RADIUS, GARLAND_BULB_RADIUS)), new Vector3(x, y, z)))
      }
    })
    const material = mate(MACHINE_BULB_COLOR)
    material.shading_mode = BaseMaterial3D.ShadingMode.SHADING_MODE_UNSHADED
    const bombilla = esfera(8, 6)
    const guirnaldas = multimalla(bombilla, material, transformaciones)
    guirnaldas.set_name('Guirnaldas')
    this.recinto.add_child(guirnaldas)
    this.pintarBombillas(material, bulbGlow(0), 0)
    return material
  }

  /** El brillo y el color de las bombillas: el `emissive` de la web, que satura (`toneMapped={false}`). */
  private pintarBombillas(material: StandardMaterial3D, brillo: number, fiesta: number): void {
    const base = Color.html(MACHINE_BULB_COLOR)
    const blanco = Color.html(PARTY_BULB_COLOR)
    const c = base.lerp(blanco, fiesta)
    // Sin luz y por encima de 1: lo que en la web es el emisivo sin curva de tono.
    const k = brillo / bulbGlow(0)
    material.albedo_color = new Color(c.r * k, c.g * k, c.b * k, 1)
  }

  /** El público: cuerpo y cabeza en una malla, una copia por silueta, meciéndose en la GPU. */
  private montarPublico(): { material: ShaderMaterial; cuantas: number } {
    const cuerpo = new CapsuleMesh()
    cuerpo.radius = 0.2
    cuerpo.height = 1.05 + 0.4
    cuerpo.radial_segments = 8
    cuerpo.rings = 3
    const cabeza = bola(0.13, 8, 6)
    const silueta = new ArrayMesh()
    // Cada parte en su sitio (`translate` de la web): la cápsula centrada a 0,725, la cabeza a 1,58.
    for (const [parte, alto] of [[cuerpo, 0.725], [cabeza, 1.58]] as const) {
      const arrays = parte.get_mesh_arrays()
      const movidos = (arrays.get(Mesh.ArrayType.ARRAY_VERTEX) as PackedVector3Array).duplicate()
      for (let i = 0; i < movidos.size(); i++) {
        const v = movidos.get(i)
        movidos.set(i, new Vector3(v.x, v.y + alto, v.z))
      }
      arrays.set(Mesh.ArrayType.ARRAY_VERTEX, movidos)
      silueta.add_surface_from_arrays(Mesh.PrimitiveType.PRIMITIVE_TRIANGLES, arrays)
    }
    const sitios = crowdSpots()
    const multi = new MultiMesh()
    multi.transform_format = MultiMesh.TransformFormat.TRANSFORM_3D
    multi.use_colors = true
    multi.use_custom_data = true
    multi.mesh = silueta
    multi.instance_count = sitios.length
    sitios.forEach((s, i) => {
      const [x, y, z] = s.position
      const base = new Basis(Vector3.UP, s.rotationY).scaled(new Vector3(1, s.height, 1))
      multi.set_instance_transform(i, new Transform3D(base, new Vector3(x, y, z)))
      multi.set_instance_color(i, Color.html(CROWD_SHADES[s.shade % CROWD_SHADES.length]))
      multi.set_instance_custom_data(i, new Color(s.phase, s.height, 0, 0))
    })
    const material = new ShaderMaterial()
    const shader = new Shader()
    shader.code = SHADER_DEL_PUBLICO
    material.shader = shader
    const nodo = new MultiMeshInstance3D()
    nodo.set_name('Publico')
    nodo.multimesh = multi
    nodo.material_override = material
    // Se mecen fuera de su caja: sin esto, las del borde de la vista se recortarían.
    nodo.extra_cull_margin = 0.2
    this.recinto.add_child(nodo)
    return { material, cuantas: sitios.length }
  }

  /** La noria (`FerrisWheel.tsx`), de cara a la máquina. */
  private montarNoria(): void {
    const noria = new Node3D()
    noria.set_name('Noria')
    noria.position = new Vector3(WHEEL_CENTER[0], WHEEL_CENTER[1], WHEEL_CENTER[2])
    noria.rotation = new Vector3(0, facingRotationY(WHEEL_CENTER), 0)
    this.recinto.add_child(noria)
    const hierro = mate(MACHINE_TRUSS_COLOR, { rugosidad: 0.6, metal: 0.25 })
    const llanta = mate(MACHINE_TRUSS_COLOR, { rugosidad: 0.5, metal: 0.5 })
    const tabla = mate('#ffffff', { rugosidad: 0.85, metal: 0.05 })
    const poste = mallaDeCilindro(0.5, 0.5, 1, 8)
    // Los pies, abiertos hacia delante y hacia atrás, y el eje.
    const fijos: Transform3D[] = []
    for (const lado of [-1, 1]) {
      fijos.push(barraEntre(new Vector3(0, 0, 0), new Vector3(0, -LEG_HEIGHT, lado * LEG_SPREAD), 0.2))
    }
    fijos.push(barraEntre(new Vector3(0, 0, -(RIM_GAP + 0.6) / 2), new Vector3(0, 0, (RIM_GAP + 0.6) / 2), 0.21))
    noria.add_child(multimalla(poste, hierro, fijos))

    this.rueda.set_name('Rueda')
    noria.add_child(this.rueda)
    for (const lado of [-1, 1]) {
      const aro = malla(mallaDeToro(WHEEL_RADIUS, RIM_TUBE, 48, 6), llanta, new Vector3(0, 0, (lado * RIM_GAP) / 2))
      aro.rotation = new Vector3(Math.PI / 2, 0, 0)
      this.rueda.add_child(aro)
    }
    const radios: Transform3D[] = []
    const bombillas: Transform3D[] = []
    for (let i = 0; i < WHEEL_CABIN_COUNT; i++) {
      const a = (i / WHEEL_CABIN_COUNT) * Math.PI * 2
      const punta = new Vector3(Math.cos(a) * WHEEL_RADIUS, Math.sin(a) * WHEEL_RADIUS, 0)
      radios.push(barraEntre(Vector3.ZERO, punta, SPOKE_THICKNESS / 2))
      for (const lado of [-1, 1]) {
        const b = new Vector3(punta.x, punta.y, (lado * RIM_GAP) / 2)
        bombillas.push(new Transform3D(Basis.IDENTITY.scaled(new Vector3(WHEEL_BULB_RADIUS, WHEEL_BULB_RADIUS, WHEEL_BULB_RADIUS)), b))
      }
      // La cabina cuelga de su punta y no gira con la rueda.
      const cabina = new Node3D()
      cabina.position = punta
      const colgante = WHEEL_CABIN_DROP - WHEEL_CABIN_HEIGHT / 2
      const varilla = malla(poste, hierro, new Vector3(0, -colgante / 2, 0))
      varilla.scale = new Vector3(0.08, colgante, 0.08)
      cabina.add_child(varilla)
      const cuerpo = new MeshInstance3D()
      const box = new BoxMesh()
      box.size = new Vector3(0.78, WHEEL_CABIN_HEIGHT, 0.95)
      cuerpo.mesh = box
      const color = tabla.duplicate() as StandardMaterial3D
      color.albedo_color = Color.html(MACHINE_STRIPE_COLORS[i % MACHINE_STRIPE_COLORS.length])
      cuerpo.material_override = color
      cuerpo.position = new Vector3(0, -WHEEL_CABIN_DROP, 0)
      cabina.add_child(cuerpo)
      this.rueda.add_child(cabina)
      this.cabinas.push(cabina)
    }
    this.rueda.add_child(multimalla(poste, hierro, radios))
    // Las bombillas de la noria son de la misma familia que las de las guirnaldas: el mismo material.
    this.rueda.add_child(multimalla(esfera(8, 6), this.bombillas, bombillas))
  }

  /** Cuántas de cada cosa, para quien quiera contarlas. */
  get recuento(): { piezas: Partial<Record<Pieza, number>>; siluetas: number; cabinas: number } {
    return { piezas: this.piezas, siluetas: this.siluetas, cabinas: this.cabinas.length }
  }

  /**
   * Un fotograma: la racha anima las bombillas y el público, y la noria gira. Con `quieto`
   * (`prefers-reduced-motion` en la web) nada se mueve solo, pero el brillo sí sube.
   */
  actualizar(delta: number, racha: number, quieto = false): void {
    this.reloj += delta
    this.brillo += (bulbGlow(racha) - this.brillo) * Math.min(1, delta * GLOW_EASE)
    this.pintarBombillas(this.bombillas, this.brillo, quieto ? 0 : bulbPulse(racha, this.reloj))
    this.publico.set_shader_parameter('uTime', quieto ? 0 : this.reloj)
    this.publico.set_shader_parameter('uBob', quieto ? 0 : crowdBob(racha))
    this.publico.set_shader_parameter('uTempo', crowdTempo(racha))
    if (!quieto) {
      this.angulo += delta * WHEEL_SPEED
      this.rueda.rotation = new Vector3(0, 0, this.angulo)
      for (const cabina of this.cabinas) cabina.rotation = new Vector3(0, 0, -this.angulo)
    }
  }

  /** Enseña la plaza o la quita para ver la habitación. */
  enLaPlaza(si: boolean): void {
    if (si === this.conPlaza) return
    this.conPlaza = si
    this.recinto.visible = si
    // En la habitación no hay fondo: uno opaco la taparía. El HDRI sigue dando los reflejos.
    this.entorno.background_mode = si && this.cielo != null ? Environment.BGMode.BG_SKY : Environment.BGMode.BG_COLOR
    this.entorno.background_color = si ? colorDeFondo(BACKDROP_COLOR, this.entorno) : new Color(0, 0, 0, 0)
  }
}
