/**
 * Los palos de una tanda en Godot: lo que en la web hace cada `Stick.tsx` fotograma a fotograma,
 * sin pintar nada.
 *
 * Cada palo cuelga de su punto del aro (`buildStickLayout`, con la semilla de la tanda), espera su
 * turno meciéndose (`hangingSwing`), se suelta y cae **desde el reposo, acelerando** con la
 * aceleración de su propio recorrido (`fallAcceleration`, `fallDrop`), y acaba atrapado —con su
 * destello, que dura lo que dura en la web— o en el suelo, teñido de rojo. **Se coge colgando o
 * cayendo, hasta que toca el suelo** (`canCatchStick`), y cuánto llevaba cayendo, en tiempo, decide
 * el bonus por reflejos (`stickFallProgress`). Todo sale de `src/lib` tal cual; aquí solo corre el
 * reloj de cada palo con sus mismas reglas y sus mismas constantes (`CATCH_FLASH_DECAY`,
 * `MISS_TINT_SPEED`, que en la web viven dentro del componente).
 *
 * **Como en la web, los palos no vuelven a montarse por cambiar el aro de altura o el número de
 * palos en el menú**: los que ya había conservan su estado (un palo perdido sigue en el suelo) y
 * solo cambia su anclaje. Una tanda nueva —otra partida, otra recarga de la partida sin fin— sí trae
 * palos nuevos. Quién decide cuándo es nueva es la escena, con la clave (`claveDeLaTanda`).
 *
 * No toca el motor, así que se prueba entera en `tanda.motor.test.ts`.
 */
import {
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_MISS_Y,
  fallAcceleration,
  fallDrop,
  stickFallProgress,
} from '@/lib/gameConfig'
import { buildStickLayout, type StickLayout } from '@/lib/stickLayout'
import { SWING_RELEASE_DECAY, hangingSwing, type SwingTilt } from '@/lib/stickSwing'
import { canCatchStick, type StickState } from '@/lib/xrInteraction'

/** A qué ritmo se apaga el destello del acierto, 1/s (`CATCH_FLASH_DECAY` de `Stick.tsx`). */
export const CATCH_FLASH_DECAY = 1.8
/** A qué ritmo se tiñe de rojo el palo perdido, 1/s (`MISS_TINT_SPEED` de `Stick.tsx`). */
export const MISS_TINT_SPEED = 3.5
/** El paso más largo que se da de una vez: un salto tras un tirón no suelta media tanda (`Stick.tsx`). */
export const PASO_MAXIMO = 0.05

export type Vec3 = [number, number, number]

/** Un palo y su reloj: lo que en la web son el estado y los `ref` de `Stick.tsx`. */
export interface Palo {
  readonly indice: number
  layout: StickLayout
  estado: StickState
  /** Segundos de partida desde que se montó: decide cuándo se suelta (`elapsed`). */
  elapsed: number
  /** Segundos que lleva cayendo: la cota sale de aquí, no de sumar pasos (`fallTime`). */
  fallTime: number
  /** Reloj del vaivén, que corre también con la partida parada (`swingTime`). */
  swingTime: number
  /** Cuánto del vaivén se aplica, de 1 colgando a 0 soltado (`swingLevel`). */
  swingLevel: number
  /** Inclinación de ahora: la del vaivén por su nivel. */
  inclinacion: SwingTilt
  /** El destello del acierto, de 1 a 0 (`flash`). */
  flash: number
  /** Cuánto se ha teñido de rojo el palo perdido, de 0 a 1 (`missTint`). */
  missTint: number
  /** La cota del anclaje: la del aro colgando, más abajo cayendo, `STICK_MISS_Y` en el suelo. */
  y: number
  /** Se esconde al acabar el destello del acierto. */
  visible: boolean
}

/** Lo que pasa en un fotograma: los palos que han tocado el suelo, por índice. */
export interface SucesosDeLaTanda {
  perdidos: number[]
}

/** La clave de una tanda: con otra, palos nuevos (en la web, la `key` de cada `Stick`). */
export function claveDeLaTanda(runId: number, semilla: number): string {
  return `${runId}:${semilla >>> 0}`
}

/**
 * Dónde está el cuerpo de un palo, de su punta de arriba a la de abajo, en el espacio de la
 * máquina: cuelga un hilo por debajo del anclaje, inclinado con el vaivén (primero sobre `Z`, luego
 * sobre `X`, que es el orden de three para un giro sin `Y`).
 */
export function cuerpoDelPalo(palo: Palo): { arriba: Vec3; abajo: Vec3 } {
  const [ax, , az] = palo.layout.anchor
  const { x: bx, z: bz } = palo.inclinacion
  const punta = (d: number): Vec3 => {
    const sx = d * Math.sin(bz)
    const sy = -d * Math.cos(bz)
    return [ax + sx, palo.y + sy * Math.cos(bx), az + sy * Math.sin(bx)]
  }
  return { arriba: punta(STICK_CORD_LENGTH), abajo: punta(STICK_CORD_LENGTH + STICK_LENGTH) }
}

