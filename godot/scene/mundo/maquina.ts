/**
 * La máquina de Stick Rush en Godot (`StickMachine.tsx` y `MachinePieces.tsx` de la web): un aro
 * semicircular horizontal del que cuelgan los palos, montado sobre una celosía —el aro de arriba,
 * montantes y diagonales en zigzag— con sus bombillas, y sostenido por dos postes arriostrados hacia
 * fuera y hacia atrás, con su pie.
 *
 * **Las cotas son las de la web**: la curva es `machinePoint` de `gameConfig.ts`, a la altura del aro
 * que da la partida (`hoopHeight.ts`), y los radios, tramos y separaciones son los números de
 * `StickMachine.tsx`, con su nombre al lado. Cada familia de piezas es una malla múltiple —las cinco
 * de `MachinePieces.tsx`, con sus materiales—, y la máquina se rehace entera cuando el aro cambia de
 * altura, que solo pasa en el menú.
 *
 * Los palos no son de aquí: cuelgan de la máquina pero son de la partida (`mundo/palos.ts`).
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

/** Una esfera de `radio` con `lados` × `anillos` (`sphereGeometry`), para repartir por una malla múltiple. */
function bola(radio: number, lados: number, anillos: number): SphereMesh {
  const mesh = sphere(lados, anillos)
  mesh.radius = radio
  mesh.height = radio * 2
  return mesh
}

/** Tramos del aro principal, a rayas alternas (`ARC_SEGMENTS`). */
export const ARC_SEGMENTS = 24
/** Montantes verticales entre el aro principal y el de arriba (`TRUSS_POSTS`). */
export const TRUSS_POSTS = 9
/** El grosor del aro de los palos (`TUBE_RADIUS`): también baja el gancho de cada palo. */
export const TUBE_RADIUS = 0.032
/** Lo que separa el aro de los palos del de arriba de la celosía (`TRUSS_RISE`). */
export const TRUSS_RISE = 0.34

type Punto = Vector3

function punto(t: number, alto: number, sube = 0): Punto {
  const [x, y, z] = machinePoint(t, alto)
  return new Vector3(x, y + sube, z)
}

/** Lo que hay de cada familia, para quien lo quiera contar (la web lo cuenta en `limits`). */
export interface PiezasDeLaMaquina {
  matte: number
  frame: number
  truss: number
  bulbs: number
}

export class Maquina {
  readonly nodo = new Node3D()
  private alto: number | null = null
  private partes: Node3D | null = null
  private _piezas: PiezasDeLaMaquina = { matte: 0, frame: 0, truss: 0, bulbs: 0 }

  // Los materiales de las cinco familias (`MachinePieces.tsx`): se crean una vez y se reutilizan al
  // rehacer la máquina, que así no vuelve a compilar ningún shader.
  private readonly mate = matte('#ffffff', { rugosidad: 0.55, metal: 0.1 })
  private readonly marco = matte('#ffffff', { rugosidad: 0.35, metal: 0.7 })
  private readonly celosia = matte('#ffffff', { rugosidad: 0.4, metal: 0.6 })
  private readonly casquillo = matte('#3b3630', { rugosidad: 0.6, metal: 0.5 })
  private readonly bombilla = emissive(MACHINE_BULB_COLOR, 1.8, { sinLuz: true })
  private readonly pieDelPoste = matte(MACHINE_FRAME_COLOR, { rugosidad: 0.4, metal: 0.7 })
  private readonly pieDelTirante = matte(MACHINE_TRUSS_COLOR, { rugosidad: 0.45, metal: 0.6 })

  constructor(padre: Node3D) {
    this.nodo.set_name('Maquina')
    padre.add_child(this.nodo)
  }

  get piezas(): PiezasDeLaMaquina {
    return this._piezas
  }

  /** Monta la máquina a esa altura del aro; si ya está a esa altura, no toca nada. */
  colocar(alto: number): void {
    if (alto === this.alto) return
    this.alto = alto
    if (this.partes != null) {
      this.nodo.remove_child(this.partes)
      this.partes.queue_free()
    }
    this.partes = new Node3D()
    this.nodo.add_child(this.partes)
    this.montar(this.partes, alto)
  }

