import { describe, expect, it } from 'vitest'
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  DIFFICULTY_SPEEDS,
  fallDurationSeconds,
  GROUND_Y,
  MACHINE_HEIGHT,
  MACHINE_RADIUS,
  machinePoint,
  MAX_STICKS,
  MIN_STICKS,
  STICK_FALL_DISTANCE,
  STICK_MISS_Y,
  stickFallProgress,
} from './gameConfig'

/** Distancia del punto al eje vertical que pasa por el jugador. */
function radiusOf([x, , z]: [number, number, number]): number {
  return Math.hypot(x, z)
}

describe('machinePoint', () => {
  it('dibuja un semicírculo horizontal a la altura del aro', () => {
    for (let i = 0; i <= 10; i++) {
      const point = machinePoint(i / 10)
      expect(radiusOf(point)).toBeCloseTo(MACHINE_RADIUS, 6)
      expect(point[1]).toBe(MACHINE_HEIGHT)
    }
  })

  it('reparte de izquierda a derecha por delante del jugador', () => {
    const [leftX, , leftZ] = machinePoint(0)
    const [frontX, , frontZ] = machinePoint(0.5)
    const [rightX, , rightZ] = machinePoint(1)

    expect(leftX).toBeCloseTo(-MACHINE_RADIUS, 6)
    expect(leftZ).toBeCloseTo(0, 6)
    // El jugador mira hacia -Z: el centro del aro le queda justo enfrente.
    expect(frontX).toBeCloseTo(0, 6)
    expect(frontZ).toBeCloseTo(-MACHINE_RADIUS, 6)
    expect(rightX).toBeCloseTo(MACHINE_RADIUS, 6)
    expect(rightZ).toBeCloseTo(0, 6)
  })

  it('avanza de forma monótona en X conforme crece t', () => {
    let previous = -Infinity
    for (let i = 0; i <= 20; i++) {
      const [x] = machinePoint(i / 20)
      expect(x).toBeGreaterThan(previous)
      previous = x
    }
  })

  it('no cruza por detrás del jugador', () => {
    for (let i = 0; i <= 20; i++) {
      const [, , z] = machinePoint(i / 20)
      expect(z).toBeLessThanOrEqual(1e-9)
    }
  })
})

describe('dificultades', () => {
  it('define etiqueta, color y velocidad para cada nivel', () => {
    for (const level of DIFFICULTY_ORDER) {
      expect(DIFFICULTY_SPEEDS[level]).toBeGreaterThan(0)
      expect(DIFFICULTY_LABELS[level]).toBeTruthy()
      expect(DIFFICULTY_COLORS[level]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('no deja fuera del selector ninguna dificultad declarada', () => {
    expect([...DIFFICULTY_ORDER].sort()).toEqual(
      Object.keys(DIFFICULTY_SPEEDS).sort(),
    )
  })

  it('ordena los niveles de más lento a más rápido', () => {
    const speeds = DIFFICULTY_ORDER.map((level) => DIFFICULTY_SPEEDS[level])
    const ascending = [...speeds].sort((a, b) => a - b)
    expect(speeds).toEqual(ascending)
    expect(new Set(speeds).size).toBe(speeds.length)
  })
})

describe('fallDurationSeconds', () => {
  it('mide la caída desde el aro hasta que la punta toca el suelo', () => {
    expect(STICK_MISS_Y).toBeGreaterThan(GROUND_Y)
    expect(STICK_MISS_Y).toBeLessThan(MACHINE_HEIGHT)
    expect(STICK_FALL_DISTANCE).toBeCloseTo(MACHINE_HEIGHT - STICK_MISS_Y, 6)
  })

  it('mantiene el margen de reacción de cada dificultad', () => {
    // Rangos del diseño (ver ESTADO.md): Fácil ~5.7 s, Imposible ~0.7 s. Si un
    // ajuste de geometría o de velocidad los saca de aquí, el juego deja de ser
    // jugable en un extremo o trivial en el otro.
    expect(fallDurationSeconds('easy')).toBeGreaterThan(4)
    expect(fallDurationSeconds('easy')).toBeLessThan(8)
    expect(fallDurationSeconds('impossible')).toBeGreaterThan(0.4)
    expect(fallDurationSeconds('impossible')).toBeLessThan(1)
  })

  it('acorta el margen conforme sube la dificultad', () => {
    const durations = DIFFICULTY_ORDER.map(fallDurationSeconds)
    const descending = [...durations].sort((a, b) => b - a)
    expect(durations).toEqual(descending)
  })
})

describe('límites de palos', () => {
  it('respeta el rango 5–13 del enunciado', () => {
    expect(MIN_STICKS).toBe(5)
    expect(MAX_STICKS).toBe(13)
  })
})

describe('cuánto lleva caído el palo', () => {
  it('recién soltado no ha caído nada, y abajo del todo ha caído entero', () => {
    // Es lo que decide el premio por reflejos: cogerlo arriba vale más.
    expect(stickFallProgress(MACHINE_HEIGHT)).toBe(0)
    expect(stickFallProgress(STICK_MISS_Y)).toBe(1)
  })

  it('a media caída va por la mitad', () => {
    const medio = (MACHINE_HEIGHT + STICK_MISS_Y) / 2
    expect(stickFallProgress(medio)).toBeCloseTo(0.5, 6)
  })

  it('se mide contra la altura del aro de cada jugador, no contra la nominal', () => {
    // Con la máquina puesta a la altura de quien juega el recorrido cambia:
    // medirlo siempre contra la nominal regalaría reflejos a quien la tenga
    // baja y se los quitaría a quien la tenga alta.
    const bajo = MACHINE_HEIGHT - 0.4
    expect(stickFallProgress(bajo, bajo)).toBe(0)
    expect(stickFallProgress(bajo)).toBeGreaterThan(0)
  })

  it('lo que se sale del recorrido se recorta', () => {
    expect(stickFallProgress(MACHINE_HEIGHT + 5)).toBe(0)
    expect(stickFallProgress(STICK_MISS_Y - 5)).toBe(1)
  })

  it('una altura imposible se lee como recién soltado', () => {
    // Llega de la escena cada fotograma: en uno perdido puede venir como NaN, y
    // con eso el premio por reflejos saldría de la nada.
    expect(stickFallProgress(Number.NaN)).toBe(0)
    expect(stickFallProgress(1, Number.NaN)).toBe(0)
    expect(stickFallProgress(1, STICK_MISS_Y)).toBe(0)
  })
})
