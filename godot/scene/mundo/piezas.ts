/**
 * Las mallas sueltas con que se hace el mundo de Stick Rush en Godot: tubos, cilindros, esferas,
 * aros y cuadros con su material. Lo mismo que la web escribe como `<mesh>` con su
 * `<meshStandardMaterial>`, en una línea cada una.
 *
 * Los cilindros de Godot crecen en `Y`, como los de three: las medidas de los componentes de la
 * web valen tal cual.
 */
import {
  BaseMaterial3D,
  Basis,
  Color,
  CylinderMesh,
  GeometryInstance3D,
  Mesh,
  MeshInstance3D,
  MultiMesh,
  MultiMeshInstance3D,
  Node,
  SphereMesh,
  StandardMaterial3D,
  SurfaceTool,
  TorusMesh,
  Transform3D,
  Vector3,
} from 'godot'

import type { Punto2 } from '@kit/lib/ui/salida'

/** Un material con luz del color dado: el `meshStandardMaterial` de la web. */
export function mate(color: string, { rugosidad = 0.9, metal = 0 } = {}): StandardMaterial3D {
  const m = new StandardMaterial3D()
  m.albedo_color = Color.html(color)
  m.roughness = rugosidad
  m.metallic = metal
  return m
}

/**
 * Un material que brilla por sí mismo (las bombillas, con `emissive` y `toneMapped={false}` en la
 * web): sin luz, del color dado multiplicado por su brillo, que es como la web lo deja saturar.
 */
export function encendido(color: string, energia = 1.8): StandardMaterial3D {
  const m = new StandardMaterial3D()
  m.shading_mode = BaseMaterial3D.ShadingMode.SHADING_MODE_UNSHADED
  const c = Color.html(color)
  m.albedo_color = new Color(c.r * energia, c.g * energia, c.b * energia, 1)
  return m
}

/**
 * Un material sin luz y translúcido, que no escribe profundidad: el de las ayudas y la onda del
 * acierto (`meshBasicMaterial` con `transparent` y `depthWrite={false}`). `prioridad` ordena los que
 * caen en el mismo sitio, que por profundidad se pelearían.
 */
export function translucido(color: string, opacidad = 0, prioridad = 0): StandardMaterial3D {
  const m = new StandardMaterial3D()
  m.shading_mode = BaseMaterial3D.ShadingMode.SHADING_MODE_UNSHADED
  m.transparency = BaseMaterial3D.Transparency.TRANSPARENCY_ALPHA
  m.cull_mode = BaseMaterial3D.CullMode.CULL_DISABLED
  const c = Color.html(color)
  m.albedo_color = new Color(c.r, c.g, c.b, opacidad)
  m.render_priority = prioridad
  return m
}

/** Cambia la opacidad de un material translúcido sin tocar su color. */
export function opacidad(m: StandardMaterial3D, valor: number): void {
  const c = m.albedo_color
  m.albedo_color = new Color(c.r, c.g, c.b, valor)
}

export function malla(mesh: Mesh, material: StandardMaterial3D | null, posicion?: Vector3): MeshInstance3D {
  const nodo = new MeshInstance3D()
  nodo.mesh = mesh
  if (material != null) nodo.material_override = material
  if (posicion != null) nodo.position = posicion
  return nodo
}

/** La malla de un cilindro de radios `arriba` y `abajo`, a lo largo de `Y`. */
export function mallaDeCilindro(arriba: number, abajo: number, alto: number, lados = 16): CylinderMesh {
  const mesh = new CylinderMesh()
  mesh.top_radius = arriba
  mesh.bottom_radius = abajo
  mesh.height = alto
  mesh.radial_segments = lados
  mesh.rings = 1
  return mesh
}

export function cilindro(arriba: number, abajo: number, alto: number, material: StandardMaterial3D | null, posicion?: Vector3, lados = 16): MeshInstance3D {
  return malla(mallaDeCilindro(arriba, abajo, alto, lados), material, posicion)
}

export function mallaDeEsfera(radio: number, lados = 16, anillos = Math.max(4, Math.round(lados / 2))): SphereMesh {
  const mesh = new SphereMesh()
  mesh.radius = radio
  mesh.height = radio * 2
  mesh.radial_segments = lados
  mesh.rings = anillos
  return mesh
}

