import { beforeEach, describe, expect, it, vi } from 'vitest'

// The real store opens WebXR, which does not exist outside the headset, and the controller it
// mounts drags half an R3F scene along. What is tested here is its wiring:
// where it looks for the controller profiles and what happens to the session when the
// game is unmounted. That the controller is painted is up to the session in `e2e/xr.spec.ts`.
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
 * Loads the module from scratch, optionally with another base for static files.
 *
 * Both the store and the base are module state —one session and one base per
 * document—, so without this the first of these tests would leave its own to
 * the later ones. The base is set between the reset and the import on purpose:
 * that way it arrives before anybody asks for the store, which is the order the
 * game follows when it mounts.
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

describe('WebXR store', () => {
  it('creates it only once, shared between the DOM and the Canvas', async () => {
    const { getXrStore } = await loadXrStore()

    expect(getXrStore()).toBe(getXrStore())
    expect(createXRStore).toHaveBeenCalledTimes(1)
  })

  it('serves the controller profiles from the root while nobody says otherwise', async () => {
    const { getXrStore } = await loadXrStore()

    expect(getXrStore()).toMatchObject({
      options: { baseAssetPath: 'http://localhost:3000/webxr-profiles/' },
    })
  })

  it('looks for them wherever whoever mounts the game has put them', async () => {
    const { getXrStore } = await loadXrStore('/juegos/stick-rush/')

    expect(getXrStore()).toMatchObject({
      options: {
        baseAssetPath: 'http://localhost:3000/juegos/stick-rush/webxr-profiles/',
      },
    })
  })
})

describe('closing the immersive session', () => {
  it('closes the live one: the headset goes back to whoever mounted the game', async () => {
    const end = vi.fn(() => Promise.resolve())
    const { getXrStore, endXrSession } = await loadXrStore()
    getXrStore()
    state.session = { end }

    endXrSession()

    expect(end).toHaveBeenCalledTimes(1)
  })

  it('does nothing if nobody got to ask for the store', async () => {
    const { endXrSession } = await loadXrStore()

    expect(() => endXrSession()).not.toThrow()
    expect(createXRStore).not.toHaveBeenCalled()
  })

  it('does nothing if the headset was never entered', async () => {
    const { getXrStore, endXrSession } = await loadXrStore()
    getXrStore()

    expect(() => endXrSession()).not.toThrow()
  })

  it('swallows the failure of a session that was already closing', async () => {
    const end = vi.fn(() => Promise.reject(new Error('InvalidStateError')))
    const { getXrStore, endXrSession } = await loadXrStore()
    getXrStore()
    state.session = { end }

    expect(() => endXrSession()).not.toThrow()
    // A rejected promise without a `catch` would bring down the process, not this `expect`:
    // the microtask queue is given a turn so it blows up if it escaped.
    await Promise.resolve()
  })
})
