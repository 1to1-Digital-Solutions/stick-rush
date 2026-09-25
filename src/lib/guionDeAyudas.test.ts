import { describe, expect, it } from 'vitest'

import { avanzarLasAyudas, problemasDelGuion, sinAyudas } from './ayudas'
import { MACHINE_RADIUS, PLAYER_OFFSET_Z, STICK_CORD_LENGTH, STICK_LENGTH } from './gameConfig'
import {
  CAIDA,
  GUION_DE_AYUDAS,
  HUELLA,
  HUELLAS,
  MANDO_JUNTO_AL_PALO,
  caidaDelFantasma,
  mandoJuntoAlPalo,
  paloDelFantasma,
  vanACaer,
  type HechoDeLasAyudas,
} from './guionDeAyudas'
import { HOOP_RISE_ABOVE_EYES, hoopHeightFor } from './hoopHeight'
import { TUTORIAL_BUTTONS } from './tutorial'

/**
 * Las ayudas de la máquina, medidas sin navegador: que se apaguen solas, que se vayan antes de
 * que caiga nada, y que lo que se pinta no tape ni la máquina ni los palos.
 */

const NADA: Record<HechoDeLasAyudas, boolean> = { grab: false, cae: false }

function encendidasTras(hechos: Record<HechoDeLasAyudas, boolean>, segundos: number) {
  const estado = sinAyudas()
  avanzarLasAyudas(GUION_DE_AYUDAS, hechos, estado, segundos)
  return [...estado.encendidas].sort()
}

/** Estaturas de quien juega, de sentado a muy alto, y el aro que le toca a cada una. */
const OJOS = [1.1, 1.3, 1.6, 1.8, 2.0]
const aroPara = (ojos: number) => hoopHeightFor({ eyeHeight: ojos, adjustment: 0 })

describe('el guion de las ayudas', () => {
  it('pasa el guardián común: plazos entre el mínimo y el máximo, y nada duplicado', () => {
    expect(problemasDelGuion(GUION_DE_AYUDAS)).toEqual([])
  })

  it('al entrar en la cabina se enseña todo: dónde ponerse, el palo que cae y el mando', () => {
    expect(encendidasTras(NADA, 0)).toEqual(['mando', 'palo', 'suelo'])
  })

  it('el fantasma y el mando se van antes de que caiga el primer palo', () => {
    // Flotan por donde pasa un palo al caer: solo valen mientras no pasa ninguno.
    expect(encendidasTras({ ...NADA, cae: true }, 0)).toEqual(['suelo'])
  })

  it('las huellas se quedan mientras se juega, hasta el primer palo atrapado', () => {
    expect(encendidasTras({ grab: true, cae: true }, 0)).toEqual([])
  })

  it('y si nadie hace nada, todas se van solas', () => {
    const plazo = Math.max(...GUION_DE_AYUDAS.map((ayuda) => ayuda.caduca))
    expect(encendidasTras(NADA, plazo)).toEqual([])
  })

  it('el mando enseña el botón con el que se atrapa, el mismo que el tutorial', () => {
    expect(TUTORIAL_BUTTONS.grab).toBe('agarre')
  })
})

describe('cuándo van a caer los palos', () => {
  it('en el menú y al principio de la cuenta atrás, todavía no', () => {
    expect(vanACaer('menu', 0)).toBe(false)
    expect(vanACaer('countdown', 3)).toBe(false)
    expect(vanACaer('countdown', 2)).toBe(false)
  })

  it('en el último segundo de la cuenta, sí: lo que flota tiene medio segundo para irse', () => {
    expect(vanACaer('countdown', 1)).toBe(true)
    expect(vanACaer('playing', 0)).toBe(true)
  })

  it('con la partida acabada no cae nada', () => {
    expect(vanACaer('finished', 0)).toBe(false)
  })
})

describe('la caída del fantasma', () => {
  it('aparece quieto donde cuelga el palo', () => {
    expect(caidaDelFantasma(0)).toEqual({ bajada: 0, se: 0 })
    expect(caidaDelFantasma(CAIDA.aparece / 2)).toEqual({ bajada: 0, se: 0.5 })
  })

  it('cae acelerando, como cae algo de verdad', () => {
    const tramo = (CAIDA.cae - CAIDA.aparece) / 4
    const bajadas = [1, 2, 3].map((i) => caidaDelFantasma(CAIDA.aparece + tramo * i).bajada)
    expect(bajadas[1] - bajadas[0]).toBeGreaterThan(bajadas[0])
    expect(bajadas[2] - bajadas[1]).toBeGreaterThan(bajadas[1] - bajadas[0])
  })

  it('se para abajo, que es el atrape, y solo entonces se desvanece', () => {
    expect(caidaDelFantasma(CAIDA.cae)).toEqual({ bajada: CAIDA.recorrido, se: 1 })
    expect(caidaDelFantasma((CAIDA.cae + CAIDA.seVa) / 2)).toEqual({ bajada: CAIDA.recorrido, se: 1 })
    expect(caidaDelFantasma(1)).toEqual({ bajada: CAIDA.recorrido, se: 0 })
  })

  it('fuera de la vuelta se queda en sus extremos', () => {
    expect(caidaDelFantasma(-1)).toEqual(caidaDelFantasma(0))
    expect(caidaDelFantasma(2)).toEqual(caidaDelFantasma(1))
  })
})