  private montar(partes: Node3D, alto: number): void {
    const tubo = cylinderMesh(0.5, 0.5, 1, 10)
    const rayas: Transform3D[] = []
    const colores = []
    const celosia: Transform3D[] = []
    // El aro de los palos, a rayas, y el de arriba, que cierra la celosía.
    for (let i = 0; i < ARC_SEGMENTS; i++) {
      const desde = punto(i / ARC_SEGMENTS, alto)
      const hasta = punto((i + 1) / ARC_SEGMENTS, alto)
      rayas.push(barBetween(desde, hasta, TUBE_RADIUS))
      colores.push(Color.html(MACHINE_STRIPE_COLORS[i % MACHINE_STRIPE_COLORS.length]))
      celosia.push(barBetween(punto(i / ARC_SEGMENTS, alto, TRUSS_RISE), punto((i + 1) / ARC_SEGMENTS, alto, TRUSS_RISE), 0.02))
    }
    // Montantes y diagonales en zigzag.
    for (let i = 0; i < TRUSS_POSTS; i++) {
      const base = punto(i / (TRUSS_POSTS - 1), alto)
      celosia.push(barBetween(base, Vector3.ADD(base, new Vector3(0, TRUSS_RISE, 0)), 0.013))
      if (i < TRUSS_POSTS - 1) {
        const siguiente = punto((i + 1) / (TRUSS_POSTS - 1), alto)
        celosia.push(
          i % 2 === 0
            ? barBetween(base, Vector3.ADD(siguiente, new Vector3(0, TRUSS_RISE, 0)), 0.013)
            : barBetween(Vector3.ADD(base, new Vector3(0, TRUSS_RISE, 0)), siguiente, 0.013),
        )
      }
    }
    // Los postes, abiertos hacia fuera y hacia atrás para no cerrarle el paso a quien juega, y su
    // tirante.
    const postes: Transform3D[] = []
    for (const lado of [0, 1]) {
      const arriba = punto(lado, alto, TRUSS_RISE)
      const pie = new Vector3(arriba.x * 1.9, GROUND_Y, arriba.z + 0.45)
      const pieDelTirante = new Vector3(arriba.x * 2.3, GROUND_Y, arriba.z + 1.05)
      postes.push(barBetween(pie, arriba, 0.042))
      celosia.push(barBetween(pieDelTirante, punto(lado, alto, TRUSS_RISE * 0.35), 0.019))
      partes.add_child(cylinder(0.13, 0.16, 0.04, this.pieDelPoste, new Vector3(pie.x, GROUND_Y + 0.025, pie.z), 20))
      partes.add_child(cylinder(0.075, 0.095, 0.032, this.pieDelTirante, new Vector3(pieDelTirante.x, GROUND_Y + 0.02, pieDelTirante.z), 16))
    }
    // Las bombillas sobre el aro de arriba, cada una con su casquillo.
    const casquillos: Transform3D[] = []
    const bombillas: Transform3D[] = []
    for (let i = 0; i < TRUSS_POSTS - 1; i++) {
      const p = punto((i + 0.5) / (TRUSS_POSTS - 1), alto)
      casquillos.push(new Transform3D(Basis.IDENTITY, Vector3.ADD(p, new Vector3(0, TRUSS_RISE + 0.03, 0))))
      bombillas.push(new Transform3D(Basis.IDENTITY, Vector3.ADD(p, new Vector3(0, TRUSS_RISE + 0.085, 0))))
    }

    const familias: MultiMeshInstance3D[] = [
      multiMesh(tubo, this.mate, rayas, colores),
      multiMesh(tubo, this.marco, postes, postes.map(() => Color.html(MACHINE_FRAME_COLOR))),
      multiMesh(tubo, this.celosia, celosia, celosia.map(() => Color.html(MACHINE_TRUSS_COLOR))),
      multiMesh(cylinderMesh(0.012, 0.015, 0.038, 8), this.casquillo, casquillos),
      multiMesh(bola(0.024, 14, 14), this.bombilla, bombillas),
    ]
    for (const familia of familias) partes.add_child(familia)
    this._piezas = { matte: rayas.length, frame: postes.length, truss: celosia.length, bulbs: bombillas.length }
  }
}
