/**
 * Los palos pintados (`Stick.tsx` de la web): el hilo del que cuelga cada uno mientras cuelga, el
 * palo de madera pintada de amarillo —con el relieve y la rugosidad de la madera de la web y sin su
 * color, que la dejaba marrón— y la onda verde del acierto. Y el gancho de cada palo en el aro
 * (`StickMachine.tsx`).
 *
 * Lo que decide dónde está cada palo y cómo va es `juego/tanda.ts`; aquí solo se lleva a los nodos:
 *
 * - **al atraparlo** el palo se pone verde de golpe, se enciende, crece media vez y se desvanece
 *   mientras la onda sale de donde estaba y se abre;
 * - **al perderlo** se queda en el suelo y se tiñe de rojo, para que el suelo cuente los fallos.
 *
 * Hay trece de cada cosa, los que caben (`MAX_STICKS`), montados de una vez: una tanda con menos
 * esconde los que sobran. Cada palo lleva su material (el destello es suyo), todos del mismo tipo,
 * así que ninguno compila un shader nuevo al atraparse: **transparente desde el principio**, como en
 * la web, porque cambiarlo en caliente recompila justo en el destello.
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

import { PALO_TRAS_EL_MENU, opacidadHacia, paloTapaElMenu } from '@/lib/xrLayout'

import type { Palo, Tanda } from '../juego/tanda'
import { TUBE_RADIUS } from './maquina'
import { cilindro, malla, mallaDeToro, mate, opacidad, translucido } from '@kit/runtime/escena/piezas'

/** Donde viajan en el paquete los mapas de la madera (`public/textures/` de la web). */
export const DIR_DE_LAS_TEXTURAS = 'res://games/stick-rush/texturas'

/** El fichero de cada mapa de `WOOD_TEXTURES`, en el paquete. */
export function rutaDeLaTextura(ruta: string): string {
  return `${DIR_DE_LAS_TEXTURAS}/${ruta.split('/').pop()}`
}

const BASE = Color.html(STICK_COLOR)
const VERDE = Color.html(STICK_CAUGHT_COLOR)
const ROJO = Color.html(STICK_MISSED_COLOR)

interface PaloPintado {
  grupo: Node3D
  hilo: MeshInstance3D
  cuerpo: MeshInstance3D
  material: StandardMaterial3D
  onda: MeshInstance3D
  materialDeLaOnda: StandardMaterial3D
  gancho: MeshInstance3D
  /** Lo último que se le pintó, para no tocar el motor si no ha cambiado. */
  pintado: string
  /** Lo que se ve del palo colgado: 1 entero, `PALO_TRAS_EL_MENU` con el menú detrás. */
  velo: number
  sitio: string
}

function madera(): StandardMaterial3D {
  const m = mate(STICK_COLOR, { rugosidad: 0.75, metal: 0 })
  const normal = ResourceLoader.load(rutaDeLaTextura(WOOD_TEXTURES.normalMap))
  const rugosa = ResourceLoader.load(rutaDeLaTextura(WOOD_TEXTURES.roughnessMap))
  if (normal instanceof Texture2D) {
    m.normal_enabled = true
    m.normal_texture = normal
    m.normal_scale = 0.8
  }
  if (rugosa instanceof Texture2D) {
    m.roughness_texture = rugosa
    // three lee la rugosidad del canal verde.
    m.roughness_texture_channel = BaseMaterial3D.TextureChannel.TEXTURE_CHANNEL_GREEN
  }
  // El grano corre a lo largo del palo, mucho más largo que ancho (`repeat.set(1, 3)`).
  m.uv1_scale = new Vector3(1, 3, 1)
  // Encendible y transparente desde el principio: activarlo en el destello recompilaría.
  m.emission_enabled = true
  m.emission = BASE
  m.emission_energy_multiplier = 0
  m.transparency = BaseMaterial3D.Transparency.TRANSPARENCY_ALPHA_DEPTH_PRE_PASS
  return m
}

export class PalosPintados {
  readonly nodo = new Node3D()
  private readonly pintados: PaloPintado[] = []

