import { beforeEach, describe, expect, it, vi } from 'vitest'

// El store de verdad abre WebXR, que no existe fuera del visor, y el mando que
// monta arrastra media escena de R3F. Lo que se prueba aquí es su cableado:
// dónde busca los perfiles de mando y qué pasa con la sesión al desmontar el
// juego. Que el mando se pinte es cosa de la sesión en `e2e/xr.spec.ts`.
vi.mock('./XRController', () => ({ StickRushController: () => null }))

const { createXRStore, state } = vi.hoisted(() => {
  const state = { session: null as { end: () => Promise<void> } | null }
  return {
    state,
    createXRStore: vi.fn((options: { baseAssetPath: string }) => ({
      options,
      getState: () => state,
    })),
  }
})
vi.mock('@react-three/xr', () => ({ createXRStore }))

/**
 * Carga el módulo de cero, opcionalmente con otra base de ficheros estáticos.
 *
 * Tanto el store como la base son estado de módulo —una sesión y una base por
 * documento—, así que sin esto el primero de estos tests le dejaría los suyos a
 * los de después. La base se pone entre el reinicio y el import a propósito:
 * así llega antes de que nadie pida el store, que es el orden que sigue el
 * juego al montarse.
 */
async function loadXrStore(assetsBase?: string) {
  vi.resetModules()
  if (assetsBase != null) {
    const { setAssetsBase } = await import('../../lib/assets')
    setAssetsBase(assetsBase)
  }
  return import('./xrStore')
}

beforeEach(() => {
  state.session = null
  createXRStore.mockClear()
})

describe('store de WebXR', () => {
  it('lo crea una sola vez, compartido entre el DOM y el Canvas', async () => {
    const { getXrStore } = await loadXrStore()

    expect(getXrStore()).toBe(getXrStore())
    expect(createXRStore).toHaveBeenCalledTimes(1)
  })

  it('sirve los perfiles de mando desde la raíz mientras nadie diga otra cosa', async () => {
    const { getXrStore } = await loadXrStore()

    expect(getXrStore()).toMatchObject({
      options: { baseAssetPath: 'http://localhost:3000/webxr-profiles/' },
    })
  })

  it('los busca donde los haya puesto quien monta el juego', async () => {
    const { getXrStore } = await loadXrStore('/juegos/stick-rush/')

    expect(getXrStore()).toMatchObject({
      options: {
        baseAssetPath: 'http://localhost:3000/juegos/stick-rush/webxr-profiles/',
      },
    })
  })
})

describe('cerrar la sesión inmersiva', () => {
  it('cierra la que esté viva: el visor vuelve a quien montó el juego', async () => {
    const end = vi.fn(() => Promise.resolve())
    const { getXrStore, endXrSession } = await loadXrStore()
    getXrStore()
    state.session = { end }

    endXrSession()

    expect(end).toHaveBeenCalledTimes(1)
  })

  it('no hace nada si nadie llegó a pedir el store', async () => {
    const { endXrSession } = await loadXrStore()

    expect(() => endXrSession()).not.toThrow()
    expect(createXRStore).not.toHaveBeenCalled()
  })

  it('no hace nada si no se llegó a entrar en el visor', async () => {
    const { getXrStore, endXrSession } = await loadXrStore()
    getXrStore()

    expect(() => endXrSession()).not.toThrow()
  })

  it('se traga el fallo de una sesión que ya se estaba cerrando', async () => {
    const end = vi.fn(() => Promise.reject(new Error('InvalidStateError')))
    const { getXrStore, endXrSession } = await loadXrStore()
    getXrStore()
    state.session = { end }

    expect(() => endXrSession()).not.toThrow()
    // Una promesa rechazada sin `catch` tumbaría el proceso, no este `expect`:
    // se le da un turno al microtask queue para que salte si se escapara.
    await Promise.resolve()
  })
})
