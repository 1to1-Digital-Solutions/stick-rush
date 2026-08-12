import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getBestPoints,
  getServerBestPoints,
  HIGH_SCORE_KEYS,
  parseBestPoints,
  readBestPoints,
  saveBestPoints,
  subscribeBestPoints,
  writeBestPoints,
} from './highScore'

/** Almacenamiento de mentira, con lo justo que usa el récord. */
function fakeStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(HIGH_SCORE_KEYS.practice, initial)
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
    expect(readBestPoints(fakeStorage('2500'), 'practice')).toBe(2500)
  })

  it('la práctica conserva la clave de antes de que hubiera modos', () => {
    // Es la promesa de que nadie pierde su récord al actualizar: cambiarla
    // dejaría la marca anterior huérfana en el navegador, y el juego arrancaría
    // como si nunca se hubiera jugado.
    expect(HIGH_SCORE_KEYS.practice).toBe('stick-rush:best-points')
    expect(HIGH_SCORE_KEYS.challenge).not.toBe(HIGH_SCORE_KEYS.practice)
  })

  it('sin almacenamiento se juega sin récord previo', () => {
    expect(readBestPoints(null, 'practice')).toBe(0)
  })

  it('un almacenamiento bloqueado no rompe la partida', () => {
    // En modo privado `localStorage` existe pero lanza al tocarlo.
    expect(readBestPoints(blockedStorage(), 'practice')).toBe(0)
  })
})

describe('escritura del récord', () => {
  it('guarda la puntuación en su clave', () => {
    const storage = fakeStorage()
    writeBestPoints(storage, 'practice', 3200)
    expect(storage.getItem(HIGH_SCORE_KEYS.practice)).toBe('3200')
  })

  it('no escribe lo que la lectura descartaría', () => {
    const storage = fakeStorage()
    const setItem = vi.spyOn(storage, 'setItem')

    writeBestPoints(storage, 'practice', -1)
    writeBestPoints(storage, 'practice', 12.5)
    writeBestPoints(storage, 'practice', Number.NaN)
    writeBestPoints(storage, 'practice', Number.POSITIVE_INFINITY)

    expect(setItem).not.toHaveBeenCalled()
  })

  it('sin almacenamiento no hace nada y no lanza', () => {
    expect(() => writeBestPoints(null, 'practice', 100)).not.toThrow()
  })

  it('si el navegador se niega a guardar, el juego sigue', () => {
    // Cuota agotada o escritura prohibida: se pierde el récord, no la partida.
    expect(() =>
      writeBestPoints(blockedStorage(), 'practice', 100),
    ).not.toThrow()
  })
})

describe('el récord que ve el juego', () => {
  // Estas pruebas sí usan el `localStorage` de jsdom, porque es el almacén al
  // que se suscribe el juego.
  beforeEach(() => {
    localStorage.clear()
  })

  it('empieza a cero y sale de lo guardado', () => {
    expect(getBestPoints('practice')).toBe(0)

    localStorage.setItem(HIGH_SCORE_KEYS.practice, '4100')
    expect(getBestPoints('practice')).toBe(4100)
  })

  it('en el servidor no hay récord que pintar', () => {
    // Es lo que mantiene igual el HTML del servidor y el del navegador.
    expect(getServerBestPoints()).toBe(0)
  })

  it('guarda la puntuación cuando mejora la anterior', () => {
    saveBestPoints('practice', 1500)
    expect(getBestPoints('practice')).toBe(1500)
    expect(localStorage.getItem(HIGH_SCORE_KEYS.practice)).toBe('1500')
  })

  it('una puntuación peor o igual no toca el récord', () => {
    saveBestPoints('practice', 1500)

    saveBestPoints('practice', 900)
    saveBestPoints('practice', 1500)

    expect(getBestPoints('practice')).toBe(1500)
  })

  it('avisa solo a quien sigue suscrito, y solo si hay récord nuevo', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeBestPoints(listener)

    saveBestPoints('practice', 2000)
    expect(listener).toHaveBeenCalledTimes(1)

    // Una partida peor no cambia nada que repintar.
    saveBestPoints('practice', 10)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    saveBestPoints('practice', 9000)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('cada modo tiene su récord y no se pisan', () => {
    // Un desafío se corta al quedarse sin vidas, así que nunca puede puntuar
    // más que la práctica equivalente: con una marca compartida, el modo con
    // algo en juego sería el único que jamás la batiría.
    saveBestPoints('practice', 5000)
    saveBestPoints('challenge', 1200)

    expect(getBestPoints('practice')).toBe(5000)
    expect(getBestPoints('challenge')).toBe(1200)

    // Y un desafío peor que el récord de práctica sí bate el suyo.
    saveBestPoints('challenge', 1800)
    expect(getBestPoints('challenge')).toBe(1800)
    expect(getBestPoints('practice')).toBe(5000)
  })

  it('se entera de que el récord lo ha cambiado otra pestaña', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeBestPoints(listener)

    localStorage.setItem(HIGH_SCORE_KEYS.practice, '7000')
    window.dispatchEvent(
      new StorageEvent('storage', { key: HIGH_SCORE_KEYS.practice }),
    )

    expect(listener).toHaveBeenCalledTimes(1)
    expect(getBestPoints('practice')).toBe(7000)

    unsubscribe()
    window.dispatchEvent(
      new StorageEvent('storage', { key: HIGH_SCORE_KEYS.practice }),
    )
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
