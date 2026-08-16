import { describe, expect, it } from 'vitest'
import {
  SCENERY_KEY,
  getServerScenery,
  parseScenery,
  readScenery,
  writeScenery,
} from './sceneryPreference'

/**
 * Tests de recordar el escenario entre visitas (`sceneryPreference.ts`).
 *
 * Lo que se protege: que un almacenamiento raro nunca acabe en 'passthrough'. Ese valor, en
 * una sesión sin habitación real detrás, deja al jugador mirando la nada — por eso se
 * dejó fuera cuando se persistió el silencio.
 */

/** Almacenamiento de mentira, con lo justo que usa la preferencia. */
function fakeStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(SCENERY_KEY, initial)
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

describe('el escenario se recuerda entre visitas', () => {
  it('la primera visita entra con escenario', () => {
    expect(readScenery(fakeStorage())).toBe('scene')
    expect(readScenery(null)).toBe('scene')
  })

  it('quien lo quitó vuelve a su cuarto', () => {
    expect(readScenery(fakeStorage('passthrough'))).toBe('passthrough')
  })

  it('solo se guarda el passthrough; volver al escenario borra la clave', () => {
    // El arranque por defecto es con escenario, así que el almacenamiento solo tiene algo
    // cuando el jugador se aparta de él.
    const storage = fakeStorage()
    writeScenery(storage, 'passthrough')
    expect(storage.length).toBe(1)
    writeScenery(storage, 'scene')
    expect(storage.length).toBe(0)
  })

  it('lo editado a mano no vale como passthrough', () => {
    // Es entrada externa: cualquiera puede tocarla desde las herramientas del navegador, y
    // el valor peligroso es justo el que quita el escenario.
    for (const raw of ['PASSTHROUGH', 'true', '1', 'scene', '', 'null'])
      expect(parseScenery(raw)).toBe('scene')
    expect(parseScenery(null)).toBe('scene')
  })

  it('con el almacenamiento bloqueado se entra con escenario, sin romperse', () => {
    expect(readScenery(blockedStorage())).toBe('scene')
    expect(writeScenery(blockedStorage(), 'passthrough')).toBe(false)
  })

  it('el servidor prerenderiza siempre con escenario', () => {
    // No hay navegador que consultar; si dijera otra cosa, el HTML del servidor y el del
    // cliente diferirían.
    expect(getServerScenery()).toBe('scene')
  })
})
