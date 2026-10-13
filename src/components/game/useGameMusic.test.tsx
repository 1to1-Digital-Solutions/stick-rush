import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GameContext,
  type GameStore,
  useGameStoreValue,
} from '../../lib/gameStore'
import { MUSIC_VOLUME } from '../../lib/music'
import { MUSIC_FADE_MS } from '../../lib/musicFade'
import { useGameMusic } from './useGameMusic'
import { DEFAULT_VOLUMES, volumeFactor } from '../../lib/settings'
import { setVolume } from '../../lib/settingsClient'

/**
 * What is checked here are the rules the hook adds on top of the audio
 * file: that entering with the music off downloads nothing, that the game's
 * silence rules over it, and that unmounting the world silences it —which is what happens
 * on every visit inside the xrcade hall—.
 *
 * `Audio` is a fake because jsdom plays nothing: what is looked at is
 * how many are created and what they are asked for.
 */
const created: FakeAudio[] = []

class FakeAudio {
  loop = false
  volume = 1
  readonly play = vi.fn(() => Promise.resolve())
  readonly pause = vi.fn()

  constructor(readonly src: string) {
    created.push(this)
  }
}

beforeEach(() => {
  created.length = 0
  window.localStorage.clear()
  vi.stubGlobal('Audio', FakeAudio)
})

afterEach(() => {
  // Without `globals` in the Vitest config, Testing Library does not clean up by itself: a
  // mount that outlives the test wakes up with the preference the next one
  // sets and starts playing on its turn.
  cleanup()
  vi.unstubAllGlobals()
})

/** Mounts the world with music and returns its state to drive it from outside. */
function renderGame() {
  const store = { current: null as GameStore | null }

  function Music() {
    useGameMusic()
    return null
  }

  function Harness() {
    const value = useGameStoreValue()
    store.current = value
    return (
      <GameContext.Provider value={value}>
        <Music />
      </GameContext.Provider>
    )
  }

  const view = render(<Harness />)
  return Object.assign(store as { current: GameStore }, {
    unmount: view.unmount,
  })
}


/**
 * Waits for the fade to end.
 *
 * The music no longer comes in or goes out all at once (`lib/musicFade.ts`), so the final volume
 * and the `pause()` arrive when the ramp ends and not on the same line. It is really waited for and
 * not with fake clocks because the ramp goes by frames: faking the clock without faking
 * `requestAnimationFrame` would leave it stopped, and faking both is more machinery than the
 * seven hundred milliseconds it costs to wait for it.
 */
async function afterTheFade() {
  await act(async () => {
    await new Promise((done) => setTimeout(done, MUSIC_FADE_MS + 120))
  })
}

describe('useGameMusic', () => {
  it('you come in with music, playing in a loop and below the run', async () => {
    renderGame()
    await afterTheFade()

    expect(created).toHaveLength(1)
    expect(created[0].loop).toBe(true)
    expect(created[0].volume).toBeCloseTo(MUSIC_VOLUME * volumeFactor(DEFAULT_VOLUMES.ambience))
    expect(created[0].play).toHaveBeenCalled()
  })

  it('turning it off stops it, and turning it on again does not create another player', async () => {
    renderGame()

    act(() => setVolume('ambience', 0))
    await afterTheFade()
    expect(created[0].pause).toHaveBeenCalled()

    act(() => setVolume('ambience', DEFAULT_VOLUMES.ambience))
    expect(created).toHaveLength(1)
    expect(created[0].play).toHaveBeenCalledTimes(2)
  })

  it('removing the effects does not silence it: they are two separate channels', () => {
    // Before, silence ruled over everything. Now the hall's settings
    // separate «sonidos interactivos» from «sonidos ambientales» on purpose: there are
    // those who want to hear the fairground and not the sticks, and those who prefer the opposite.
    renderGame()

    act(() => setVolume('sfx', 0))

    expect(created[0].pause).not.toHaveBeenCalled()
  })

  it('removing the world takes the music with it', async () => {
    // It is what happens on leaving a cabinet of the hall: otherwise, it would keep playing
    // over the next game. Turning it down, not cutting it: the hall brings its own back behind.
    const game = renderGame()

    game.unmount()
    await afterTheFade()

    expect(created[0].pause).toHaveBeenCalled()
  })

  it('if the browser does not let it play, it waits for the first gesture', () => {
    // No browser plays anything before whoever plays touches something. That
    // the attempt fails is not an error: it is the normal case on entering.
    renderGame()
    created[0].play.mockClear()

    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
    })

    expect(created[0].play).toHaveBeenCalled()
  })
})
