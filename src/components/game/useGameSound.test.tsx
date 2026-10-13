import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COUNTDOWN_SECONDS,
  GameContext,
  type GameStore,
  type HallOptions,
  useGameStoreValue,
} from '../../lib/gameStore'
import { useGameSound } from './useGameSound'
import { DEFAULT_VOLUMES } from '../../lib/settings'
import { setVolume } from '../../lib/settingsClient'

// The real engine is tested in `sound.test.ts` against a fake
// context; what is checked here is the wiring: which sound the game asks for
// at each moment.
const { play, setEngineVolume } = vi.hoisted(() => ({
  play: vi.fn(),
  setEngineVolume: vi.fn(),
}))
vi.mock('@/lib/sound', () => ({
  createSoundEngine: (_context: unknown, volume?: number) => {
    setEngineVolume(volume)
    return { play, dispose: vi.fn(), setVolume: setEngineVolume }
  },
}))

/** The contexts created during the test, to watch that they are not left alive. */
const contexts: FakeAudioContext[] = []

class FakeAudioContext {
  state: AudioContextState = 'running'
  resume = vi.fn(() => Promise.resolve())
  close = vi.fn(() => Promise.resolve())

  constructor() {
    contexts.push(this)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', FakeAudioContext)
  // Silence is remembered between visits, and jsdom shares `localStorage`
  // between tests: without emptying it, the one that mutes would leave the next one mute.
  localStorage.clear()
  // The volumes come from the hall's settings, which cache what was read so
  // that `useSyncExternalStore` does not repaint endlessly: just emptying `localStorage`
  // would leave the cache with the value of the previous test. They are reset
  // through the API, which is what invalidates it.
  setVolume('sfx', DEFAULT_VOLUMES.sfx)
  setVolume('ambience', DEFAULT_VOLUMES.ambience)
  contexts.length = 0
  play.mockClear()
  setEngineVolume.mockClear()
})

