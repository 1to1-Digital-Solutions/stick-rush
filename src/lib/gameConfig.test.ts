import { describe, expect, it } from 'vitest'
import {
  type Difficulty,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  DIFFICULTY_SPEEDS,
  fallAcceleration,
  fallDrop,
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

describe('fallAcceleration', () => {
  /** Cota del anclaje `t` segundos después de soltarse desde `height`. */
  function anchorAt(t: number, difficulty: Difficulty, height = MACHINE_HEIGHT) {
    const distance = height - STICK_MISS_Y
    const speed = DIFFICULTY_SPEEDS[difficulty] * (distance / STICK_FALL_DISTANCE)
    return height - fallDrop(t, fallAcceleration(speed, distance))
  }

  it('llega al suelo en el mismo tiempo que cuando caía a velocidad fija', () => {
    // Pasar a gravedad no puede recalibrar los quince niveles ni sus estrellas:
    // la duración de cada dificultad es la de siempre, recorrido entre velocidad.
    for (const difficulty of DIFFICULTY_ORDER) {
      const total = STICK_FALL_DISTANCE / DIFFICULTY_SPEEDS[difficulty]
      expect(fallDurationSeconds(difficulty)).toBe(total)
      expect(anchorAt(total, difficulty)).toBeCloseTo(STICK_MISS_Y, 9)
      expect(anchorAt(total * 0.99, difficulty)).toBeGreaterThan(STICK_MISS_Y)
    }
  })

  it('dura lo mismo con el aro más alto o más bajo', () => {
    for (const height of [MACHINE_HEIGHT - 0.3, MACHINE_HEIGHT + 0.25]) {
      const total = fallDurationSeconds('hard')
      expect(anchorAt(total, 'hard', height)).toBeCloseTo(STICK_MISS_Y, 9)
    }
  })

  it('suelta el palo en reposo y lo acelera', () => {
    const a = fallAcceleration(DIFFICULTY_SPEEDS.medium)
    const dt = 0.1
    const tramos = [0, 1, 2, 3].map((i) => fallDrop((i + 1) * dt, a) - fallDrop(i * dt, a))
    expect(fallDrop(0, a)).toBe(0)
    for (let i = 1; i < tramos.length; i++) {
      expect(tramos[i]).toBeGreaterThan(tramos[i - 1])
    }
  })

  it('en ningún nivel pasa por una altura antes que a velocidad fija', () => {
    // Es lo que garantiza que el margen de reacción no baja: para llegar a
    // cualquier punto del recorrido el palo tarda lo mismo o más que antes, y
    // se queda más tiempo arriba, que es por donde lo alcanza el brazo.
    for (const difficulty of DIFFICULTY_ORDER) {
      const total = fallDurationSeconds(difficulty)
      for (let i = 1; i < 20; i++) {
        const t = (i / 20) * total
        const antes = MACHINE_HEIGHT - DIFFICULTY_SPEEDS[difficulty] * t
        expect(anchorAt(t, difficulty)).toBeGreaterThan(antes)
      }
    }
  })

  it('crece con la dificultad y ni Imposible pasa de la gravedad de verdad', () => {
    // Cada nivel es la misma caída a otra velocidad de reproducción: Fácil a
    // cámara muy lenta, Imposible casi en tiempo real.
    const accelerations = DIFFICULTY_ORDER.map((d) => fallAcceleration(DIFFICULTY_SPEEDS[d]))
    const ascending = [...accelerations].sort((x, y) => x - y)
    expect(accelerations).toEqual(ascending)
    expect(accelerations[accelerations.length - 1]).toBeLessThan(9.81)
  })

  it('con un recorrido imposible no mueve el palo', () => {
    // Antes que NaN (el palo desaparecería) o un negativo (subiría).
    expect(fallAcceleration(1, 0)).toBe(0)
    expect(fallAcceleration(1, Number.NaN)).toBe(0)
    expect(fallAcceleration(Number.NaN)).toBe(0)
    expect(fallDrop(-1, 3)).toBe(0)
    expect(fallDrop(Number.NaN, 3)).toBe(0)
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

  it('se mide en tiempo: a medio recorrido ya ha pasado más de media caída', () => {
    // El palo acelera, así que a mitad de su tiempo solo ha bajado un cuarto.
    const cuarto = MACHINE_HEIGHT - STICK_FALL_DISTANCE / 4
    expect(stickFallProgress(cuarto)).toBeCloseTo(0.5, 6)
    const medio = (MACHINE_HEIGHT + STICK_MISS_Y) / 2
    expect(stickFallProgress(medio)).toBeCloseTo(Math.SQRT1_2, 6)
  })

  it('coincide con el reloj de la caída en cada dificultad', () => {
    // Es la fracción de tiempo de verdad, no una aproximación: el mismo gesto
    // puntúa lo mismo en Fácil que en Imposible.
    for (const difficulty of DIFFICULTY_ORDER) {
      const total = fallDurationSeconds(difficulty)
      const a = fallAcceleration(DIFFICULTY_SPEEDS[difficulty])
      for (const fraction of [0.1, 0.3, 0.6, 0.9]) {
        const y = MACHINE_HEIGHT - fallDrop(fraction * total, a)
        expect(stickFallProgress(y)).toBeCloseTo(fraction, 6)
      }
    }
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
