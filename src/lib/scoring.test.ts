import { describe, expect, it } from 'vitest'
import { DIFFICULTY_ORDER, type Difficulty } from './gameConfig'
import {
  BASE_STICK_POINTS,
  DIFFICULTY_MULTIPLIERS,
  MAX_STREAK_MULTIPLIER,
  maxScore,
  reflexMultiplier,
  scoreRatio,
  stickPoints,
  streakMultiplier,
} from './scoring'

/** Atrapar un palo en el mejor de los casos posibles. */
function perfect(difficulty: Difficulty, streak: number) {
  return stickPoints({ difficulty, streak, fallProgress: 0 })
}

describe('multiplicador de dificultad', () => {
  it('cubre todos los niveles del juego', () => {
    for (const level of DIFFICULTY_ORDER) {
      expect(DIFFICULTY_MULTIPLIERS[level]).toBeGreaterThan(0)
    }
    expect([...DIFFICULTY_ORDER].sort()).toEqual(
      Object.keys(DIFFICULTY_MULTIPLIERS).sort(),
    )
  })

  it('crece con la dificultad, sin empates', () => {
    const values = DIFFICULTY_ORDER.map((l) => DIFFICULTY_MULTIPLIERS[l])
    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(new Set(values).size).toBe(values.length)
  })

  it('elegir difícil renta: una partida corta en Imposible bate a una larga en Fácil', () => {
    // Si no fuera así, la dificultad sería decorativa y todo el mundo jugaría en
    // Fácil con 13 palos.
    expect(maxScore('impossible', 5)).toBeGreaterThan(maxScore('easy', 13))
  })
})

describe('racha', () => {
  it('el primer palo no lleva bonus', () => {
    expect(streakMultiplier(1)).toBe(1)
    expect(streakMultiplier(0)).toBe(1)
  })

  it('cada palo encadenado suma', () => {
    expect(streakMultiplier(2)).toBeGreaterThan(streakMultiplier(1))
    expect(streakMultiplier(5)).toBeGreaterThan(streakMultiplier(4))
  })

  it('tiene tope: una partida larga en Fácil no puede desbocarse', () => {
    expect(streakMultiplier(1000)).toBe(MAX_STREAK_MULTIPLIER)
    expect(streakMultiplier(13)).toBeLessThanOrEqual(MAX_STREAK_MULTIPLIER)
  })
})

describe('reflejos', () => {
  it('cogerlo recién soltado vale el doble que a ras de suelo', () => {
    expect(reflexMultiplier(0)).toBe(2)
    expect(reflexMultiplier(1)).toBe(1)
  })

  it('decrece de forma continua conforme el palo cae', () => {
    let previous = Infinity
    for (let i = 0; i <= 10; i++) {
      const value = reflexMultiplier(i / 10)
      expect(value).toBeLessThan(previous)
      previous = value
    }
  })

  it('un palo cogido mientras cuelga cuenta como el mejor caso', () => {
    // `fallProgress` es negativo mientras no se ha soltado.
    expect(reflexMultiplier(-0.5)).toBe(2)
  })

  it('aguanta valores imposibles sin romper la puntuación', () => {
    expect(reflexMultiplier(4)).toBe(1)
    expect(reflexMultiplier(Number.NaN)).toBe(1)
  })
})

describe('puntos de un palo', () => {
  it('siempre son un número entero', () => {
    for (const level of DIFFICULTY_ORDER) {
      for (const progress of [0, 0.33, 0.5, 0.77, 1]) {
        const points = stickPoints({
          difficulty: level,
          streak: 3,
          fallProgress: progress,
        })
        expect(Number.isInteger(points)).toBe(true)
      }
    }
  })

  it('el caso base es el valor de referencia', () => {
    // Fácil, primer palo, a ras de suelo: sin ningún multiplicador.
    expect(stickPoints({ difficulty: 'easy', streak: 1, fallProgress: 1 })).toBe(
      BASE_STICK_POINTS,
    )
  })

  it('nunca vale menos que el caso base', () => {
    for (const level of DIFFICULTY_ORDER) {
      expect(
        stickPoints({ difficulty: level, streak: 1, fallProgress: 1 }),
      ).toBeGreaterThanOrEqual(BASE_STICK_POINTS)
    }
  })

  it('el mismo palo renta más en una racha viva', () => {
    const cold = stickPoints({ difficulty: 'hard', streak: 1, fallProgress: 0.5 })
    const hot = stickPoints({ difficulty: 'hard', streak: 6, fallProgress: 0.5 })
    expect(hot).toBeGreaterThan(cold)
  })
})

describe('máximo y proporción', () => {
  it('el máximo crece con los palos y con la dificultad', () => {
    expect(maxScore('easy', 13)).toBeGreaterThan(maxScore('easy', 5))
    expect(maxScore('expert', 9)).toBeGreaterThan(maxScore('medium', 9))
  })

  it('una partida perfecta llega al máximo', () => {
    // Se suman los palos uno a uno como lo haría el juego, con la racha viva.
    let total = 0
    for (let i = 1; i <= 7; i++) {
      total += perfect('hard', i)
    }
    expect(total).toBe(maxScore('hard', 7))
    expect(scoreRatio(total, 'hard', 7)).toBe(1)
  })

  it('la proporción se queda entre 0 y 1 pase lo que pase', () => {
    expect(scoreRatio(0, 'easy', 5)).toBe(0)
    expect(scoreRatio(-100, 'easy', 5)).toBe(0)
    expect(scoreRatio(999999, 'easy', 5)).toBe(1)
    // Sin palos no hay partida, y no se puede dividir por cero.
    expect(scoreRatio(0, 'easy', 0)).toBe(0)
  })
})
