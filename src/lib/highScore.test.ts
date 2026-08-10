import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getBestPoints,
  getServerBestPoints,
  HIGH_SCORE_KEY,
  parseBestPoints,
  readBestPoints,
  saveBestPoints,
  subscribeBestPoints,
  writeBestPoints,
} from './highScore'

/** Almacenamiento de mentira, con lo justo que usa el récord. */
function fakeStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(HIGH_SCORE_KEY, initial)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  } as unknown as Storage
}

/** El que tienen los navegadores en modo privado: lanza en vez de fallar. */
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

describe('lectura de lo guardado', () => {
  it('acepta un entero no negativo', () => {
    expect(parseBestPoints('0')).toBe(0)
    expect(parseBestPoints('1234')).toBe(1234)
  })

  it('descarta lo que no es una puntuación', () => {
    // Cualquiera puede editar el almacenamiento desde el navegador: lo que no
    // se entienda cuenta como "todavía no hay récord", nunca como NaN suelto.
    expect(parseBestPoints(null)).toBe(0)
    expect(parseBestPoints('')).toBe(0)
    expect(parseBestPoints('   ')).toBe(0)
    expect(parseBestPoints('un millón')).toBe(0)
    expect(parseBestPoints('-500')).toBe(0)
    expect(parseBestPoints('12.5')).toBe(0)
    expect(parseBestPoints('Infinity')).toBe(0)
    expect(parseBestPoints('1e999')).toBe(0)
    expect(parseBestPoints('9007199254740993')).toBe(0)
  })

  it('lee el récord de su clave', () => {
    expect(readBestPoints(fakeStorage('2500'))).toBe(2500)
  })

  it('sin almacenamiento se juega sin récord previo', () => {
    expect(readBestPoints(null)).toBe(0)
  })

  it('un almacenamiento bloqueado no rompe la partida', () => {
    // En modo privado `localStorage` existe pero lanza al tocarlo.
    expect(readBestPoints(blockedStorage())).toBe(0)
  })
})

describe('escritura del récord', () => {
  it('guarda la puntuación en su clave', () => {
    const storage = fakeStorage()
    writeBestPoints(storage, 3200)
    expect(storage.getItem(HIGH_SCORE_KEY)).toBe('3200')
  })

  it('no escribe lo que la lectura descartaría', () => {
    const storage = fakeStorage()
    const setItem = vi.spyOn(storage, 'setItem')

    writeBestPoints(storage, -1)
    writeBestPoints(storage, 12.5)
    writeBestPoints(storage, Number.NaN)
    writeBestPoints(storage, Number.POSITIVE_INFINITY)

    expect(setItem).not.toHaveBeenCalled()
  })

  it('sin almacenamiento no hace nada y no lanza', () => {
    expect(() => writeBestPoints(null, 100)).not.toThrow()
  })

  it('si el navegador se niega a guardar, el juego sigue', () => {
    // Cuota agotada o escritura prohibida: se pierde el récord, no la partida.
    expect(() => writeBestPoints(blockedStorage(), 100)).not.toThrow()
  })
})

describe('el récord que ve el juego', () => {
  // Estas pruebas sí usan el `localStorage` de jsdom, porque es el almacén al
  // que se suscribe el juego.
  beforeEach(() => {
    localStorage.clear()
  })

  it('empieza a cero y sale de lo guardado', () => {
    expect(getBestPoints()).toBe(0)

    localStorage.setItem(HIGH_SCORE_KEY, '4100')
    expect(getBestPoints()).toBe(4100)
  })

  it('en el servidor no hay récord que pintar', () => {
    // Es lo que mantiene igual el HTML del servidor y el del navegador.
    expect(getServerBestPoints()).toBe(0)
  })

  it('guarda la puntuación cuando mejora la anterior', () => {
    saveBestPoints(1500)
    expect(getBestPoints()).toBe(1500)
    expect(localStorage.getItem(HIGH_SCORE_KEY)).toBe('1500')
  })

  it('una puntuación peor o igual no toca el récord', () => {
    saveBestPoints(1500)

    saveBestPoints(900)
    saveBestPoints(1500)

    expect(getBestPoints()).toBe(1500)
  })

  it('avisa solo a quien sigue suscrito, y solo si hay récord nuevo', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeBestPoints(listener)

    saveBestPoints(2000)
    expect(listener).toHaveBeenCalledTimes(1)

    // Una partida peor no cambia nada que repintar.
    saveBestPoints(10)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    saveBestPoints(9000)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
