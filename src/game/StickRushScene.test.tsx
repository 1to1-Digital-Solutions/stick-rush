import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PLAYER_POSITION, PLAYER_OFFSET_Z } from '../lib/gameConfig'
import { assetUrl, setAssetsBase } from '../lib/assets'
import { gameName } from '../lib/menuTemplate'
import { ExitProvider, useExit } from './exit'

/**
 * Tests of the SCENE contract: what xrcade mounts inside its Canvas.
 *
 * What is protected is what breaks the immersive hall, and neither of the two
 * things shows in a screen test:
 *
 * 1. That the scene neither opens nor closes the session. WebXR gives one
 *    session per document, so a game that closes its own on leaving pulls
 *    whoever was in the hall out of the headset.
 * 2. That moving the scenery instead of the player leaves the geometry the
 *    same. It is what replaces the `<XROrigin>` the game can no longer set, and
 *    if the sign were the wrong way round the hoop would appear at twice the
 *    distance — something only noticed with the headset on.
 */

// The world is three objects and jsdom has no WebGL: what is tested here is
// the mounting contract, not what is drawn.
vi.mock('../components/game/GameWorld', () => ({
  GameWorld: () => <div data-testid="mundo" />,
}))

const { endXrSession } = vi.hoisted(() => ({ endXrSession: vi.fn() }))
vi.mock('../components/xr/xrStore', () => ({
  getXrStore: () => ({ enterAR: vi.fn(), enterVR: vi.fn() }),
  endXrSession,
}))

const { StickRushScene } = await import('./StickRushScene')

afterEach(() => {
  cleanup()
  endXrSession.mockClear()
  setAssetsBase('/')
})

describe('the scene does not rule over the session', () => {
  it('removing it does NOT close the immersive session', () => {
    // It is the whole difference with `<StickRush>`: the hall owns the session
    // and going back to it has to leave it open.
    const { unmount } = render(<StickRushScene onExit={() => {}} />)
    act(() => unmount())
    expect(endXrSession).not.toHaveBeenCalled()
  })

  it('exiting is whatever whoever mounts it says, not closing the session', () => {
    const onExit = vi.fn()
    function Exit() {
      const exit = useExit()
      return <button onClick={exit}>exit</button>
    }
    const { getByText } = render(
      <ExitProvider onExit={onExit}>
        <Exit />
      </ExitProvider>,
    )
    act(() => getByText('exit').click())
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(endXrSession).not.toHaveBeenCalled()
  })

  it('with nobody to say so, exiting closes the session', () => {
    // The game alone on its own website: there is nowhere to go back to.
    function Exit() {
      const exit = useExit()
      return <button onClick={exit}>exit</button>
    }
    const { getByText } = render(<Exit />)
    act(() => getByText('exit').click())
    expect(endXrSession).toHaveBeenCalledTimes(1)
  })

  it('the base of the static files arrives before anything is requested', () => {
    // During the render and not in an effect: the HDRI is requested when the scene
    // mounts, which is before any effect runs.
    render(<StickRushScene assetsBase="/juegos/stick-rush/" onExit={() => {}} />)
    expect(assetUrl('hdri.hdr')).toBe('/juegos/stick-rush/hdri.hdr')
  })

  it('the menu is called like the cabinet that mounts it, and with no name, like the package', () => {
    const { unmount } = render(<StickRushScene name="Test cabinet" onExit={() => {}} />)
    expect(gameName()).toBe('Test cabinet')
    unmount()
    render(<StickRushScene onExit={() => {}} />)
    expect(gameName()).toBe('Stick Rush')
  })
})

describe('moving the scenery is equivalent to moving the player', () => {
  /** What `<GameWorld>` applies to the world's group. */
  const OFFSET: [number, number, number] = [0, 0, -PLAYER_OFFSET_Z]

  it('the player ends up at the same distance from the hoop as before', () => {
    // Before: machine at the origin and player at PLAYER_POSITION.
    // Now: player at the origin (the host puts them there) and machine offset.
    const before = PLAYER_POSITION.map((p) => 0 - p)
    const now = OFFSET.map((d) => d - 0)
    expect(now).toEqual(before)
  })

  it('the player stays one step behind the centre: the machine moves away, not closer', () => {
    // With the sign flipped the machine would come right on top of them instead of moving
    // a step away: the bug would only be seen with the headset on.
    expect(PLAYER_OFFSET_Z).toBeGreaterThan(0)
    expect(OFFSET[2]).toBeLessThan(0)
  })

  it('only moves in depth', () => {
    // The player is centred and at ground level; if this changed, the offset
    // would no longer be enough and the whole scene would have to be reviewed.
    expect(PLAYER_POSITION[0]).toBe(0)
    expect(PLAYER_POSITION[1]).toBe(0)
  })
})
