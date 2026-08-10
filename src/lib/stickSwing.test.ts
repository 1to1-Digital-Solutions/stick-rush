import { describe, expect, it } from 'vitest'
import {
  SWING_AMPLITUDE,
  SWING_CROSS_RATIO,
  hangingSwing,
} from './stickSwing'

/** Un muestreo denso de una fase concreta, para medir el recorrido. */
function sample(phase: number, seconds = 20, step = 1 / 60) {
  const tilts = []
  for (let time = 0; time <= seconds; time += step) {
    tilts.push(hangingSwing(time, phase))
  }
  return tilts
}

const PHASES = [0, 0.13, 0.37, 0.5, 0.62, 0.88, 0.999]

describe('hangingSwing', () => {
  it('mece el palo unos pocos grados, no lo tumba', () => {
    // El palo cuelga de un gancho fijo: si el vaivén se pasa de ahí, se separa
    // de sus vecinos o se cruza con ellos.
    expect(SWING_AMPLITUDE).toBeLessThan((6 * Math.PI) / 180)

    for (const phase of PHASES) {
      for (const tilt of sample(phase, 5)) {
        expect(Math.abs(tilt.z)).toBeLessThanOrEqual(SWING_AMPLITUDE)
        expect(Math.abs(tilt.x)).toBeLessThanOrEqual(
          SWING_AMPLITUDE * SWING_CROSS_RATIO,
        )
      }
    }
  })

  it('se mueve de verdad: recorre casi toda su amplitud en unos segundos', () => {
    // Es lo que la máquina no hacía: quedarse quieta. Un vaivén demasiado corto
    // (o parado) no arregla nada aunque el código lo llame balanceo.
    for (const phase of PHASES) {
      const zs = sample(phase, 4).map((tilt) => tilt.z)
      const recorrido = Math.max(...zs) - Math.min(...zs)
      expect(recorrido).toBeGreaterThan(SWING_AMPLITUDE * 1.8)
    }
  })

  it('no da tirones entre fotogramas', () => {
    // A 60 fps el salto de un fotograma al siguiente tiene que ser
    // imperceptible: un vaivén a saltos se lee como un fallo, no como inercia.
    for (const phase of PHASES) {
      const tilts = sample(phase, 5)
      tilts.slice(1).forEach((tilt, index) => {
        const previous = tilts[index]
        expect(Math.abs(tilt.z - previous.z)).toBeLessThan(0.005)
        expect(Math.abs(tilt.x - previous.x)).toBeLessThan(0.005)
      })
    }
  })

  it('no mueve todos los palos a la vez', () => {
    // Trece palos con la misma receta y el mismo reloj se moverían como un
    // bloque, que es peor que no moverse: se ve mecánico.
    const separados = PHASES.slice(1).filter((phase) => {
      const propio = sample(phase, 6).map((tilt) => tilt.z)
      const otro = sample(PHASES[0], 6).map((tilt) => tilt.z)
      const mayorDiferencia = Math.max(
        ...propio.map((z, index) => Math.abs(z - otro[index])),
      )
      return mayorDiferencia > SWING_AMPLITUDE
    })
    expect(separados).toEqual(PHASES.slice(1))
  })

  it('describe una elipse, no una línea', () => {
    // Los dos ejes van a ritmos distintos, así que el palo no repite siempre el
    // mismo trazo: en unos instantes se inclina hacia el mismo lado en ambos
    // ejes y en otros hacia lados contrarios.
    const signos = sample(0.4, 20).map((tilt) => Math.sign(tilt.x * tilt.z))
    expect(signos).toContain(1)
    expect(signos).toContain(-1)
  })

  it('es puro: mismo instante y misma fase, misma inclinación', () => {
    expect(hangingSwing(3.5, 0.42)).toEqual(hangingSwing(3.5, 0.42))
  })
})
