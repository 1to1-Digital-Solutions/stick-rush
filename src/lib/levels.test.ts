import { describe, expect, it } from 'vitest'
import { DIFFICULTY_ORDER } from './gameConfig'
import {
  LEVEL_COUNT,
  LEVEL_STICK_STEPS,
  clampLevel,
  levelPassed,
  levelSpec,
  levelStars,
  nextUnlocked,
} from './levels'

describe('la escalera de niveles', () => {
  it('empieza por lo más fácil y la tanda más corta', () => {
    expect(levelSpec(1)).toEqual({ level: 1, difficulty: DIFFICULTY_ORDER[0], stickCount: LEVEL_STICK_STEPS[0] })
  })

  it('sube los palos antes que la velocidad, y recorre todas las velocidades', () => {
    expect(levelSpec(2).difficulty).toBe(DIFFICULTY_ORDER[0])
    expect(levelSpec(2).stickCount).toBeGreaterThan(levelSpec(1).stickCount)
    expect(levelSpec(4).difficulty).toBe(DIFFICULTY_ORDER[1])
    expect(levelSpec(4).stickCount).toBe(LEVEL_STICK_STEPS[0])
    expect(levelSpec(LEVEL_COUNT).difficulty).toBe(DIFFICULTY_ORDER[DIFFICULTY_ORDER.length - 1])
    expect(LEVEL_COUNT).toBe(15)
  })

  it('un nivel que no existe cae al borde más cercano', () => {
    expect(clampLevel(0)).toBe(1)
    expect(clampLevel(LEVEL_COUNT + 10)).toBe(LEVEL_COUNT)
    expect(clampLevel(2.7)).toBe(2)
    expect(clampLevel(Number.NaN)).toBe(1)
  })
})

describe('las estrellas', () => {
  it('la primera es más de la mitad, la tercera es no perder ninguno', () => {
    expect(levelStars(2, 5)).toBe(0)
    expect(levelStars(3, 5)).toBe(1)
    expect(levelStars(4, 5)).toBe(2)
    expect(levelStars(5, 5)).toBe(3)
    expect(levelStars(8, 13)).toBe(1)
    expect(levelStars(11, 13)).toBe(2)
  })

  it('superar es una estrella por lo menos', () => {
    expect(levelPassed(0)).toBe(false)
    expect(levelPassed(1)).toBe(true)
  })
})

describe('el desbloqueo', () => {
  it('superar el nivel más alto abre el siguiente, sin pasar del último', () => {
    expect(nextUnlocked(3, 3, 1)).toBe(4)
    expect(nextUnlocked(LEVEL_COUNT, LEVEL_COUNT, 3)).toBe(LEVEL_COUNT)
  })

  it('repetir uno de abajo o no superar deja las cosas como estaban', () => {
    expect(nextUnlocked(5, 2, 3)).toBe(5)
    expect(nextUnlocked(3, 3, 0)).toBe(3)
  })
})