describe('nada tapa la máquina ni los palos', () => {
  it('el fantasma sale del palo de delante, en su sitio', () => {
    const [x, y, z] = paloDelFantasma(1.95)
    expect(x).toBe(0)
    expect(z).toBe(-MACHINE_RADIUS)
    expect(y).toBeCloseTo(1.95 - STICK_CORD_LENGTH - STICK_LENGTH / 2, 9)
  })

  it('y se para a la altura del pecho, por debajo de todo lo que cuelga, sea quien sea', () => {
    for (const ojos of OJOS) {
      const aro = aroPara(ojos)
      const [, y] = paloDelFantasma(aro)
      const abajo = y - CAIDA.recorrido
      const puntaDeLosPalos = aro - STICK_CORD_LENGTH - STICK_LENGTH
      // Su punta de arriba queda bajo las puntas de los palos colgados: parado, no se mete en
      // la cortina de palos.
      expect(abajo + STICK_LENGTH / 2, `ojos a ${ojos}`).toBeLessThan(puntaDeLosPalos)
      // Y donde la mano llega sin estirarse: por debajo de los ojos y por encima de la cintura.
      expect(abajo, `ojos a ${ojos}`).toBeLessThan(ojos)
      expect(abajo, `ojos a ${ojos}`).toBeGreaterThan(ojos - 0.6)
    }
  })

  it('el mando va por debajo de los ojos y por delante del aro: detrás de él solo hay suelo', () => {
    // Mirando hacia abajo, la recta de los ojos al mando sigue hacia el suelo, no hacia los palos
    // que cuelgan por encima de los ojos (`HOOP_RISE_ABOVE_EYES`).
    expect(HOOP_RISE_ABOVE_EYES - STICK_CORD_LENGTH - STICK_LENGTH).toBeGreaterThanOrEqual(0)
    for (const ojos of OJOS) {
      for (const mano of ['left', 'right'] as const) {
        const { posicion } = mandoJuntoAlPalo(aroPara(ojos), mano)
        const [x, y, z] = posicion
        const arriba = y + 0.06 * MANDO_JUNTO_AL_PALO.escala
        expect(arriba, `ojos a ${ojos}, ${mano}`).toBeLessThan(ojos)
        expect(Math.hypot(x, z), `ojos a ${ojos}, ${mano}`).toBeLessThan(MACHINE_RADIUS)
      }
    }
  })

  it('las huellas quedan a los pies de quien juega, lejos de donde caen los palos', () => {
    for (const { x, z } of HUELLAS) {
      expect(z).toBe(PLAYER_OFFSET_Z)
      const lejos = Math.hypot(Math.abs(x) + HUELLA.ancho / 2, Math.abs(z) + HUELLA.largo / 2)
      expect(lejos).toBeLessThan(MACHINE_RADIUS - 0.2)
    }
  })
})

describe('el mando junto al fantasma', () => {
  it('va del lado de la mano buena', () => {
    expect(mandoJuntoAlPalo(1.95, 'right').posicion[0]).toBeGreaterThan(0)
    expect(mandoJuntoAlPalo(1.95, 'left').posicion[0]).toBeLessThan(0)
  })

  it('a la altura donde el fantasma se para', () => {
    const [, y] = paloDelFantasma(1.95)
    expect(mandoJuntoAlPalo(1.95, 'right').posicion[1]).toBeCloseTo(y - CAIDA.recorrido, 9)
  })

  it('girado con el costado del agarre de cara a quien juega', () => {
    // El agarre del derecho está en su −X y el del izquierdo en su +X; girados sobre la vertical,
    // ese costado tiene que apuntar a las huellas.
    for (const mano of ['left', 'right'] as const) {
      const { posicion, giro } = mandoJuntoAlPalo(1.95, mano)
      const costado = mano === 'right' ? -1 : 1
      const haciaDonde = [costado * Math.cos(giro), -costado * Math.sin(giro)]
      const haciaQuienJuega = [-posicion[0], PLAYER_OFFSET_Z - posicion[2]]
      const largo = Math.hypot(haciaQuienJuega[0], haciaQuienJuega[1])
      const coseno = (haciaDonde[0] * haciaQuienJuega[0] + haciaDonde[1] * haciaQuienJuega[1]) / largo
      expect(coseno, mano).toBeCloseTo(1, 9)
    }
  })
})
