import { describe, expect, it } from 'vitest'
import { MACHINE_RADIUS, MAX_STICKS, MIN_STICKS } from './gameConfig'
import {
  buildStickLayout,
  fallOrder,
  seededRandom,
  stickStatuses,
} from './stickLayout'

describe('seededRandom', () => {
  it('devuelve siempre un valor en [0, 1)', () => {
    for (let i = 0; i < 50; i++) {
      for (let run = 0; run < 5; run++) {
        const value = seededRandom(i, run)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(1)
      }
    }
  })

  it('es determinista: la misma semilla da el mismo valor', () => {
    expect(seededRandom(3, 7)).toBe(seededRandom(3, 7))
  })

  it('cambia con el palo y con la partida', () => {
    expect(seededRandom(3, 7)).not.toBe(seededRandom(4, 7))
    expect(seededRandom(3, 7)).not.toBe(seededRandom(3, 8))
  })
})

describe('buildStickLayout', () => {
  it('crea un palo por cada unidad pedida', () => {
    for (let count = MIN_STICKS; count <= MAX_STICKS; count++) {
      expect(buildStickLayout(count, 1)).toHaveLength(count)
    }
  })

  it('cuelga todos los palos del aro, sin apoyarlos en los postes', () => {
    const layout = buildStickLayout(MAX_STICKS, 1)
    for (const stick of layout) {
      const [x, , z] = stick.anchor
      expect(Math.hypot(x, z)).toBeCloseTo(MACHINE_RADIUS, 6)
      // Los extremos exactos del semicírculo son donde van los postes.
      expect(Math.abs(x)).toBeLessThan(MACHINE_RADIUS)
    }
  })

  it('los reparte de izquierda a derecha sin solaparlos', () => {
    const xs = buildStickLayout(9, 1).map((stick) => stick.anchor[0])
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    expect(new Set(xs).size).toBe(xs.length)
  })

  it('centra el reparto: es simétrico respecto al frente del jugador', () => {
    const xs = buildStickLayout(7, 1).map((stick) => stick.anchor[0])
    expect(xs[3]).toBeCloseTo(0, 6)
    expect(xs[0]).toBeCloseTo(-xs[6], 6)
  })

  it('escalona la caída: uno sale ya y el resto se van repartiendo', () => {
    const delays = buildStickLayout(MAX_STICKS, 4).map((stick) => stick.delay)

    // Exactamente un palo abre la partida, y cada turno espera en torno a un
    // segundo más que el anterior, más el jitter.
    expect(delays.filter((delay) => delay === 0)).toHaveLength(1)
    const sorted = [...delays].sort((a, b) => a - b)
    sorted.forEach((delay, turn) => {
      expect(delay).toBeGreaterThanOrEqual(turn)
      expect(delay).toBeLessThanOrEqual(turn * 1.5)
    })
  })

  it('no suelta los palos en el orden en que están colgados', () => {
    // El fallo que se veía en el visor: caían siempre de izquierda a derecha,
    // así que la partida era predecible. Se comprueba en varias partidas
    // porque una baraja concreta podría salir casi ordenada por azar.
    const correlated = [1, 2, 3, 4, 5].filter((runId) => {
      const delays = buildStickLayout(MAX_STICKS, runId).map((s) => s.delay)
      const ascending = delays.every(
        (delay, i) => i === 0 || delay > delays[i - 1],
      )
      return ascending
    })
    expect(correlated).toEqual([])
  })

  it('reparte turnos distintos en cada partida', () => {
    const first = fallOrder(MAX_STICKS, 1)
    const second = fallOrder(MAX_STICKS, 2)
    expect(first).not.toEqual(second)
  })

  it('cada palo cae exactamente una vez', () => {
    for (let count = MIN_STICKS; count <= MAX_STICKS; count++) {
      const order = fallOrder(count, 7)
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: count }, (_, i) => i),
      )
    }
  })

  it('desordena los retardos sin volverlos metronómicos', () => {
    const delays = buildStickLayout(MAX_STICKS, 4).map((stick) => stick.delay)
    const gaps = delays.slice(1).map((delay, i) => delay - delays[i])
    expect(new Set(gaps.map((gap) => gap.toFixed(4))).size).toBeGreaterThan(1)
  })

  it('da claves únicas y distintas en cada partida', () => {
    const first = buildStickLayout(MIN_STICKS, 1).map((stick) => stick.key)
    const second = buildStickLayout(MIN_STICKS, 2).map((stick) => stick.key)
    expect(new Set(first).size).toBe(first.length)
    expect(first).not.toEqual(second)
  })

  it('es puro: dos llamadas iguales dan el mismo reparto', () => {
    expect(buildStickLayout(8, 3)).toEqual(buildStickLayout(8, 3))
  })

  it('varía la secuencia entre partidas con los mismos palos', () => {
    const first = buildStickLayout(8, 3).map((stick) => stick.delay)
    const second = buildStickLayout(8, 4).map((stick) => stick.delay)
    expect(first).not.toEqual(second)
  })

  it('coloca el palo único en el centro', () => {
    const [only] = buildStickLayout(1, 1)
    expect(only.anchor[0]).toBeCloseTo(0, 6)
    expect(only.anchor[2]).toBeCloseTo(-MACHINE_RADIUS, 6)
  })
})

describe('stickStatuses', () => {
  it('pinta primero los atrapados, luego los perdidos y al final los pendientes', () => {
    expect(stickStatuses(2, 3, 5)).toEqual([
      'caught',
      'caught',
      'missed',
      'pending',
      'pending',
    ])
  })

  it('marca todos los palos al acabar la partida', () => {
    expect(stickStatuses(5, 5, 5)).toEqual(Array(5).fill('caught'))
    expect(stickStatuses(0, 5, 5)).toEqual(Array(5).fill('missed'))
  })

  it('arranca la partida con todo pendiente', () => {
    expect(stickStatuses(0, 0, 3)).toEqual(['pending', 'pending', 'pending'])
  })

  it('no se rompe con un marcador vacío', () => {
    expect(stickStatuses(0, 0, 0)).toEqual([])
  })
})
