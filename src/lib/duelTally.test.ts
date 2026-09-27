import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DUEL_TALLY_KEY,
  getDuelTally,
  parseDuelTally,
  saveDuelResult,
} from './duelTally'

/**
 * El marcador de la pareja que está jugando.
 *
 * Jugar contra alguien es el momento más memorable de una sesión y no dejaba nada: se cerraba
 * la última tanda, salía quién había ganado y se borraba. El récord no lo toca —una tanda a dos
 * no es la marca de nadie— pero de ahí no se sigue que la partida no cuente: lo que cuenta entre
 * dos es quién gana.
 *
 * Lo que se prueba es lo mismo que en los récords: que sumar sume donde toca, y que lo leído
 * se trate como entrada externa (se edita a mano desde el navegador en dos clics).
 */

/** El almacenamiento de un navegador en modo privado: lanza en vez de fallar. */
function blockedStorage(): Storage {
  return {
    getItem: () => {
      throw new DOMException('bloqueado', 'SecurityError')
    },
    setItem: () => {
      throw new DOMException('cuota agotada', 'QuotaExceededError')
    },
  } as unknown as Storage
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('lo que llevan los dos', () => {
  it('empieza a cero y no es el récord: tiene su propia clave', () => {
    expect(DUEL_TALLY_KEY).toBe('stick-rush:duel-tally')
    expect(getDuelTally()).toEqual({ wins: [0, 0], ties: 0 })
  })

  it('cada victoria suma a quien la gana, y el empate va aparte', () => {
    saveDuelResult(0)
    expect(getDuelTally()).toEqual({ wins: [1, 0], ties: 0 })

    saveDuelResult(1)
    expect(getDuelTally()).toEqual({ wins: [1, 1], ties: 0 })

    saveDuelResult(0)
    expect(getDuelTally()).toEqual({ wins: [2, 1], ties: 0 })

    saveDuelResult(null)
    expect(getDuelTally()).toEqual({ wins: [2, 1], ties: 1 })
  })

  it('lo guardado se lee en la visita siguiente', () => {
    saveDuelResult(1)

    expect(getDuelTally()).toEqual({ wins: [0, 1], ties: 0 })
  })
})

describe('lo que se lee del almacenamiento', () => {
  it('basura no rompe la partida: se empieza de cero', () => {
    // Lo escribió otra versión, o alguien a mano desde las herramientas del navegador.
    for (const raw of ['no soy json', '{"wins":"dos"}', '[]', 'null']) {
      expect(parseDuelTally(raw)).toEqual({ wins: [0, 0], ties: 0 })
    }
  })

  it('un contador imposible cuenta como cero, no como un número raro', () => {
    expect(parseDuelTally('{"wins":[-3,2.7],"ties":"muchas"}')).toEqual({
      wins: [0, 2],
      ties: 0,
    })
  })

  it('sin nada guardado, cero', () => {
    expect(parseDuelTally(null)).toEqual({ wins: [0, 0], ties: 0 })
  })
})

describe('sin sitio donde guardar', () => {
  it('se lee cero y la partida sigue', () => {
    vi.stubGlobal('localStorage', blockedStorage())

    expect(getDuelTally()).toEqual({ wins: [0, 0], ties: 0 })
  })

  it('y en el servidor, donde no hay navegador, tampoco rompe', () => {
    // El salón prerenderiza la cabina: allí no hay `window` del que sacar nada.
    vi.stubGlobal('window', undefined)

    expect(getDuelTally()).toEqual({ wins: [0, 0], ties: 0 })
    expect(() => saveDuelResult(1)).not.toThrow()
  })

  it('y guardar lo que acaba de pasar no rompe la partida', () => {
    // Ventana privada o cuota agotada: la serie dura lo que dure la visita, y ya está. Lo
    // que no puede es tirar el juego al cerrar la última tanda.
    vi.stubGlobal('localStorage', blockedStorage())

    expect(() => saveDuelResult(0)).not.toThrow()
  })
})
