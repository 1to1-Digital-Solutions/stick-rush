import { describe, expect, it } from 'vitest'
import {
  CHALLENGE_LIVES,
  GAME_MODE_LABELS,
  GAME_MODE_ORDER,
  remainingLives,
  runOutcome,
  startingLives,
} from './gameMode'

/**
 * Las reglas de los dos modos. Lo que se comprueba aquí es cuándo se acaba una
 * partida y con cuántas vidas, que es lo único que distingue el desafío de la
 * práctica: si esto se descuadra, el desafío se convierte en una partida normal
 * (o al revés, la práctica se cierra al tercer fallo).
 */

describe('vidas de cada modo', () => {
  it('en práctica no se juega con vidas', () => {
    // `null` y no cero: cero es haber perdido, y la práctica no se pierde.
    expect(startingLives('practice')).toBeNull()
    expect(remainingLives('practice', 0)).toBeNull()
    expect(remainingLives('practice', 99)).toBeNull()
  })

  it('el desafío arranca con tres vidas', () => {
    expect(startingLives('challenge')).toBe(CHALLENGE_LIVES)
    expect(CHALLENGE_LIVES).toBe(3)
  })

  it('cada palo que se escapa cuesta una vida', () => {
    expect(remainingLives('challenge', 0)).toBe(3)
    expect(remainingLives('challenge', 1)).toBe(2)
    expect(remainingLives('challenge', 2)).toBe(1)
    expect(remainingLives('challenge', 3)).toBe(0)
  })

  it('no se baja de cero por muchos fallos que lleguen', () => {
    // Dos palos pueden tocar el suelo en el mismo lote justo al agotarse la
    // última vida; un contador en negativo se pintaría como vidas de menos.
    expect(remainingLives('challenge', 5)).toBe(0)
  })
})

describe('cuándo se acaba la partida', () => {
  it('en práctica, cuando se resuelve el último palo', () => {
    expect(
      runOutcome({ mode: 'practice', resolved: 4, misses: 4, stickCount: 5 }),
    ).toBeNull()
    expect(
      runOutcome({ mode: 'practice', resolved: 5, misses: 5, stickCount: 5 }),
    ).toBe('cleared')
  })

  it('en práctica, fallarlos todos no la corta antes de tiempo', () => {
    // Es lo que separa los dos modos: aquí fallar no cuesta nada.
    expect(
      runOutcome({ mode: 'practice', resolved: 3, misses: 3, stickCount: 13 }),
    ).toBeNull()
  })

  it('en desafío, al quedarse sin vidas aunque queden palos', () => {
    expect(
      runOutcome({ mode: 'challenge', resolved: 2, misses: 2, stickCount: 13 }),
    ).toBeNull()
    expect(
      runOutcome({ mode: 'challenge', resolved: 3, misses: 3, stickCount: 13 }),
    ).toBe('failed')
  })

  it('en desafío, resolverlos todos con vidas es superar el reto', () => {
    expect(
      runOutcome({ mode: 'challenge', resolved: 5, misses: 2, stickCount: 5 }),
    ).toBe('cleared')
  })

  it('quedarse sin vidas con el último palo es perder, no completar', () => {
    // El palo que agota la última vida puede ser también el último de la
    // partida. Contarlo como reto superado regalaría un desafío perdido.
    expect(
      runOutcome({ mode: 'challenge', resolved: 5, misses: 3, stickCount: 5 }),
    ).toBe('failed')
  })

  it('atrapar palos no gasta vidas', () => {
    expect(
      runOutcome({ mode: 'challenge', resolved: 12, misses: 0, stickCount: 13 }),
    ).toBeNull()
  })
})

describe('presentación de los modos', () => {
  it('se ofrecen los dos, de la práctica al desafío', () => {
    expect(GAME_MODE_ORDER).toEqual(['practice', 'challenge'])
  })

  it('cada modo tiene etiqueta en el idioma del producto', () => {
    for (const mode of GAME_MODE_ORDER) {
      expect(GAME_MODE_LABELS[mode]).toBeTruthy()
    }
  })
})