  constructor(padre: Node3D) {
    this.nodo.set_name('Palos')
    padre.add_child(this.nodo)
    const materialDelHilo = mate('#4a4038', { rugosidad: 0.9, metal: 0.1 })
    const materialDelGancho = mate(MACHINE_FRAME_COLOR, { rugosidad: 0.3, metal: 0.8 })
    for (let i = 0; i < MAX_STICKS; i++) {
      const grupo = new Node3D()
      grupo.set_name(`Palo${i}`)
      const hilo = cilindro(0.005, 0.005, STICK_CORD_LENGTH, materialDelHilo, new Vector3(0, -STICK_CORD_LENGTH / 2, 0), 6)
      const material = madera()
      const cuerpo = cilindro(STICK_RADIUS, STICK_RADIUS, STICK_LENGTH, material, new Vector3(0, -STICK_CORD_LENGTH - STICK_LENGTH / 2, 0), 16)
      const materialDeLaOnda = translucido(STICK_CAUGHT_COLOR, 0, 2)
      const onda = malla(mallaDeToro(0.05, 0.006, 24, 6), materialDeLaOnda, new Vector3(0, -STICK_CORD_LENGTH - STICK_LENGTH / 2, 0))
      onda.visible = false
      grupo.add_child(hilo)
      grupo.add_child(cuerpo)
      grupo.add_child(onda)
      // El gancho, una anilla sujeta al aro: va con el palo y no se mece con él.
      const gancho = malla(mallaDeToro(0.022, 0.006, 16, 8), materialDelGancho)
      grupo.visible = false
      gancho.visible = false
      this.nodo.add_child(grupo)
      this.nodo.add_child(gancho)
      this.pintados.push({ grupo, hilo, cuerpo, material, onda, materialDeLaOnda, gancho, pintado: '', sitio: '', velo: 1 })
    }
  }

  /** El cuerpo de un palo, para quien quiera saber dónde se pinta (los tests). */
  cuerpo(indice: number): MeshInstance3D {
    return this.pintados[indice].cuerpo
  }

  /**
   * Pinta la tanda: cada palo en su sitio y con su aspecto; los que no son de la tanda, fuera.
   *
   * `enElMenu`: la columna del menú queda detrás de los palos de ese lado, que se atenúan mientras
   * se elige y vuelven poco a poco al pulsar Jugar (`paloTapaElMenu`, como `Stick.tsx`).
   */
  pintar(tanda: Tanda | null, delta = 0, enElMenu = false): void {
    const palos = tanda?.palos ?? []
    this.pintados.forEach((p, i) => {
      const palo = palos[i]
      const visible = palo != null && palo.visible
      if (p.grupo.visible !== visible) p.grupo.visible = visible
      if (p.gancho.visible !== (palo != null)) p.gancho.visible = palo != null
      if (palo == null) return
      const hacia = enElMenu && palo.estado === 'hanging' && paloTapaElMenu(palo.layout.anchor) ? PALO_TRAS_EL_MENU : 1
      if (p.velo !== hacia) p.velo = palo.estado === 'hanging' ? opacidadHacia(p.velo, hacia, delta) : 1
      this.pintarUno(p, palo)
    })
  }

  private pintarUno(p: PaloPintado, palo: Palo): void {
    const [x, ay, z] = palo.layout.anchor
    // Solo se toca el nodo si se ha movido: trece palos quietos en el menú no cuestan nada.
    const sitio = `${x}:${ay}:${z}:${palo.y}:${palo.inclinacion.x}:${palo.inclinacion.z}`
    if (sitio !== p.sitio) {
      p.sitio = sitio
      p.grupo.position = new Vector3(x, palo.y, z)
      p.grupo.rotation = new Vector3(palo.inclinacion.x, 0, palo.inclinacion.z)
      p.gancho.position = new Vector3(x, ay - TUBE_RADIUS - 0.012, z)
    }
    const colgando = palo.estado === 'hanging' && p.velo >= 1
    if (p.hilo.visible !== colgando) p.hilo.visible = colgando
    // Lo que no cambia fotograma a fotograma se pinta solo al cambiar: el destello, el tinte y el velo.
    const clave = `${palo.estado}:${palo.flash.toFixed(3)}:${palo.missTint.toFixed(3)}:${p.velo.toFixed(3)}`
    if (clave === p.pintado) return
    p.pintado = clave
    const m = p.material
    if (palo.estado === 'caught') {
      // El verde entra de golpe: el destello ya es la confirmación.
      const t = palo.flash
      const k = 1 + (1 - t) * 0.5
      p.grupo.scale = new Vector3(k, k, k)
      m.albedo_color = new Color(VERDE.r, VERDE.g, VERDE.b, Math.min(t * 1.6, 1))
      m.emission = VERDE
      m.emission_energy_multiplier = t * 2.4
      p.onda.visible = t > 0
      const r = 0.3 + (1 - t) * 2.6
      p.onda.scale = new Vector3(r, r, r)
      opacidad(p.materialDeLaOnda, t * 0.7)
      return
    }
    p.grupo.scale = Vector3.ONE
    p.onda.visible = false
    if (palo.estado === 'missed') {
      const k = palo.missTint
      m.albedo_color = new Color(BASE.r + (ROJO.r - BASE.r) * k, BASE.g + (ROJO.g - BASE.g) * k, BASE.b + (ROJO.b - BASE.b) * k, 1)
      m.emission = ROJO
      m.emission_energy_multiplier = 0.35 * k
      return
    }
    m.albedo_color = new Color(BASE.r, BASE.g, BASE.b, p.velo)
    m.emission = BASE
    m.emission_energy_multiplier = 0
  }
}
