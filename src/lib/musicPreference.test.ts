import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MUSIC_KEY,
  getMusic,
  getServerMusic,
  readMusic,
  saveMusic,
  subscribeMusic,
  writeMusic,
} from './musicPreference'

/**
 * La preferencia de música.
 *
 * Es la del silencio dada la vuelta, y por eso se prueba aparte: aquí lo que se
 * guarda es el «sin música», porque se entra con ella. Un fallo de signo dejaría
 * el juego mudo a quien no ha pedido nada, que se lee como que está roto.
 */

/** Almacenamiento de mentira, con lo justo que usa la preferencia. */
function fakeStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(MUSIC_KEY, initial)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    get length() {
      return values.size
    },
  } as unknown as Storage
}

/** Uno que se niega a todo, como el modo privado de algunos navegadores. */
function brokenStorage(): Storage {
  return {
    getItem: () => {
      throw new Error('bloqueado')
    },
    setItem: () => {
      throw new Error('bloqueado')
    },
    removeItem: () => {
      throw new Error('bloqueado')
    },
  } as unknown as Storage
}

beforeEach(() => {
  localStorage.clear()
  saveMusic(true)
  localStorage.clear()
})

describe('leer la preferencia', () => {
  it('sin nada guardado se entra con música', () => {
    expect(readMusic(fakeStorage())).toBe(true)
  })

  it('solo el valor exacto la apaga', () => {
    expect(readMusic(fakeStorage('0'))).toBe(false)
    // Lo guardado es entrada externa: cualquiera puede editarlo desde las
    // herramientas del navegador, y un valor raro no puede callar el juego.
    for (const raro of ['1', '', 'no', 'false']) {
      expect(readMusic(fakeStorage(raro)), raro).toBe(true)
    }
  })

  it('sin navegador que preguntar, con música', () => {
    expect(readMusic(null)).toBe(true)
    expect(readMusic(brokenStorage())).toBe(true)
    expect(getServerMusic()).toBe(true)
  })
})

describe('guardar la preferencia', () => {
  it('apagarla escribe, y encenderla borra: lo normal no ocupa nada', () => {
    const storage = fakeStorage()
    expect(writeMusic(storage, false)).toBe(true)
    expect(storage.getItem(MUSIC_KEY)).toBe('0')

    expect(writeMusic(storage, true)).toBe(true)
    expect(storage.getItem(MUSIC_KEY)).toBeNull()
  })

  it('un almacenamiento que no deja guardar lo dice, y no revienta', () => {
    expect(writeMusic(null, false)).toBe(false)
    expect(writeMusic(brokenStorage(), false)).toBe(false)
  })
})

describe('el almacén al que se suscriben los menús', () => {
  it('cambiarla se ve al leerla', () => {
    saveMusic(false)
    expect(getMusic()).toBe(false)
    saveMusic(true)
    expect(getMusic()).toBe(true)
  })

  it('avisa a quien esté mirando, y deja de hacerlo al desuscribirse', () => {
    const listener = vi.fn()
    const stop = subscribeMusic(listener)

    saveMusic(false)
    expect(listener).toHaveBeenCalledTimes(1)

    stop()
    saveMusic(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('sin sitio donde guardarla, se recuerda mientras dure la visita', () => {
    // Sin la copia en memoria, aquí el botón no haría nada: lo guardado no
    // cambia, así que la lectura devolvería siempre lo mismo y la música
    // seguiría sonando por más que se pulsara.
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(brokenStorage())

    saveMusic(false)
    expect(getMusic()).toBe(false)

    saveMusic(true)
    expect(getMusic()).toBe(true)

    vi.restoreAllMocks()
  })

  it('también avisa cuando la toca otra pestaña', () => {
    const listener = vi.fn()
    const stop = subscribeMusic(listener)

    window.dispatchEvent(new Event('storage'))
    expect(listener).toHaveBeenCalled()

    stop()
  })
})