afterEach(() => {
  // Without `globals` in the Vitest config, Testing Library does not clean up by itself: the
  // mounts of one test would keep listening to the page in the next one and
  // would create audio contexts that belong to nobody.
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/**
 * Mounts the game with sound and returns its state to drive it from outside.
 *
 * It carries a real mute button —calling `setMuted` is not enough—
 * because part of what has to be checked is when that change arrives relative
 * to the click that unlocks the audio.
 */
function renderGame(options?: HallOptions) {
  const store = { current: null as GameStore | null }

  function Sound() {
    useGameSound()
    return null
  }

  function Harness() {
    const value = useGameStoreValue(options)
    store.current = value
    return (
      <GameContext.Provider value={value}>
        <Sound />
        <button type="button" onClick={() => setVolume('sfx', value.muted ? DEFAULT_VOLUMES.sfx : 0)}>
          Mute
        </button>
      </GameContext.Provider>
    )
  }

  const view = render(<Harness />)
  return Object.assign(store as { current: GameStore }, {
    unmount: view.unmount,
    /**
     * Presses the mute button as the player would: with the sequence
     * of events the browser sends, not only with the click. The order matters,
     * because it is what decides whether the gesture that unlocks the audio arrives before or
     * at the same time as the order to go silent.
     */
    clickMute: () => {
      const button = view.getByRole('button', { name: 'Mute' })
      fireEvent.pointerDown(button)
      fireEvent.pointerUp(button)
      fireEvent.click(button)
    },
  })
}

/** The browser does not let anything play until the user interacts with the page. */
function interact() {
  act(() => {
    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('click'))
  })
}

/** One second of the countdown. */
function tickSecond() {
  act(() => void vi.advanceTimersByTime(1000))
}

/** Leaves the run playing, with the countdown run out. */
function startPlaying(store: { current: GameStore }) {
  act(() => store.current.startGame())
  for (let second = 0; second < COUNTDOWN_SECONDS; second++) tickSecond()
}

/** The sounds asked for so far, in order. */
function playedSounds() {
  return play.mock.calls.map(([sound]) => sound)
}

describe('sound of the run', () => {
  it('nothing sounds until the player has interacted', () => {
    // It is the browser's policy: an audio context created without a previous
    // gesture is born suspended and the game stays mute for the rest of the session.
    const store = renderGame()
    startPlaying(store)
    act(() => store.current.catchStick(0.5))

    expect(play).not.toHaveBeenCalled()
  })

  it('catching a stick sounds', () => {
    const store = renderGame()
    interact()
    startPlaying(store)
    play.mockClear()

    act(() => store.current.catchStick(0.5))

    expect(playedSounds()).toEqual([{ name: 'catch', streak: 1 }])
  })

  it('the streak travels in the sound of the hit', () => {
    const store = renderGame()
    interact()
    startPlaying(store)
    act(() => store.current.catchStick(0.5))
    play.mockClear()

    act(() => store.current.catchStick(0.5))

    expect(playedSounds()).toEqual([{ name: 'catch', streak: 2 }])
  })

  it('missing a stick sounds different from catching it', () => {
    const store = renderGame()
    interact()
    startPlaying(store)
    play.mockClear()

    act(() => store.current.missStick())

    expect(playedSounds()).toEqual([{ name: 'miss' }])
  })

  it('two sticks resolved in the same batch sound once', () => {
    // Two copies of the same sound at once are not heard as two, they are heard as
    // one louder one.
    const store = renderGame()
    interact()
    act(() => store.current.setStickCount(9))
    startPlaying(store)
    play.mockClear()

    act(() => {
      store.current.catchStick(0.5)
      store.current.catchStick(0.5)
    })

    expect(playedSounds()).toEqual([{ name: 'catch', streak: 2 }])
  })

  it('the countdown marks each second and finishes off with the go', () => {
    const store = renderGame()
    interact()

    act(() => store.current.startGame())
    for (let second = 0; second < COUNTDOWN_SECONDS; second++) tickSecond()

    expect(playedSounds()).toEqual([
      { name: 'countdown', secondsLeft: 3 },
      { name: 'countdown', secondsLeft: 2 },
      { name: 'countdown', secondsLeft: 1 },
      { name: 'go' },
    ])
  })

  it('going back to the menu during the countdown does not give the go', () => {
    const store = renderGame()
    interact()

    act(() => store.current.startGame())
    tickSecond()
    act(() => store.current.resetGame())
    act(() => void vi.advanceTimersByTime(5000))

    expect(playedSounds()).not.toContainEqual({ name: 'go' })
  })

  it('a hit and a miss at once are both heard', () => {
    // With the headset's controllers the grab is resolved in the same frame as the
    // fall, so both things can arrive in the same batch. Swallowing one
    // would leave the player without knowing what has just happened, which is exactly what
    // the sound is there for.
    const store = renderGame()
    interact()
    startPlaying(store)
    play.mockClear()

    act(() => {
      store.current.catchStick(0.5)
      store.current.missStick()
    })

    expect(playedSounds().map((sound) => sound.name)).toEqual(['catch', 'miss'])
  })

  it('in silence the audio context is not even created', () => {
    // Muting is not turning the volume down to zero: if the context were created, the
    // game would keep asking for playback permission and scheduling nodes for
    // nothing.
    const store = renderGame()
    act(() => setVolume('sfx', 0))
    interact()
    startPlaying(store)
    act(() => store.current.catchStick(0.5))

    expect(contexts).toHaveLength(0)
    expect(play).not.toHaveBeenCalled()
  })

  it('muting with the first click of the page does not open it either', () => {
    // That click is at once the gesture that unlocks the audio and the order to
    // go silent. Attended to separately —the gesture in `pointerdown` and the button in
    // the click— the game opens a context to close it in the next render.
    const store = renderGame()

    store.clickMute()
    startPlaying(store)

    expect(store.current.muted).toBe(true)
    expect(contexts).toHaveLength(0)
  })

  it('muting mid-run closes the context and goes silent', () => {
    const store = renderGame()
    interact()
    startPlaying(store)

    act(() => setVolume('sfx', 0))
    play.mockClear()
    act(() => store.current.catchStick(0.5))

    expect(contexts[0].close).toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
  })

  it('unmuting brings the sound back without waiting for another gesture', () => {
    // The button itself is the gesture the browser demands, so waiting for
    // a click again would leave the run that is already under way mute.
    const store = renderGame()
    interact()
    startPlaying(store)
    act(() => setVolume('sfx', 0))
    act(() => setVolume('sfx', DEFAULT_VOLUMES.sfx))
    play.mockClear()

    act(() => store.current.catchStick(0.5))

    expect(playedSounds()).toEqual([{ name: 'catch', streak: 1 }])
  })

  it('going into silence and back leaves no contexts open', () => {
    // Each return opens a new one, and the browser only allows a few per
    // tab: if the previous one were not closed, a few goings and comings
    // would leave the game mute until the page is reloaded.
    renderGame()
    interact()

    for (let round = 0; round < 3; round++) {
      act(() => setVolume('sfx', 0))
      act(() => setVolume('sfx', DEFAULT_VOLUMES.sfx))
    }

    expect(contexts).toHaveLength(4)
    for (const closed of contexts.slice(0, -1)) {
      expect(closed.close).toHaveBeenCalled()
    }
    expect(contexts[contexts.length - 1].close).not.toHaveBeenCalled()
  })

  it('on unmounting it closes the audio context', () => {
    // Without this each mount leaves a context alive, and the browser only allows
    // a few per tab before refusing to create more.
    const store = renderGame()
    interact()

    store.unmount()

    expect(contexts).toHaveLength(1)
    expect(contexts[0].close).toHaveBeenCalled()
  })

  it('starting another run does not sound like a hit because of the scoreboard at zero', () => {
    const store = renderGame()
    interact()
    startPlaying(store)
    act(() => store.current.catchStick(0.5))
    act(() => store.current.resetGame())
    play.mockClear()

    startPlaying(store)

    expect(playedSounds()).not.toContainEqual({ name: 'catch', streak: 1 })
  })
})

describe('the volume of the effects', () => {
  it('is born at the one the hall settings say', () => {
    setVolume('sfx', 40)
    const game = renderGame()
    interact()
    startPlaying(game)

    expect(setEngineVolume).toHaveBeenCalledWith(0.4)
  })

  it('changing it does not rebuild the audio: the engine already there is told', () => {
    // Recreating the engine closed the context and opened another at each step of the
    // slider, and that is a cut in the sound for every nudge.
    const game = renderGame()
    interact()
    startPlaying(game)
    const openContexts = contexts.length
    setEngineVolume.mockClear()

    act(() => setVolume('sfx', 20))

    expect(setEngineVolume).toHaveBeenCalledWith(0.2)
    expect(contexts).toHaveLength(openContexts)
  })

  it('the engine that arrives later is born with what was chosen while there was none', () => {
    // In silence there is no engine. If when the sound came back it were born with the volume
    // from before, what was chosen during the silence would be lost.
    const game = renderGame()
    interact()
    startPlaying(game)
    act(() => setVolume('sfx', 0))
    setEngineVolume.mockClear()

    act(() => setVolume('sfx', 60))

    // Coming back from silence creates another engine, and it is born already at the current volume.
    expect(setEngineVolume).toHaveBeenCalledWith(0.6)
  })
})

describe('the medal threshold', () => {
  const goal = {
    medals: { bronze: 1, silver: 100000, gold: 200000 },
    better: 'higher',
    unit: 'points in challenge',
    record: null,
    mode: 'challenge',
  } as const

  it('crossing it sounds once per threshold, with its medal, on top of the catch', () => {
    const store = renderGame({ goal })
    interact()
    startPlaying(store)
    play.mockClear()

    act(() => store.current.catchStick(0.5))
    expect(playedSounds()).toEqual([
      { name: 'catch', streak: 1 },
      { name: 'medal', rank: 0 },
    ])

    // The next stick crosses nothing: only the catch is heard.
    play.mockClear()
    act(() => store.current.catchStick(0.5))
    expect(playedSounds()).toEqual([{ name: 'catch', streak: 2 }])

  })

  it('and the medal reached is the one that sounds: in one jump to silver, silver', () => {
    const store = renderGame({ goal: { ...goal, medals: { bronze: 1, silver: 2, gold: 200000 } } })
    interact()
    startPlaying(store)
    play.mockClear()

    act(() => store.current.catchStick(0.5))

    expect(store.current.medal).toBe('silver')
    expect(playedSounds().filter((sound) => sound.name === 'medal')).toEqual([{ name: 'medal', rank: 1 }])
  })

  it('without a hall there are no thresholds to cross, and in practice neither', () => {
    const standalone = renderGame()
    interact()
    startPlaying(standalone)
    act(() => standalone.current.catchStick(0.5))
    expect(playedSounds().some((sound) => sound.name === 'medal')).toBe(false)
    standalone.unmount()

    const practice = renderGame({ goal })
    act(() => practice.current.setGameMode('practice'))
    interact()
    startPlaying(practice)
    play.mockClear()
    act(() => practice.current.catchStick(0.5))
    expect(playedSounds()).toEqual([{ name: 'catch', streak: 1 }])
  })
})