function nuevoPalo(layout: StickLayout, indice: number, mece: boolean): Palo {
  return {
    indice,
    layout,
    estado: 'hanging',
    elapsed: 0,
    fallTime: 0,
    swingTime: 0,
    // Nace a 0 si no se mece: empezar a 1 lo dejaría naciendo inclinado y enderezándose.
    swingLevel: mece ? 1 : 0,
    inclinacion: { x: 0, z: 0 },
    flash: 0,
    missTint: 0,
    y: layout.anchor[1],
    visible: true,
  }
}

export class Tanda {
  palos: Palo[] = []
  private semilla: number
  private cuantos = 0
  private alto = 0

  constructor(
    readonly clave: string,
    semilla: number,
    cuantos: number,
    alto: number,
    /** Si los palos se mecen colgando: en la web se apaga con `prefers-reduced-motion`. */
    private readonly mece = true,
  ) {
    this.semilla = semilla
    this.colocar(cuantos, alto)
  }

  /**
   * Con otro número de palos u otra altura del aro, el reparto nuevo (`buildStickLayout`) sin
   * perder lo que llevaba cada palo que sigue: los que sobran se van, los que faltan nacen colgando.
   * El palo que se mueve con el aro se lleva la cota nueva; el perdido sigue en el suelo.
   */
  colocar(cuantos: number, alto: number): void {
    if (cuantos === this.cuantos && alto === this.alto) return
    this.cuantos = cuantos
    this.alto = alto
    const layouts = buildStickLayout(cuantos, this.semilla, alto)
    this.palos = layouts.map((layout, i) => {
      const antes = this.palos[i]
      if (antes == null) return nuevoPalo(layout, i, this.mece)
      const seMueve = antes.layout.anchor[1] !== layout.anchor[1]
      antes.layout = layout
      if (seMueve && antes.estado !== 'missed') antes.y = layout.anchor[1]
      return antes
    })
  }

  /**
   * Un fotograma de todos los palos. `parada` es la partida parada (menú, cuenta atrás, final o la
   * pregunta delante): el reloj de cada palo no corre, pero el vaivén sí. `velocidad` es la media de
   * la dificultad ya corregida para la altura del aro (`hoopFallSpeed`).
   */
  avanzar(delta: number, { parada, velocidad }: { parada: boolean; velocidad: number }): SucesosDeLaTanda {
    const d = Math.min(Math.max(0, delta), PASO_MAXIMO)
    const perdidos: number[] = []
    for (const palo of this.palos) {
      if (!parada) palo.elapsed += d

      // El vaivén: el palo colgado se mece; en cuanto se suelta se endereza.
      if (this.mece && palo.estado === 'hanging') {
        palo.swingTime += d
        palo.swingLevel = 1
      } else if (palo.swingLevel > 0) {
        palo.swingLevel = Math.max(0, palo.swingLevel - d * SWING_RELEASE_DECAY)
      }
      if (palo.swingLevel > 0) {
        const t = hangingSwing(palo.swingTime, palo.layout.swingPhase)
        palo.inclinacion = { x: t.x * palo.swingLevel, z: t.z * palo.swingLevel }
      } else palo.inclinacion = { x: 0, z: 0 }

      // El destello del acierto se apaga y, al acabar, el palo se va.
      if (palo.flash > 0) {
        palo.flash = Math.max(0, palo.flash - d * CATCH_FLASH_DECAY)
        if (palo.flash <= 0 && palo.estado === 'caught') palo.visible = false
      }
      if (palo.estado === 'missed' && palo.missTint < 1) palo.missTint = Math.min(1, palo.missTint + d * MISS_TINT_SPEED)

      if (palo.estado === 'hanging') {
        if (!parada && palo.elapsed >= palo.layout.delay) palo.estado = 'falling'
        continue
      }
      if (palo.estado === 'falling' && !parada) {
        palo.fallTime += d
        const [, ay] = palo.layout.anchor
        palo.y = ay - fallDrop(palo.fallTime, fallAcceleration(velocidad, ay - STICK_MISS_Y))
        if (palo.y <= STICK_MISS_Y) {
          palo.y = STICK_MISS_Y
          palo.estado = 'missed'
          perdidos.push(palo.indice)
        }
      }
    }
    return { perdidos }
  }

  /** Si ese palo se puede coger ahora (`canCatchStick`). */
  sePuedeCoger(indice: number, parada: boolean): boolean {
    const palo = this.palos[indice]
    return palo != null && canCatchStick(palo.estado, parada)
  }

  /**
   * Coge un palo, si se puede: se enciende y devuelve cuánto llevaba cayendo, en fracción de su
   * tiempo de caída (`stickFallProgress`, contra su propio anclaje). `null` si no se podía.
   */
  atrapar(indice: number, parada: boolean): number | null {
    if (!this.sePuedeCoger(indice, parada)) return null
    const palo = this.palos[indice]
    palo.estado = 'caught'
    palo.flash = 1
    return stickFallProgress(palo.y, palo.layout.anchor[1])
  }

  /** Los palos que se pueden coger ahora, por índice. */
  cogibles(parada: boolean): Palo[] {
    return this.palos.filter((p) => canCatchStick(p.estado, parada))
  }
}
