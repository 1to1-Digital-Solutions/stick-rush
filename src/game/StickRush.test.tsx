import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assetUrl, setAssetsBase } from '../lib/assets'
import { StickRush } from './StickRush'
import { mountStickRush, type StickRushHandle } from './mount'

// The 3D scene needs WebGL, which jsdom does not have. What is tested here is
// the mounting contract —that the game mounts outside its website, with no router
// or layout, and that the options arrive—, not what is painted inside the Canvas.
vi.mock('../components/game/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="escena" />,
}))

// The WebXR store is created outside the tree and survives the unmount, so
// what has to be checked here is the call. That the session really closes
// is tested by `components/xr/xrStore.test.ts`.
const { endXrSession } = vi.hoisted(() => ({ endXrSession: vi.fn() }))
vi.mock('../components/xr/xrStore', () => ({
  getXrStore: () => ({ enterAR: vi.fn(), enterVR: vi.fn() }),
  endXrSession,
}))

afterEach(() => {
  cleanup()
  // After `cleanup()`, which closes the session when it unmounts the game: that
  // way each test starts without the calls of the previous one.
  endXrSession.mockClear()
  // The base of the static files is module state: without putting it back at
  // the root, a test would change the paths for the next one.
  setAssetsBase('/')
})

describe('mounting the game from outside', () => {
  it('mounts with no router, no layout and no metadata', () => {
    render(<StickRush />)

    // `getByRole` throws if it is not there: the game that does not start outside
    // its website is left without a menu, or blows up on render.
    // What the cabinet is called: without a hall, the package's (in label capitals by style).
    expect(screen.getByRole('heading', { name: 'Stick Rush' }).tagName).toBe('H1')
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined()
  })

  it('leaves the static files at the root as long as nobody says otherwise', () => {
    render(<StickRush />)

    expect(assetUrl('hdri/plaza_pueblo_1k.exr')).toBe('/hdri/plaza_pueblo_1k.exr')
  })

  it('looks for the static files where whoever mounts it says', () => {
    render(<StickRush assetsBase="/juegos/stick-rush/" />)

    expect(assetUrl('hdri/plaza_pueblo_1k.exr')).toBe(
      '/juegos/stick-rush/hdri/plaza_pueblo_1k.exr',
    )
  })

  it('fills the container it is given, without taking over the window on its own', () => {
    const { container } = render(<StickRush />)
    const root = container.firstElementChild

    expect(root?.className).toContain('stick-rush')
    expect(root?.className).toContain('h-full')
    expect(root?.className).not.toContain('h-dvh')
  })

  it('on removal gives the headset back to whoever was mounting it', () => {
    const { unmount } = render(<StickRush />)
    expect(endXrSession).not.toHaveBeenCalled()

    unmount()

    // Without this, the hub that unmounts the game with the headset on leaves
    // alive a session tied to a Canvas that no longer exists: a frozen scene and
    // no way back, because WebXR only gives one session per document.
    expect(endXrSession).toHaveBeenCalledTimes(1)
  })
})

describe('mounting the game on a DOM element', () => {
  it('paints it inside and removes it on unmount', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)

    let game: StickRushHandle | null = null
    act(() => {
      game = mountStickRush(element, { assetsBase: '/juegos/stick-rush/' })
    })

    expect(element.textContent).toContain('Stick Rush')
    expect(assetUrl('textures/wood_nor_1k.jpg')).toBe(
      '/juegos/stick-rush/textures/wood_nor_1k.jpg',
    )

    act(() => game?.unmount())

    expect(element.childNodes.length).toBe(0)
    element.remove()
  })
})
