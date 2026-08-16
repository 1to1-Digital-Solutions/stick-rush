import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MUTED_KEY,
  getMuted,
  getServerMuted,
  parseMuted,
  readMuted,
  saveMuted,
  subscribeMuted,
  writeMuted,
} from './mutePreference'

/** Almacenamiento de mentira, con lo justo que usa la preferencia. */
function fakeStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(MUTED_KEY, initial)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    get length() {
      return values.size
    },
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
    removeItem: () => {
      throw new DOMException('bloqueado', 'SecurityError')
    },
  } as unknown as Storage
}

beforeEach(() => {
  // El almacenamiento de jsdom se comparte entre tests, y la preferencia
  // sobrevive a propósito: se deja el juego con sonido, que es como arranca.
  vi.restoreAllMocks()
  localStorage.clear()
  saveMuted(false)
})

describe('lectura de la preferencia', () => {
  it('el juego arranca en silencio si así se dejó', () => {
    expect(readMuted(fakeStorage('1'))).toBe(true)
  })

  it('sin nada guardado arranca con sonido', () => {
    // Es el estado de siempre: el silencio es lo que se aparta del defecto y
    // por eso es lo único que se escribe.
    expect(parseMuted(null)).toBe(false)
    expect(readMuted(fakeStorage())).toBe(false)
  })

  it('lo que no se entiende cuenta como con sonido', () => {
    // Cualquiera puede editar el almacenamiento desde las herramientas del
    // navegador: el lado seguro es sonar, que es lo que hacía el juego antes de
    // guardar nada.
    expect(parseMuted('')).toBe(false)
    expect(parseMuted('0')).toBe(false)
    expect(parseMuted('true')).toBe(false)
    expect(parseMuted('sí')).toBe(false)
  })

  it('sin almacenamiento, o con él bloqueado, se juega con sonido', () => {
    expect(readMuted(null)).toBe(false)
    expect(readMuted(blockedStorage())).toBe(false)
  })

  it('el servidor no ve la preferencia', () => {
    // Lo que se prerenderiza tiene que coincidir con lo primero que pinta el
    // navegador, o React avisa de un error de hidratación: el botón de
    // silenciar está en la pantalla de inicio, que sí se prerenderiza.
    expect(getServerMuted()).toBe(false)
  })
})

describe('escritura de la preferencia', () => {
  it('guarda el silencio y lo vuelve a leer', () => {
    const storage = fakeStorage()

    writeMuted(storage, true)

    expect(readMuted(storage)).toBe(true)
  })

  it('volver al sonido borra la clave en vez de guardar un cero', () => {
    // El arranque por defecto es con sonido, así que el navegador solo guarda
    // algo mientras el jugador se aparte de él.
    const storage = fakeStorage('1')

    writeMuted(storage, false)

    expect(storage.getItem(MUTED_KEY)).toBeNull()
    expect(storage.length).toBe(0)
  })

  it('un almacenamiento bloqueado no rompe el botón, y lo dice', () => {
    // En modo privado la preferencia dura lo que dure la visita, que es lo que
    // hacía antes de guardarse: perderla no justifica ningún aviso. Pero el
    // juego necesita enterarse de que no quedó guardada.
    expect(() => writeMuted(blockedStorage(), true)).not.toThrow()
    expect(writeMuted(blockedStorage(), true)).toBe(false)
    expect(writeMuted(blockedStorage(), false)).toBe(false)
    expect(writeMuted(null, true)).toBe(false)
    expect(writeMuted(fakeStorage(), true)).toBe(true)
  })
})

describe('el almacén al que se suscribe el juego', () => {
  it('avisa a quien lo esté mirando al cambiar', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeMuted(listener)

    saveMuted(true)

    expect(listener).toHaveBeenCalled()
    expect(getMuted()).toBe(true)
    unsubscribe()
  })

  it('deja de avisar al darse de baja', () => {
    const listener = vi.fn()

    subscribeMuted(listener)()
    saveMuted(true)

    expect(listener).not.toHaveBeenCalled()
  })

  it('con el navegador sin guardar nada, el silencio funciona igual', () => {
    // Modo privado, o un visor con el almacenamiento vetado: si la preferencia
    // solo viviera en lo guardado, pulsar el botón no cambiaría nada y el juego
    // seguiría sonando. Se pierde al recargar, no durante la visita.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })

    saveMuted(true)

    expect(getMuted()).toBe(true)
    expect(localStorage.getItem(MUTED_KEY)).toBeNull()
  })

  it('escucha también a las otras pestañas', () => {
    // Silenciar en una pestaña y que la otra siguiera sonando sería lo
    // contrario de lo que se acaba de pedir.
    const listener = vi.fn()
    const unsubscribe = subscribeMuted(listener)

    window.dispatchEvent(new StorageEvent('storage', { key: MUTED_KEY }))

    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })
})