/**
 * La malla de un aro como el `torusGeometry` de three: `radio` del centro del tubo y `tubo` su
 * grosor. **Ojo con el eje**: el de three se tiende en el plano `XY` (su eje es `Z`) y el de Godot en
 * `XZ` (su eje es `Y`). Un aro de la web girado `[π/2, 0, 0]` —los ganchos, la onda del acierto—
 * es aquí el aro tal cual; uno sin girar —las llantas de la noria— lleva aquí `[π/2, 0, 0]`.
 */
export function mallaDeAro(radio: number, tubo: number, lados = 24, seccion = 8): TorusMesh {
  const mesh = new TorusMesh()
  mesh.inner_radius = radio - tubo
  mesh.outer_radius = radio + tubo
  mesh.rings = lados
  mesh.ring_segments = seccion
  return mesh
}

/** Una malla plana en `z = 0` hecha de triángulos del plano (tres puntos cada uno), mirando a `+Z`. */
export function mallaPlana(triangulos: readonly Punto2[]): Mesh {
  const st = new SurfaceTool()
  st.begin(Mesh.PrimitiveType.PRIMITIVE_TRIANGLES)
  st.set_normal(new Vector3(0, 0, 1))
  for (const [x, y] of triangulos) st.add_vertex(new Vector3(x, y, 0))
  return st.commit()!
}

/**
 * Quita la sombra a todo lo que cuelga de `nodo`: lo que en la web no da sombra (lo que no lleva
 * `castShadow`), que en Godot la da por defecto.
 */
export function sinSombra(nodo: Node): void {
  if (nodo instanceof GeometryInstance3D) nodo.cast_shadow = GeometryInstance3D.ShadowCastingSetting.SHADOW_CASTING_SETTING_OFF
  for (let i = 0; i < nodo.get_child_count(); i++) sinSombra(nodo.get_child(i)!)
}

/**
 * Una base cuya `Y` apunta a `hacia`, escalada por ejes: el `setFromUnitVectors(ARRIBA, rumbo)` con
 * que la web tiende cada barra de la máquina entre dos puntos (`Strut`). Por columnas: `new
 * Basis(cuaternión)` tumba el motor de GodotJS.
 */
export function baseHacia(hacia: Vector3, ancho = 1, largo = 1, fondo = 1): Basis {
  const y = hacia.normalized()
  const apoyo = Math.abs(y.y) < 0.9 ? Vector3.UP : Vector3.RIGHT
  const x = apoyo.cross(y).normalized()
  const z = x.cross(y).normalized()
  return new Basis(Vector3.MULTIPLY(x, ancho), Vector3.MULTIPLY(y, largo), Vector3.MULTIPLY(z, fondo))
}

/** Una barra de `radio` de `desde` a `hasta` sobre un cilindro unidad (1 m de alto y de diámetro). */
export function barraEntre(desde: Vector3, hasta: Vector3, radio: number): Transform3D {
  const rumbo = Vector3.SUBTRACT(hasta, desde)
  const medio = Vector3.MULTIPLY(Vector3.ADD(desde, hasta), 0.5)
  return new Transform3D(baseHacia(rumbo, radio * 2, rumbo.length(), radio * 2), medio)
}

/**
 * Muchas copias de la misma malla en una sola llamada de dibujo: el `instancedMesh` y los
 * `createInstances` de la web. Con `colores`, cada copia lleva el suyo (el material lo toma del
 * vértice).
 */
export function multimalla(
  mesh: Mesh,
  material: StandardMaterial3D,
  transformaciones: readonly Transform3D[],
  colores?: readonly Color[],
): MultiMeshInstance3D {
  const multi = new MultiMesh()
  multi.transform_format = MultiMesh.TransformFormat.TRANSFORM_3D
  multi.use_colors = colores != null
  multi.mesh = mesh
  multi.instance_count = transformaciones.length
  transformaciones.forEach((t, i) => multi.set_instance_transform(i, t))
  if (colores != null) {
    material.vertex_color_use_as_albedo = true
    colores.forEach((c, i) => multi.set_instance_color(i, c))
  }
  const nodo = new MultiMeshInstance3D()
  nodo.multimesh = multi
  nodo.material_override = material
  return nodo
}

/** Un color de la web para una copia de una multimalla (el `color` de cada `Instance` de drei). */
export function colorDe(hex: string): Color {
  return Color.html(hex)
}
