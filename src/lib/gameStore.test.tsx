import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MACHINE_HEIGHT, MAX_STICKS, MIN_STICKS } from './gameConfig'
import { COUNTDOWN_SECONDS, useGame, useGameStoreValue, type HallOptions } from './gameStore'
import { CHALLENGE_LIVES, CHALLENGE_SETUP, DEFAULT_GAME_MODE } from './gameMode'
import { buildStickLayout } from './stickLayout'
import { HIGH_SCORE_KEYS } from './highScore'
import { FEATS, FEATS_KEY } from './feats'
import { HOOP_ADJUST_RANGE, HOOP_ADJUST_STEP } from './hoopHeight'
import { OWN_SCENERY_KEY } from './sceneryPreference'
import { STEP_DEADLINE, TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE, type TutorialStepKey } from './tutorial'
import { DEFAULT_VOLUMES, SCENERY_KEY, VOLUME_KEYS } from './settings'
import { setLang, setVolume } from './settingsClient'
import type { Goal } from './goal'
import { formatFigure } from './textos'

// The countdown uses `setTimeout`, so the whole file runs with fake
// timers: otherwise each run would cost three real seconds of test.
beforeEach(() => {
  vi.useFakeTimers()
  // The record is saved in `localStorage`, which jsdom shares between tests: without
  // emptying it, a run of one test would count the record of another as beaten.
  localStorage.clear()
  // The volumes come from the hall's settings, which cache what was read so
  // that `useSyncExternalStore` does not repaint endlessly: emptying `localStorage`
  // alone would leave the cache with the value of the previous test. They are reset
  // through the API, which is what invalidates it.
  setVolume('sfx', DEFAULT_VOLUMES.sfx)
  setVolume('ambience', DEFAULT_VOLUMES.ambience)
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Runs out the countdown and leaves the run in play.
 *
 * Second by second, and not in one jump: each tick reschedules the next from
 * an effect, which does not run until React renders again. Advancing three
 * seconds at once would only fire the first.
 */
function runOutCountdown() {
  for (let second = 0; second < COUNTDOWN_SECONDS; second++) {
    act(() => void vi.advanceTimersByTime(1000))
  }
}

/**
 * Opens the game and leaves **practice** chosen, which is what almost all these tests play: there
 * the sticks and the speed are chosen. The menu opens on the challenge («practice and challenge» checks it).
 */
function openInPractice(options?: HallOptions) {
  const hook = renderHook(() => useGameStoreValue(options))
  act(() => hook.result.current.setGameMode('practice'))
  return hook
}

/** Starts a run and runs out the countdown, leaving it in play. */
function startPlaying(store: {
  current: ReturnType<typeof useGameStoreValue>
}) {
  act(() => store.current.startGame())
  runOutCountdown()
}

/** Plays a whole run catching `caught` sticks and missing the rest. */
function playRound(
  store: { current: ReturnType<typeof useGameStoreValue> },
  total: number,
  caught: number,
) {
  act(() => store.current.setStickCount(total))
  startPlaying(store)
  for (let i = 0; i < total; i++) {
    act(() => {
      if (i < caught) store.current.catchStick(0.5)
      else store.current.missStick()
    })
  }
}

describe('selection before the run', () => {
  it('starts in the menu with the default values', () => {
    const { result } = openInPractice()
    expect(result.current.gameState).toBe('menu')
    expect(result.current.stickCount).toBe(MIN_STICKS)
    expect(result.current.difficulty).toBe('easy')
    expect(result.current.score).toBe(0)
  })

  it('accepts any number of sticks within the range', () => {
    const { result } = openInPractice()
    act(() => result.current.setStickCount(9))
    expect(result.current.stickCount).toBe(9)
  })

  it('clamps out-of-range values instead of breaking the scene', () => {
    const { result } = openInPractice()

    act(() => result.current.setStickCount(MIN_STICKS - 3))
    expect(result.current.stickCount).toBe(MIN_STICKS)

    act(() => result.current.setStickCount(MAX_STICKS + 100))
    expect(result.current.stickCount).toBe(MAX_STICKS)

    act(() => result.current.setStickCount(-1))
    expect(result.current.stickCount).toBe(MIN_STICKS)
  })

  it('rounds decimals and discards NaN', () => {
    const { result } = openInPractice()

    act(() => result.current.setStickCount(7.4))
    expect(result.current.stickCount).toBe(7)

    act(() => result.current.setStickCount(Number.NaN))
    expect(result.current.stickCount).toBe(MIN_STICKS)
  })

  it('changes difficulty', () => {
    const { result } = openInPractice()
    act(() => result.current.setDifficulty('impossible'))
    expect(result.current.difficulty).toBe('impossible')
  })
})

describe('life cycle of a run', () => {
  it('starts playing with the scoreboard at zero', () => {
    const { result } = openInPractice()
    startPlaying(result)

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
  })

  it('renews the run identifier to remount the sticks', () => {
    const { result } = openInPractice()
    const before = result.current.runId
    startPlaying(result)
    expect(result.current.runId).toBe(before + 1)
  })

  it('adds up the sticks caught without closing the run early', () => {
    const { result } = openInPractice()
    act(() => result.current.setStickCount(5))
    startPlaying(result)

    act(() => result.current.catchStick(0.5))

    expect(result.current.score).toBe(1)
    expect(result.current.resolved).toBe(1)
    expect(result.current.gameState).toBe('playing')
  })

  it('counts the missed stick as resolved, without adding to the scoreboard', () => {
    const { result } = openInPractice()
    act(() => result.current.setStickCount(5))
    startPlaying(result)
    act(() => result.current.missStick())

    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(1)
  })

  it('ends the run when the last stick is resolved', () => {
    const { result } = openInPractice()
    playRound(result, 5, 3)

    expect(result.current.gameState).toBe('finished')
    expect(result.current.score).toBe(3)
    expect(result.current.resolved).toBe(5)
  })

  it('does not hang if two sticks are resolved at once', () => {
    // Two XR controllers on different sticks, or the last stick touching the floor
    // while another is caught: both resolutions land in the same React
    // batch. The counter is updated from the previous value, so
    // neither is lost.
    const { result } = openInPractice()
    act(() => result.current.setStickCount(5))
    startPlaying(result)

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.catchStick(0.5)
      }
    })

    expect(result.current.resolved).toBe(5)
    expect(result.current.score).toBe(5)
    expect(result.current.gameState).toBe('finished')
  })

  it('survives one resolution too many without going back to the menu', () => {
    const { result } = openInPractice()
    playRound(result, 5, 5)
    act(() => result.current.missStick())

    expect(result.current.gameState).toBe('finished')
  })
})

describe('countdown', () => {
  it('the run does not start at once: first it counts', () => {
    const { result } = openInPractice()
    act(() => result.current.startGame())

    expect(result.current.gameState).toBe('countdown')
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS)
  })

  it('goes down one second at a time', () => {
    const { result } = openInPractice()
    act(() => result.current.startGame())

    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS - 1)

    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS - 2)
    expect(result.current.gameState).toBe('countdown')
  })

  it('the sticks do not fall while it counts', () => {
    // `StickMachine` keeps them still by looking at the phase; if the countdown
    // were not a phase of its own, the first stick would come out before the "go".
    const { result } = openInPractice()
    act(() => result.current.startGame())
    expect(result.current.gameState).not.toBe('playing')
  })

  it('on reaching zero play starts', () => {
    const { result } = openInPractice()
    act(() => result.current.startGame())
    runOutCountdown()

    expect(result.current.gameState).toBe('playing')
  })

  it('returning to the menu during the count cuts it short', () => {
    const { result } = openInPractice()
    act(() => result.current.startGame())
    act(() => result.current.resetGame())

    expect(result.current.gameState).toBe('menu')

    // And it does not start on its own afterwards: a timer left alive cannot
    // send the player back to a run they have cancelled.
    act(() => void vi.advanceTimersByTime(5000))
    expect(result.current.gameState).toBe('menu')
  })
})

describe('first-time tutorial', () => {
  /** Puts the headset on: it is what `XRSessionController` does when the session opens. */
  function wearHeadset(store: {
    current: ReturnType<typeof useGameStoreValue>
  }) {
    act(() => store.current.setImmersive(true))
  }

  /** Catches a stick, which is what passes the steps of the lesson. */
  function catchOne(store: { current: ReturnType<typeof useGameStoreValue> }) {
    act(() => store.current.catchStick(0.5))
  }

  /** Lets the safety deadline of the current step run out. */
  function waitOutStep(
    store: { current: ReturnType<typeof useGameStoreValue> },
    step: TutorialStepKey,
  ) {
    act(() => void vi.advanceTimersByTime(STEP_DEADLINE[step] * 1000))
  }

  it('with the headset on, the first run goes along teaching', () => {
    // And without anyone asking: whoever arrives for the first time does not know there is something
    // to ask for. The decision is the game's and not the pressed button's, because
    // inside the session a run is also started from the overlay with the keyboard.
    const { result } = openInPractice()
    wearHeadset(result)

    act(() => result.current.startGame())
    expect(result.current.teaching).toBe(true)
    expect(result.current.tutorialStep).toBe('grab')
  })

  it('but the run does not stop: the lesson runs on top', () => {
    // It is the difference from the earlier demonstration, which put the run in a
    // queue: whoever watched it doing nothing came out just as they went in.
    const { result } = openInPractice()
    act(() => result.current.startGame({ tutorial: true }))

    expect(result.current.gameState).toBe('countdown')
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS)

    runOutCountdown()
    expect(result.current.gameState).toBe('playing')
    expect(result.current.teaching).toBe(true)
  })

  it('on desktop it teaches nothing, even if it has not been seen', () => {
    // There the start screen explains it with text, which is read before
    // starting and without the headset on.
    const { result } = openInPractice()
    act(() => result.current.startGame())

    expect(result.current.tutorialSeen).toBe(false)
    expect(result.current.teaching).toBe(false)
    expect(result.current.tutorialStep).toBeNull()
  })

  it('with the headset on but already seen, play starts directly', () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE)
    const { result } = openInPractice()
    wearHeadset(result)

    act(() => result.current.startGame())
    expect(result.current.teaching).toBe(false)
  })

  it('whoever saw the old lesson sees it again: it is not the same one', () => {
    // What is saved is the version of the lesson. Version 1 was the clock-driven
    // demonstration, which was not done by playing.
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1')
    const { result } = openInPractice()
    wearHeadset(result)

    expect(result.current.tutorialSeen).toBe(false)
    act(() => result.current.startGame())
    expect(result.current.teaching).toBe(true)
  })

  it('each step is passed by catching a stick, not by watching', () => {
    const { result } = openInPractice()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()

    expect(result.current.tutorialStep).toBe('grab')
    catchOne(result)
    expect(result.current.tutorialStep).toBe('around')
    catchOne(result)
    expect(result.current.tutorialStep).toBeNull()
  })

  it('and on passing them all the lesson is removed and stays seen', () => {
    // Removing it is running out of steps: that is what unmounts the panel, in the
    // headset and in the overlay. What is saved is what takes it out of the
    // next runs.
    const { result } = openInPractice()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()
    catchOne(result)
    catchOne(result)

    expect(result.current.tutorialStep).toBeNull()
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBe(TUTORIAL_SEEN_VALUE)
  })

  it('and it does not come up again in the next run of the same visit', () => {
    // What is learnt by catching is noted outside React, so `startGame` has
    // to re-read it: looking at what was read on mount, the second run of the
    // same visit would teach again what was already learnt.
    const { result } = openInPractice()
    wearHeadset(result)
    act(() => result.current.startGame())
    runOutCountdown()
    catchOne(result)
    catchOne(result)

    act(() => result.current.resetGame())
    act(() => result.current.startGame())
    expect(result.current.teaching).toBe(false)
    expect(result.current.tutorialSeen).toBe(true)
  })

  it('the next button counts the step as passed without having done it', () => {
    const { result } = openInPractice()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()

    act(() => result.current.nextTutorialStep())
    expect(result.current.tutorialStep).toBe('around')
    act(() => result.current.nextTutorialStep())
    expect(result.current.tutorialStep).toBeNull()
  })

  it('and with no step up it does nothing', () => {
    // With no lesson under way there is nothing to pass, and adding to the count of
    // skipped ones would leave the first step hidden in the next run.
    const { result } = openInPractice()
    act(() => result.current.startGame())
    runOutCountdown()

    act(() => result.current.nextTutorialStep())
    expect(result.current.tutorialStep).toBeNull()
  })

  it('the safety deadline passes the step on its own, if the milestone does not come', () => {
    // A step that is not achieved —because the sticks get away— would leave someone
    // locked in it with the panel in front of their face the whole run.
    const { result } = openInPractice()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()

    waitOutStep(result, 'grab')
    expect(result.current.tutorialStep).toBe('around')
    waitOutStep(result, 'around')
    expect(result.current.tutorialStep).toBeNull()
  })

  it('the deadline does not run while not playing', () => {
    // During the countdown there are no sticks to catch: spending the deadline of the
    // first step there would be passing it before anyone could have tried.
    const { result } = openInPractice()
    act(() => result.current.startGame({ tutorial: true }))

    act(() => void vi.advanceTimersByTime(STEP_DEADLINE.grab * 1000))
    expect(result.current.tutorialStep).toBe('grab')
  })

  it('nor with the quit question on screen, which stops the run', () => {
    const { result } = openInPractice()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()
    act(() => result.current.askToQuit())

    waitOutStep(result, 'grab')
    expect(result.current.tutorialStep).toBe('grab')
  })

  it('skipping it counts as seen: the decision is made', () => {
    const { result } = openInPractice()
    act(() => result.current.startGame({ tutorial: true }))
    act(() => result.current.finishTutorial())

    expect(result.current.teaching).toBe(false)
    expect(result.current.tutorialStep).toBeNull()
    expect(result.current.tutorialSeen).toBe(true)
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBe(TUTORIAL_SEEN_VALUE)
  })

  it('and skipping it does not touch the run, which never got to stop', () => {
    const { result } = openInPractice()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()
    act(() => result.current.catchStick(0.5))
    act(() => result.current.finishTutorial())

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(1)
  })

  it('removing it twice does not write anything again', () => {
    const { result } = openInPractice()
    act(() => result.current.startGame({ tutorial: true }))
    act(() => result.current.finishTutorial())
    localStorage.removeItem(TUTORIAL_SEEN_KEY)

    act(() => result.current.finishTutorial())
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBeNull()
  })

  it('leaving it halfway does not count as seen', () => {
    // Returning to the menu with the panel up is not having done it: they will find it
    // again on pressing start.
    const { result } = openInPractice()
    act(() => result.current.startGame({ tutorial: true }))
    runOutCountdown()
    act(() => result.current.resetGame())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.teaching).toBe(false)
    expect(result.current.tutorialSeen).toBe(false)
    expect(localStorage.getItem(TUTORIAL_SEEN_KEY)).toBeNull()

    // And the deadline left alive cannot count it as seen from the menu.
    waitOutStep(result, 'grab')
    expect(result.current.gameState).toBe('menu')
    expect(result.current.tutorialSeen).toBe(false)
  })

  it('and the next run starts the lesson from the beginning', () => {
    // The steps counted as passed are forgotten on returning to the menu: otherwise, whoever
    // left the lesson halfway would find the second step without seeing the
    // first.
    const { result } = openInPractice()
    wearHeadset(result)
    act(() => result.current.startGame())
    runOutCountdown()
    act(() => result.current.nextTutorialStep())
    expect(result.current.tutorialStep).toBe('around')

    act(() => result.current.resetGame())
    act(() => result.current.startGame())
    expect(result.current.tutorialStep).toBe('grab')
  })

  it('once seen it does not come up again on starting another', () => {
    const { result } = openInPractice()
    wearHeadset(result)
    act(() => result.current.startGame())
    act(() => result.current.finishTutorial())
    runOutCountdown()

    act(() => result.current.startGame())
    expect(result.current.teaching).toBe(false)
  })

  it('what was seen on another visit is still seen on coming back', () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE)
    const { result } = openInPractice()

    expect(result.current.tutorialSeen).toBe(true)
  })

  it('it can be watched again even if already known', () => {
    // It is what the immersive menu's button does: asking for it explicitly is worth
    // more than whatever was saved.
    localStorage.setItem(TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE)
    const { result } = openInPractice()

    act(() => result.current.startGame({ tutorial: true }))
    expect(result.current.teaching).toBe(true)
    expect(result.current.tutorialStep).toBe('grab')
  })

  it('what is being played with is recorded by the session, and it only changes what is taught', () => {
    // Bare-handed there is no button to name: the sentence changes, not what
    // has to be done.
    const { result } = openInPractice()
    expect(result.current.bareHanded).toBe(false)

    act(() => result.current.setBareHanded(true))
    expect(result.current.bareHanded).toBe(true)
  })
})

/**
 * The warm-up (`warmup.ts`): the first run with the headset, in the challenge and with the
 * lesson in front, does not count.
 */
describe('the warm-up', () => {
  function inTheChallenge(options?: HallOptions) {
    const hook = renderHook(() => useGameStoreValue(options))
    act(() => hook.result.current.setImmersive(true))
    return hook
  }

  it('three sticks on the floor with the lesson in front leave the challenge intact', () => {
    const { result } = inTheChallenge()
    act(() => result.current.startGame())
    runOutCountdown()
    expect(result.current.warmingUp).toBe(true)

    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    expect(result.current.gameState).toBe('playing')
    expect(result.current.lives).toBe(3)
    expect(result.current.sign?.title).toBe('Warm-up · does not count for a medal')
    expect(result.current.sign?.subdued).toBe(true)
  })

  it('when the lesson closes the challenge starts from scratch and warns that it now counts', () => {
    const { result } = inTheChallenge({ goal: { medals: { bronze: 1900, silver: 3750, gold: 5200 }, better: 'higher', unit: 'points', record: null, mode: 'challenge' } })
    act(() => result.current.startGame())
    runOutCountdown()
    act(() => result.current.missStick())
    act(() => result.current.catchStick(0.5))
    const before = result.current.runId

    // The second stick caught passes the last step.
    act(() => result.current.catchStick(0.5))

    expect(result.current.warmingUp).toBe(false)
    expect(result.current.teaching).toBe(false)
    expect(result.current.runId).toBe(before + 1)
    expect(result.current.gameState).toBe('countdown')
    expect([result.current.score, result.current.resolved, result.current.points, result.current.lives]).toEqual([0, 0, 0, 3])
    expect(result.current.nowItCounts).toBe(true)
    expect(result.current.sign?.title).toBe('Now it counts for a medal')
    expect(result.current.sign?.detail).toBe('Bronze ≈ 13 sticks · Gold 5,200')

    // Until the first stick of the challenge is resolved.
    runOutCountdown()
    act(() => result.current.missStick())
    expect(result.current.nowItCounts).toBe(false)
    expect(result.current.lives).toBe(2)
  })

  it('skipping the lesson also starts the challenge from scratch', () => {
    const { result } = inTheChallenge()
    act(() => result.current.startGame())
    runOutCountdown()
    act(() => result.current.missStick())
    act(() => result.current.finishTutorial())

    expect([result.current.warmingUp, result.current.resolved, result.current.gameState]).toEqual([false, 0, 'countdown'])
  })

  it('in practice, with two players and on returning to the menu there is no warm-up', () => {
    const practice = openInPractice()
    act(() => practice.result.current.setImmersive(true))
    act(() => practice.result.current.startGame())
    expect(practice.result.current.warmingUp).toBe(false)

    const { result } = inTheChallenge()
    act(() => result.current.startGame())
    act(() => result.current.resetGame())
    expect([result.current.warmingUp, result.current.nowItCounts]).toEqual([false, false])
  })
})

describe('practice and challenge', () => {
  /**
   * Starts a challenge run with `total` sticks and leaves it in play. It goes
   * through the menu first, like the player: the mode is only changed there.
   */
  function startChallenge(
    store: { current: ReturnType<typeof useGameStoreValue> },
    total: number,
  ) {
    act(() => store.current.resetGame())
    act(() => store.current.setGameMode('challenge'))
    act(() => store.current.setStickCount(total))
    startPlaying(store)
  }

  it('the menu opens on the challenge, with its three lives: Jugar without touching anything starts the run that gives a medal', () => {
    const { result } = renderHook(() => useGameStoreValue())

    expect(DEFAULT_GAME_MODE).toBe('challenge')
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.lives).toBe(CHALLENGE_LIVES)

    startPlaying(result)

    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.activeStickCount).toBe(CHALLENGE_SETUP.stickCount)
    expect(result.current.activeDifficulty).toBe(CHALLENGE_SETUP.difficulty)
    expect(result.current.signPhase).toBe('before')
  })

  it('and it always opens on the challenge: the last mode played is not remembered', () => {
    const first = openInPractice()
    playRound(first.result, 5, 5)

    const reopened = renderHook(() => useGameStoreValue())

    expect(reopened.result.current.gameMode).toBe('challenge')
  })

  it('practice is one tap away, with no lives to lose', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setGameMode('practice'))

    expect(result.current.gameMode).toBe('practice')
    expect(result.current.lives).toBeNull()
  })

  it('in practice, missing them all does not cut the run short', () => {
    const { result } = openInPractice()
    act(() => result.current.setStickCount(13))
    startPlaying(result)

    for (let i = 0; i < 12; i++) act(() => result.current.missStick())

    expect(result.current.gameState).toBe('playing')
    expect(result.current.lives).toBeNull()
  })

  it('the challenge starts with three lives and each miss costs one', () => {
    const { result } = openInPractice()
    startChallenge(result, 13)
    expect(result.current.lives).toBe(3)

    act(() => result.current.missStick())
    expect(result.current.lives).toBe(2)

    act(() => result.current.missStick())
    expect(result.current.lives).toBe(1)
    expect(result.current.gameState).toBe('playing')
  })

  it('catching sticks does not spend lives', () => {
    const { result } = openInPractice()
    startChallenge(result, 13)

    act(() => result.current.catchStick(0.5))
    act(() => result.current.catchStick(0.5))

    expect(result.current.lives).toBe(3)
  })

  it('running out of lives closes the run even if sticks remain', () => {
    // It is what sets the challenge apart: the run has an ending that does not depend
    // on everything that is hanging coming down.
    const { result } = openInPractice()
    startChallenge(result, 13)

    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    expect(result.current.lives).toBe(0)
    expect(result.current.outcome).toBe('failed')
    expect(result.current.gameState).toBe('finished')
    expect(result.current.resolved).toBeLessThan(result.current.stickCount)
  })

  it('one miss too many does not leave the lives negative', () => {
    // Two sticks can touch the floor in the same batch just as the
    // last life runs out.
    const { result } = openInPractice()
    startChallenge(result, 13)

    act(() => {
      for (let i = 0; i < 4; i++) result.current.missStick()
    })

    expect(result.current.lives).toBe(0)
    expect(result.current.outcome).toBe('failed')
  })

  it('resolving all the sticks with lives left is beating the challenge', () => {
    const { result } = openInPractice()
    startChallenge(result, CHALLENGE_SETUP.stickCount)

    act(() => result.current.missStick())
    for (let i = 1; i < CHALLENGE_SETUP.stickCount; i++) act(() => result.current.catchStick(0.5))

    expect(result.current.outcome).toBe('cleared')
    expect(result.current.gameState).toBe('finished')
    expect(result.current.lives).toBe(2)
  })

  it('the practice run ends with no challenge outcome', () => {
    const { result } = openInPractice()
    playRound(result, 5, 3)

    expect(result.current.gameState).toBe('finished')
    expect(result.current.outcome).toBe('cleared')
    expect(result.current.lives).toBeNull()
  })

  it('the mode survives the run and returning to the menu', () => {
    // Like the number of sticks or the difficulty: choosing it again in every
    // rematch would be exactly what gets in the way with the headset on.
    const { result } = openInPractice()
    startChallenge(result, 5)
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    act(() => result.current.resetGame())

    expect(result.current.gameMode).toBe('challenge')
    // And the lives are whole again: in the menu they are the ones put at
    // stake, not the ones left from the previous one.
    expect(result.current.lives).toBe(3)
    expect(result.current.outcome).toBeNull()
  })

  it('the mode is only changed between runs', () => {
    // The score and the mode in which it was made are a pair: with the summary on
    // screen, changing mode sent those points to the record of the other mode,
    // one that has not been played. Breaking the guard, the challenge record
    // shows up with the points of this practice run.
    const { result } = openInPractice()
    playRound(result, 5, 5)
    const points = result.current.points
    expect(points).toBeGreaterThan(0)

    act(() => result.current.setGameMode('challenge'))
    expect(result.current.gameMode).toBe('practice')

    act(() => result.current.resetGame())
    act(() => result.current.setGameMode('challenge'))
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.bestPoints).toBe(0)
  })

  it('each mode keeps its own record', () => {
    // A challenge is cut short on running out of lives, so with a shared best
    // it could never beat the equivalent practice.
    const { result } = openInPractice()
    playRound(result, 5, 5)
    const practiceRecord = result.current.bestPoints
    expect(practiceRecord).toBeGreaterThan(0)

    startChallenge(result, 5)
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    // A run with no points leaves no record, but the practice one does not
    // show up in the challenge either: nothing has been done here yet.
    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)

    act(() => result.current.resetGame())
    act(() => result.current.setGameMode('practice'))
    expect(result.current.bestPoints).toBe(practiceRecord)
  })

  it('a challenge beats its record even if it is far from the practice one', () => {
    // It is the reason there are two bests: a challenge is cut short on running out of
    // lives, so with only one it could never beat practice and the mode
    // with something at stake would be the only one with nothing to beat.
    const { result } = openInPractice()
    playRound(result, 5, 5)
    const practiceRecord = result.current.bestPoints

    startChallenge(result, 5)
    act(() => result.current.catchStick(0.5))
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    expect(result.current.points).toBeLessThan(practiceRecord)
    expect(result.current.isRecord).toBe(true)
    expect(result.current.bestPoints).toBe(result.current.points)

    act(() => result.current.resetGame())
    act(() => result.current.setGameMode('practice'))
    expect(result.current.bestPoints).toBe(practiceRecord)
  })
})

describe('the challenge comes preconfigured', () => {
  it('always plays with what the mode fixes, whatever is chosen in practice', () => {
    // Its record is the cabinet's: with the difficulty and the sticks to choose, two records of the
    // challenge would not be the same run.
    const { result } = openInPractice()
    act(() => result.current.setDifficulty('impossible'))
    act(() => result.current.setStickCount(MAX_STICKS))
    act(() => result.current.setGameMode('challenge'))

    expect(result.current.activeDifficulty).toBe(CHALLENGE_SETUP.difficulty)
    expect(result.current.activeStickCount).toBe(CHALLENGE_SETUP.stickCount)

    // And what was chosen is still there for when practice is returned to.
    act(() => result.current.setGameMode('practice'))
    expect(result.current.activeDifficulty).toBe('impossible')
    expect(result.current.activeStickCount).toBe(MAX_STICKS)
  })
})

describe('the challenge of the hall', () => {
  const CHALLENGE = { seed: 20260925 }

  function withChallenge(options: HallOptions) {
    return renderHook((props: HallOptions) => useGameStoreValue(props), {
      initialProps: options,
    })
  }

  it('with no options it stays in the menu, with the challenge chosen but without being the challenge of the hall', () => {
    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.gameState).toBe('menu')
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.inChallenge).toBe(false)
  })

  it('with a challenge it starts out counting, in the challenge and with what the mode fixes', () => {
    const { result } = withChallenge({ challenge: CHALLENGE })
    expect(result.current.gameState).toBe('countdown')
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.inChallenge).toBe(true)
    expect(result.current.activeDifficulty).toBe(CHALLENGE_SETUP.difficulty)
    expect(result.current.activeStickCount).toBe(CHALLENGE_SETUP.stickCount)
    expect(result.current.lives).toBe(3)
    runOutCountdown()
    expect(result.current.gameState).toBe('playing')
  })

  it('with no lesson, even if it is played with the headset and has never been seen', () => {
    const { result } = withChallenge({ challenge: CHALLENGE })
    act(() => result.current.setImmersive(true))
    runOutCountdown()
    expect(result.current.teaching).toBe(false)
    expect(result.current.tutorialStep).toBeNull()
  })

  it('the same seed deals the same sticks, and another seed does not', () => {
    const one = withChallenge({ challenge: CHALLENGE }).result.current
    const other = withChallenge({ challenge: CHALLENGE }).result.current
    const different = withChallenge({ challenge: { seed: CHALLENGE.seed + 1 } }).result.current

    expect(one.stickSeed).toBe(other.stickSeed)
    const layout = (seed: number) =>
      buildStickLayout(CHALLENGE_SETUP.stickCount, seed).map(({ delay }) => delay)
    expect(layout(one.stickSeed)).toEqual(layout(other.stickSeed))
    expect(layout(different.stickSeed)).not.toEqual(layout(one.stickSeed))
  })

  it('with no challenge, each run gets a fresh seed', () => {
    const { result } = openInPractice()
    startPlaying(result)
    const first = result.current.stickSeed
    act(() => result.current.resetGame())
    startPlaying(result)
    expect(result.current.stickSeed).not.toBe(first)
  })

  it('on finishing the challenge it reports once, with its points and as a challenge', () => {
    const onFinish = vi.fn()
    const { result, rerender } = withChallenge({ challenge: CHALLENGE, onFinish })
    runOutCountdown()
    act(() => result.current.catchStick(0.5))
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    expect(result.current.gameState).toBe('finished')
    // Painting the final screen again —with another callback, besides— does not count it again.
    const otherCallback = vi.fn()
    rerender({ challenge: CHALLENGE, onFinish: otherCallback })
    rerender({ challenge: CHALLENGE, onFinish: otherCallback })

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith({
      mode: 'challenge',
      points: result.current.points,
      challenge: true,
    })
    expect(result.current.points).toBeGreaterThan(0)
    expect(otherCallback).not.toHaveBeenCalled()
  })

  it('a stick resolved with the run already finished does not count it again', () => {
    // Two sticks can be resolved in the same batch that uses up the last life: the final screen
    // is computed again with more points, but the run is the same.
    const onFinish = vi.fn()
    const { result } = withChallenge({ challenge: CHALLENGE, onFinish })
    runOutCountdown()
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    act(() => result.current.catchStick(0.5))

    expect(result.current.gameState).toBe('finished')
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('another run after the challenge is no longer the challenge, even if it is the same mode', () => {
    const onFinish = vi.fn()
    const { result } = withChallenge({ challenge: CHALLENGE, onFinish })
    const challengeSeed = result.current.stickSeed
    runOutCountdown()
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    startPlaying(result)
    expect(result.current.inChallenge).toBe(false)
    expect(result.current.stickSeed).not.toBe(challengeSeed)
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    expect(onFinish).toHaveBeenCalledTimes(2)
    expect(onFinish).toHaveBeenLastCalledWith({ mode: 'challenge', points: 0, challenge: false })
  })

  it('reports any run with a score, not only the challenge', () => {
    const onFinish = vi.fn()
    const { result } = openInPractice({ onFinish })
    playRound(result, 5, 5)
    expect(onFinish).toHaveBeenCalledWith({
      mode: 'practice',
      points: result.current.points,
      challenge: false,
    })
  })

  it('leaving it halfway is not finishing it: it does not report', () => {
    const onFinish = vi.fn()
    const { result } = withChallenge({ challenge: CHALLENGE, onFinish })
    runOutCountdown()
    act(() => result.current.catchStick(0.5))
    act(() => result.current.askToQuit())
    act(() => result.current.resetGame())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.inChallenge).toBe(false)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('with no callback to call, finishing still saves the record as always', () => {
    const { result } = withChallenge({ challenge: CHALLENGE })
    runOutCountdown()
    act(() => result.current.catchStick(0.5))
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    expect(localStorage.getItem(HIGH_SCORE_KEYS.challenge)).toBe(String(result.current.points))
  })
})

describe('scenery or passthrough', () => {
  it('starts with the scenery on', () => {
    // It is the full experience; whoever prefers to see their room takes it off from
    // the immersive menu.
    const { result } = openInPractice()
    expect(result.current.scenery).toBe('scene')
  })

  it('can be toggled at any time', () => {
    const { result } = openInPractice()

    act(() => result.current.setScenery('passthrough'))
    expect(result.current.scenery).toBe('passthrough')

    act(() => result.current.setScenery('scene'))
    expect(result.current.scenery).toBe('scene')
  })

  it('the choice survives the run', () => {
    // Changing the set is not part of the run: removing it on starting or on
    // returning to the menu would force choosing it every time.
    const { result } = openInPractice()
    act(() => result.current.setScenery('passthrough'))

    playRound(result, 5, 3)
    expect(result.current.scenery).toBe('passthrough')

    act(() => result.current.resetGame())
    expect(result.current.scenery).toBe('passthrough')
  })

  it('the menu selector writes the scenery of the hall, with its values', () => {
    // A single preference, the same one the hall's panel shows: `passthrough` is saved
    // as `room`, which is what the hall and the other games understand.
    const { result } = openInPractice()

    act(() => result.current.setScenery('passthrough'))
    expect(window.localStorage.getItem(SCENERY_KEY)).toBe('room')
    expect(window.localStorage.getItem(OWN_SCENERY_KEY)).toBeNull()

    act(() => result.current.setScenery('scene'))
    expect(window.localStorage.getItem(SCENERY_KEY)).toBeNull()
  })

  it('what is chosen in the hall reaches the run without reloading', () => {
    const { result } = openInPractice()

    act(() => {
      window.localStorage.setItem(SCENERY_KEY, 'room')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current.scenery).toBe('passthrough')
  })

  it('the own key of the game does not rule and is deleted on mounting the run, without carrying it over', () => {
    // With passthrough saved in this cabinet's own key it cannot be left without a square:
    // what the hall says rules, and with nothing chosen there, the drawn place.
    window.localStorage.setItem(OWN_SCENERY_KEY, 'passthrough')

    const { result } = openInPractice()

    expect(result.current.scenery).toBe('scene')
    expect(window.localStorage.getItem(OWN_SCENERY_KEY)).toBeNull()
    expect(window.localStorage.getItem(SCENERY_KEY)).toBeNull()
  })
})

describe('silence', () => {
  // It is no longer a preference of the game: it comes from the effects volume that is
  // chosen in xrcade and holds for all twelve (see `settings.ts`). What is
  // checked here is that the store translates it well and that it finds out about the
  // changes, whether they come from the hall's menu or from another tab.
  it('starts with sound', () => {
    const { result } = openInPractice()
    expect(result.current.muted).toBe(false)
  })

  it('can be muted and turned back on', () => {
    const { result } = openInPractice()

    act(() => setVolume('sfx', 0))
    expect(result.current.muted).toBe(true)

    act(() => setVolume('sfx', DEFAULT_VOLUMES.sfx))
    expect(result.current.muted).toBe(false)
  })

  it('the choice survives the run', () => {
    // Muting is a preference of the player, not a setting of the round:
    // giving the sound back on starting or on returning to the menu would force turning it off
    // every time, which is exactly what annoys with the headset on.
    const { result } = openInPractice()
    act(() => setVolume('sfx', 0))

    playRound(result, 5, 3)
    expect(result.current.muted).toBe(true)

    act(() => result.current.resetGame())
    expect(result.current.muted).toBe(true)
  })

  it('the choice survives the visit', () => {
    // It is what it is saved for: in the headset, turning the sound off every time you
    // put the headset on is the most awkward gesture there is.
    const first = openInPractice()
    act(() => setVolume('sfx', 0))
    first.unmount()

    const { result } = openInPractice()
    expect(result.current.muted).toBe(true)
  })

  it('going back to sound is also remembered', () => {
    // The other side of the same deal: whoever turns it on does not find the game
    // muted again on the next visit.
    const first = openInPractice()
    act(() => setVolume('sfx', 0))
    act(() => setVolume('sfx', DEFAULT_VOLUMES.sfx))
    first.unmount()

    const { result } = openInPractice()
    expect(result.current.muted).toBe(false)
  })

  it('what another tab mutes is seen here', () => {
    // The browser tells, with the `storage` event, that another tab has written.
    // Without listening to it, muting in one would leave the other sounding.
    const { result } = openInPractice()

    act(() => {
      localStorage.setItem(VOLUME_KEYS.sfx, '0')
      window.dispatchEvent(new StorageEvent('storage', { key: VOLUME_KEYS.sfx }))
    })

    expect(result.current.muted).toBe(true)
  })
})

describe('hoop height', () => {
  it('with no headset and no saved correction, the hoop is where it always is', () => {
    const { result } = openInPractice()
    expect(result.current.hoopAdjustment).toBe(0)
    expect(result.current.hoopHeight).toBeCloseTo(MACHINE_HEIGHT, 6)
  })

  it('goes up and down in steps, and the hoop follows', () => {
    const { result } = openInPractice()

    act(() => result.current.adjustHoop(1))
    expect(result.current.hoopAdjustment).toBeCloseTo(HOOP_ADJUST_STEP, 6)
    expect(result.current.hoopHeight).toBeCloseTo(
      MACHINE_HEIGHT + HOOP_ADJUST_STEP,
      6,
    )

    act(() => result.current.adjustHoop(-2))
    expect(result.current.hoopAdjustment).toBeCloseTo(-HOOP_ADJUST_STEP, 6)
  })

  it('does not go past the limit however much one insists', () => {
    // It is the fence the brief asks for: from the menu the hoop cannot be left
    // either up in the clouds or inside the floor.
    const { result } = openInPractice()

    for (let i = 0; i < 20; i++) act(() => result.current.adjustHoop(1))
    expect(result.current.hoopAdjustment).toBeCloseTo(HOOP_ADJUST_RANGE, 6)

    for (let i = 0; i < 40; i++) act(() => result.current.adjustHoop(-1))
    expect(result.current.hoopAdjustment).toBeCloseTo(-HOOP_ADJUST_RANGE, 6)
  })

  it('the correction is saved and is still there on the next visit', () => {
    const { result, unmount } = openInPractice()
    act(() => result.current.adjustHoop(-2))
    const chosen = result.current.hoopAdjustment
    unmount()

    // Another visit: the store is born reading what was saved, without going through the menu.
    const { result: later } = openInPractice()
    expect(later.current.hoopAdjustment).toBeCloseTo(chosen, 6)
  })

  it('writes nothing when the press does not change the value', () => {
    // At the limit the button goes off, but a controller that insists cannot end up
    // writing to storage on every press.
    const { result } = openInPractice()
    for (let i = 0; i < 4; i++) act(() => result.current.adjustHoop(1))

    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    act(() => result.current.adjustHoop(1))
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

  it('the correction survives the run', () => {
    const { result } = openInPractice()
    act(() => result.current.adjustHoop(-1))
    const chosen = result.current.hoopAdjustment

    playRound(result, 5, 3)
    expect(result.current.hoopAdjustment).toBeCloseTo(chosen, 6)

    act(() => result.current.resetGame())
    expect(result.current.hoopAdjustment).toBeCloseTo(chosen, 6)
  })

  it('with the headset measuring, the hoop is set above the eyes of the player', () => {
    const { result } = openInPractice()

    act(() => result.current.setPlayerEyeHeight(1.2))
    const seated = result.current.hoopHeight
    expect(seated).toBeLessThan(MACHINE_HEIGHT)

    // And the manual correction is added to what was measured, it does not replace it.
    act(() => result.current.adjustHoop(1))
    expect(result.current.hoopHeight).toBeCloseTo(seated + HOOP_ADJUST_STEP, 6)
  })

  it('when the session closes the hoop goes back to its reference height', () => {
    // Outside the headset there is nobody to measure, and the measurement of the last session
    // says nothing about whoever plays next.
    const { result } = openInPractice()
    act(() => result.current.setPlayerEyeHeight(1.9))
    expect(result.current.hoopHeight).toBeGreaterThan(MACHINE_HEIGHT)

    act(() => result.current.setPlayerEyeHeight(null))
    expect(result.current.hoopHeight).toBeCloseTo(MACHINE_HEIGHT, 6)
  })

  it('the headset measurement stays in view, not only inside the hoop', () => {
    // The immersive UI also hangs from the player's eyes (see
    // `xrUiRise` in `xrLayout.ts`), so it needs the same datum.
    const { result } = openInPractice()
    expect(result.current.playerEyeHeight).toBeNull()

    act(() => result.current.setPlayerEyeHeight(1.2))
    expect(result.current.playerEyeHeight).toBe(1.2)

    act(() => result.current.setPlayerEyeHeight(null))
    expect(result.current.playerEyeHeight).toBeNull()
  })

  it('an impossible measurement from the headset does not move the hoop', () => {
    const { result } = openInPractice()
    act(() => result.current.setPlayerEyeHeight(Number.NaN))
    expect(result.current.hoopHeight).toBeCloseTo(MACHINE_HEIGHT, 6)
  })
})

describe('score and streak', () => {
  it('catching adds points; missing does not', () => {
    const { result } = openInPractice()
    startPlaying(result)

    act(() => result.current.catchStick(0.5))
    const afterCatch = result.current.points
    expect(afterCatch).toBeGreaterThan(0)

    act(() => result.current.missStick())
    expect(result.current.points).toBe(afterCatch)
  })

  it('catching it early scores more than rescuing it from the floor', () => {
    const early = openInPractice()
    startPlaying(early.result)
    act(() => early.result.current.catchStick(0))

    const late = openInPractice()
    startPlaying(late.result)
    act(() => late.result.current.catchStick(1))

    expect(early.result.current.points).toBeGreaterThan(late.result.current.points)
  })

  it('the same run pays more on a high difficulty', () => {
    const easy = openInPractice()
    startPlaying(easy.result)
    act(() => easy.result.current.catchStick(0.5))

    const hard = openInPractice()
    act(() => hard.result.current.setDifficulty('impossible'))
    startPlaying(hard.result)
    act(() => hard.result.current.catchStick(0.5))

    expect(hard.result.current.points).toBeGreaterThan(easy.result.current.points)
  })

  it('the streak grows on chaining and breaks on missing', () => {
    const { result } = openInPractice()
    act(() => result.current.setStickCount(9))
    startPlaying(result)

    act(() => result.current.catchStick(0.5))
    act(() => result.current.catchStick(0.5))
    expect(result.current.streak).toBe(2)

    act(() => result.current.missStick())
    expect(result.current.streak).toBe(0)

    act(() => result.current.catchStick(0.5))
    expect(result.current.streak).toBe(1)
  })

  it('keeps the best streak even if it breaks later', () => {
    const { result } = openInPractice()
    act(() => result.current.setStickCount(9))
    startPlaying(result)

    act(() => result.current.catchStick(0.5))
    act(() => result.current.catchStick(0.5))
    act(() => result.current.catchStick(0.5))
    act(() => result.current.missStick())

    expect(result.current.streak).toBe(0)
    expect(result.current.bestStreak).toBe(3)
  })

  it('two sticks caught in the same batch each score by their streak', () => {
    // The two XR controllers can resolve at once. If the streak were read from the
    // previous render, both would collect the same bonus and the second would come
    // cheap.
    const batched = openInPractice()
    act(() => batched.result.current.setStickCount(9))
    startPlaying(batched.result)
    act(() => {
      batched.result.current.catchStick(0.5)
      batched.result.current.catchStick(0.5)
    })

    const sequential = openInPractice()
    act(() => sequential.result.current.setStickCount(9))
    startPlaying(sequential.result)
    act(() => sequential.result.current.catchStick(0.5))
    act(() => sequential.result.current.catchStick(0.5))

    expect(batched.result.current.streak).toBe(2)
    expect(batched.result.current.points).toBe(sequential.result.current.points)
  })

  it('starting another run clears points and streak', () => {
    const { result } = openInPractice()
    playRound(result, 5, 5)
    expect(result.current.points).toBeGreaterThan(0)

    startPlaying(result)

    expect(result.current.points).toBe(0)
    expect(result.current.streak).toBe(0)
    expect(result.current.bestStreak).toBe(0)
  })
})

describe('best score', () => {
  it('starts with no record', () => {
    const { result } = openInPractice()
    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)
  })

  it('the best to beat does not move while playing', () => {
    // If the record were updated stick by stick, on finishing it would always be equal
    // to the points of the run and it could never be said that it has been beaten.
    const { result } = openInPractice()
    act(() => result.current.setStickCount(5))
    startPlaying(result)

    act(() => result.current.catchStick(0))

    expect(result.current.points).toBeGreaterThan(0)
    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)
  })

  it('on finishing, the score becomes the record', () => {
    const { result } = openInPractice()
    playRound(result, 5, 5)

    expect(result.current.bestPoints).toBe(result.current.points)
    expect(result.current.isRecord).toBe(true)
  })

  it('a worse run does not lower the record nor announce it', () => {
    const { result } = openInPractice()
    playRound(result, 5, 5)
    const record = result.current.bestPoints

    playRound(result, 5, 1)

    expect(result.current.points).toBeLessThan(record)
    expect(result.current.bestPoints).toBe(record)
    expect(result.current.isRecord).toBe(false)
  })

  it('the record survives returning to the menu and the next run', () => {
    const { result } = openInPractice()
    playRound(result, 5, 5)
    const record = result.current.bestPoints

    act(() => result.current.resetGame())
    expect(result.current.bestPoints).toBe(record)
    // And the announcement goes off: it belongs to the run that has just ended.
    expect(result.current.isRecord).toBe(false)

    startPlaying(result)
    expect(result.current.bestPoints).toBe(record)
  })

  it('a run catching nothing does not count as a record', () => {
    const { result } = openInPractice()
    playRound(result, 5, 0)

    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)
  })

  it('the record is still there on opening the game again', () => {
    // It is what separates "between runs" from "between visits": the second store
    // shares nothing with the first except the browser's storage.
    const first = openInPractice()
    playRound(first.result, 5, 5)
    const record = first.result.current.bestPoints
    expect(record).toBeGreaterThan(0)

    const reopened = openInPractice()

    expect(reopened.result.current.bestPoints).toBe(record)
    // Recovered, not just beaten: nobody has played yet on this visit.
    expect(reopened.result.current.isRecord).toBe(false)
  })

  it('without being able to save, a record that does not exist is not announced', () => {
    // Private mode: `localStorage` exists but throws on writing. There the best
    // to beat stays at zero forever, so without checking that the
    // record got saved every run with points would be a "new record".
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    const { result } = openInPractice()
    playRound(result, 5, 5)

    expect(result.current.points).toBeGreaterThan(0)
    expect(result.current.bestPoints).toBe(0)
    expect(result.current.isRecord).toBe(false)
  })

  it('does not announce a record if another tab saved something better while playing', () => {
    // The best to beat is frozen at the start, so a run can beat
    // that one and still fall short of what is saved. Announcing it would be
    // promising a record that the menu is going to deny as soon as it is returned to.
    const { result } = openInPractice()
    act(() => result.current.setStickCount(5))
    startPlaying(result)

    act(() => {
      localStorage.setItem(HIGH_SCORE_KEYS.practice, '999999')
      window.dispatchEvent(
        new StorageEvent('storage', { key: HIGH_SCORE_KEYS.practice }),
      )
    })
    for (let i = 0; i < 5; i++) act(() => result.current.catchStick(0.5))

    expect(result.current.points).toBeGreaterThan(0)
    expect(result.current.bestPoints).toBe(999999)
    expect(result.current.isRecord).toBe(false)
  })

  it('an unreadable record in the browser does not break the game', () => {
    localStorage.setItem('stick-rush:best-points', 'whatever')

    const { result } = openInPractice()

    expect(result.current.bestPoints).toBe(0)

    // And the first run leaves it properly written.
    playRound(result, 5, 5)
    expect(result.current.bestPoints).toBe(result.current.points)
  })
})

describe('back to the menu and rematch', () => {
  it('returns to the menu keeping the chosen configuration', () => {
    const { result } = openInPractice()
    act(() => result.current.setDifficulty('hard'))
    playRound(result, 6, 2)

    act(() => result.current.resetGame())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
    expect(result.current.stickCount).toBe(6)
    expect(result.current.difficulty).toBe('hard')
  })

  it('does not stay in "finished" on chaining another run', () => {
    const { result } = openInPractice()
    playRound(result, 5, 5)
    expect(result.current.gameState).toBe('finished')

    startPlaying(result)

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
  })

  it('does not count as finished a run that has not started', () => {
    const { result } = openInPractice()
    act(() => result.current.missStick())
    expect(result.current.gameState).toBe('menu')
  })
})

describe('endless practice', () => {
  it('on resolving the round the machine reloads instead of ending, and the player ends it', () => {
    const { result } = openInPractice()
    act(() => result.current.setEndless(true))
    act(() => result.current.setStickCount(5))
    startPlaying(result)
    const firstLayout = result.current.stickSeed

    for (let i = 0; i < 5; i++) act(() => result.current.catchStick(0.5))

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(5)
    // New round: new sticks, round counter at zero, the run's one goes on.
    expect(result.current.stickSeed).not.toBe(firstLayout)
    expect(result.current.waveResolved).toBe(0)
    expect(result.current.waveScore).toBe(0)

    act(() => result.current.catchStick(0.5))
    act(() => result.current.endRun())

    expect(result.current.gameState).toBe('finished')
    expect(result.current.outcome).toBe('cleared')
    // The best of this mode is the streak, not the points.
    expect(result.current.bestPoints).toBe(6)
    expect(result.current.isRecord).toBe(true)
    expect(localStorage.getItem(HIGH_SCORE_KEYS.practice)).toBeNull()
  })
})

describe('levels mode', () => {
  it('plays the highest unlocked level with its sticks and speed, with no lives', () => {
    const { result } = openInPractice()
    act(() => result.current.setGameMode('levels'))
    act(() => result.current.setDifficulty('impossible'))

    expect(result.current.activeLevel).toBe(1)
    expect(result.current.activeStickCount).toBe(5)
    expect(result.current.activeDifficulty).toBe('easy')
    expect(result.current.lives).toBeNull()
  })

  it('passing the level gives stars and unlocks the next, without moving the one played', () => {
    const { result } = openInPractice()
    act(() => result.current.setGameMode('levels'))
    startPlaying(result)

    for (let i = 0; i < 5; i++) act(() => (i < 4 ? result.current.catchStick(0.5) : result.current.missStick()))

    expect(result.current.gameState).toBe('finished')
    expect(result.current.levelResult).toEqual({ stars: 2, passed: true, unlocked: 2 })
    expect(result.current.unlockedLevel).toBe(2)
    expect(result.current.activeLevel).toBe(1)

    act(() => result.current.resetGame())
    expect(result.current.activeLevel).toBe(2)
    expect(result.current.activeStickCount).toBe(9)
  })

  it('not passing unlocks nothing, and nothing beyond what is unlocked can be chosen', () => {
    const { result } = openInPractice()
    act(() => result.current.setGameMode('levels'))
    act(() => result.current.setLevel(9))
    expect(result.current.activeLevel).toBe(1)
    startPlaying(result)

    for (let i = 0; i < 5; i++) act(() => result.current.missStick())

    expect(result.current.levelResult).toEqual({ stars: 0, passed: false, unlocked: null })
    expect(result.current.unlockedLevel).toBe(1)
    expect(result.current.isRecord).toBe(false)
  })
})

describe('finishing the tutorial when it is no longer there', () => {
  it('does nothing', () => {
    // The skip button and the tutorial's clock call the same thing: without this,
    // whichever arrives second would start another countdown mid-run.
    const { result } = openInPractice()

    act(() => result.current.finishTutorial())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.countdown).toBe(0)
  })
})

describe('using the store without having mounted it', () => {
  it('warns with a clear error instead of breaking somewhere else', () => {
    expect(() => renderHook(() => useGame())).toThrow(/GameProvider/)
  })
})

describe('choosing a level mid-run', () => {
  it('is not possible: the level played is the one from when it started', () => {
    // Changing it underneath would change the sticks and the speed mid-round.
    const { result } = openInPractice()
    act(() => result.current.setGameMode('levels'))
    act(() => result.current.startGame())
    const playing = result.current.activeLevel

    act(() => result.current.setLevel(1))

    expect(result.current.activeLevel).toBe(playing)
  })
})

/**
 * Leaving the run asks first.
 *
 * **It gets pressed by accident and what was done is lost.** With the headset on you cannot see what
 * is at your sides and the hand goes for the sticks. What keeps asking from being costly is that the
 * run stops: no stick falls while the question is on screen.
 */
describe('leaving the run', () => {
  it('asks instead of quitting', () => {
    const hook = openInPractice()
    act(() => hook.result.current.startGame())

    act(() => hook.result.current.askToQuit())

    expect(hook.result.current.prompt).toBe('quit')
    expect(hook.result.current.gameState).not.toBe('menu')
  })

  it('keep playing puts it back where it was', () => {
    const hook = openInPractice()
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.keepPlaying())

    expect(hook.result.current.prompt).toBeNull()
  })

  it('and confirming does quit', () => {
    const hook = openInPractice()
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.resetGame())

    expect(hook.result.current.prompt).toBeNull()
    expect(hook.result.current.gameState).toBe('menu')
  })

  it('starting another sweeps the question away', () => {
    const hook = openInPractice()
    act(() => hook.result.current.startGame())
    act(() => hook.result.current.askToQuit())

    act(() => hook.result.current.startGame())

    expect(hook.result.current.prompt).toBeNull()
  })
})

describe('the two-player match', () => {
  type Store = { current: ReturnType<typeof useGameStoreValue> }

  /** A whole round of the challenge: catches `catches` sticks and misses the rest, until it ends. */
  function oneRound(store: Store, catches: number) {
    startPlaying(store)
    for (let i = 0; i < CHALLENGE_SETUP.stickCount && store.current.gameState === 'playing'; i++) {
      act(() => {
        if (i < catches) store.current.catchStick(0.5)
        else store.current.missStick()
      })
    }
  }

  function twoPlayers(onFinish?: HallOptions['onFinish']) {
    const hook = renderHook(() => useGameStoreValue({ onFinish }))
    act(() => hook.result.current.setGameMode('challenge'))
    act(() => hook.result.current.setPlayers(2))
    return hook
  }

  it('alone, the challenge is the usual one: with no two-player match', () => {
    const { result } = openInPractice()
    act(() => result.current.setGameMode('challenge'))
    expect(result.current.players).toBe(1)
    startPlaying(result)
    expect(result.current.duel).toBeNull()
    expect(result.current.player).toBeNull()
  })

  it('two players outside the challenge does not count: it is played alone', () => {
    const { result } = openInPractice()
    act(() => result.current.setPlayers(2))
    startPlaying(result)
    expect(result.current.duel).toBeNull()
  })

  it('the first starts, and on finishing their round passes the controller to the second', () => {
    const { result } = twoPlayers()
    startPlaying(result)
    expect(result.current.player).toBe(0)

    for (let i = 0; i < CHALLENGE_SETUP.stickCount; i++) act(() => result.current.catchStick(0.5))
    const first = result.current.points
    expect(result.current.gameState).toBe('finished')
    // Their round is already recorded, and the controller is the second's.
    expect(result.current.duel?.points).toEqual([first, null])
    expect(result.current.player).toBe(1)
    expect(result.current.celebrates).toBe(false)
  })

  it('both play the same round: the same seed, the same sticks', () => {
    const { result } = twoPlayers()
    oneRound(result, 0)
    const seed = result.current.stickSeed
    const sticks = buildStickLayout(CHALLENGE_SETUP.stickCount, seed)

    startPlaying(result)
    expect(result.current.stickSeed).toBe(seed)
    expect(buildStickLayout(CHALLENGE_SETUP.stickCount, result.current.stickSeed)).toEqual(sticks)
    expect(result.current.player).toBe(1)
  })

  it('whoever scores more wins, it is recorded for the pair, it sounds like winning and does not touch the record', () => {
    const onFinish = vi.fn()
    const { result, rerender } = twoPlayers(onFinish)
    oneRound(result, 5)
    const first = result.current.points
    oneRound(result, 1)
    const second = result.current.points

    expect(first).toBeGreaterThan(second)
    expect(result.current.duel?.points).toEqual([first, second])
    expect(result.current.duelTally).toEqual({ wins: [1, 0], ties: 0 })
    expect(result.current.celebrates).toBe(true)
    expect(result.current.isRecord).toBe(false)
    expect(localStorage.getItem(HIGH_SCORE_KEYS.challenge)).toBeNull()
    // To the hall, the whole match and only once, even if it is painted again.
    rerender()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith({ mode: 'duel', points: first, challenge: false })
  })

  it('with the same points it is a tie', () => {
    const { result } = twoPlayers()
    oneRound(result, 0)
    oneRound(result, 0)
    expect(result.current.duel?.points).toEqual([0, 0])
    expect(result.current.duelTally).toEqual({ wins: [0, 0], ties: 1 })
  })

  it('again after a finished match another one starts, with another seed', () => {
    const { result } = twoPlayers()
    oneRound(result, 0)
    const seed = result.current.stickSeed
    oneRound(result, 0)
    startPlaying(result)
    expect(result.current.duel?.points).toEqual([null, null])
    expect(result.current.stickSeed).not.toBe(seed)
    expect(result.current.player).toBe(0)
  })

  it('returning to the menu drops the match: the next one starts from scratch', () => {
    const { result } = twoPlayers()
    oneRound(result, 0)
    act(() => result.current.resetGame())
    expect(result.current.duel).toBeNull()
    startPlaying(result)
    expect(result.current.duel?.points).toEqual([null, null])
  })

  it('switching to playing alone mid-match drops it', () => {
    const { result } = twoPlayers()
    oneRound(result, 0)
    act(() => result.current.setPlayers(1))
    startPlaying(result)
    expect(result.current.duel).toBeNull()
  })
})

describe('the feats', () => {
  type Store = { current: ReturnType<typeof useGameStoreValue> }

  function withCallback() {
    const onFinish = vi.fn()
    const hook = openInPractice({ onFinish })
    return { ...hook, onFinish }
  }

  /** What the hall was told the last time. */
  function last(onFinish: ReturnType<typeof vi.fn>) {
    return onFinish.mock.lastCall?.[0] as { feats?: readonly string[] } | undefined
  }

  function lowerHoopFully(store: Store) {
    for (let i = 0; i < 20; i++) act(() => store.current.adjustHoop(-1))
  }

  it('all thirteen of a round without any getting away: SR_CLEAN_SWEEP, only once', () => {
    const { result, onFinish } = withCallback()
    playRound(result, MAX_STICKS, MAX_STICKS)
    expect(last(onFinish)?.feats).toEqual([FEATS.cleanSweep])
    expect(JSON.parse(localStorage.getItem(FEATS_KEY)!)).toEqual([FEATS.cleanSweep])

    // The second time it was already there: the result is the usual one again.
    playRound(result, MAX_STICKS, MAX_STICKS)
    expect(onFinish).toHaveBeenCalledTimes(2)
    expect(last(onFinish)).not.toHaveProperty('feats')
  })

  it('twelve of thirteen do not give it', () => {
    const { result, onFinish } = withCallback()
    playRound(result, MAX_STICKS, MAX_STICKS - 1)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(last(onFinish)).not.toHaveProperty('feats')
  })

  it('in the challenge, the whole round without losing a life gives it; running out of lives does not', () => {
    const { result, onFinish } = withCallback()
    act(() => result.current.setGameMode('challenge'))
    startPlaying(result)
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    expect(result.current.gameState).toBe('finished')
    expect(last(onFinish)).not.toHaveProperty('feats')

    startPlaying(result)
    for (let i = 0; i < CHALLENGE_SETUP.stickCount; i++) act(() => result.current.catchStick(0.5))
    expect(last(onFinish)?.feats).toEqual([FEATS.cleanSweep])
  })

  it('with the hoop at the minimum, a clean round of five: SR_LOW_HOOP', () => {
    const { result, onFinish } = withCallback()
    lowerHoopFully(result)
    expect(result.current.hoopAdjustment).toBe(-HOOP_ADJUST_RANGE)
    playRound(result, 5, 5)
    expect(last(onFinish)?.feats).toEqual([FEATS.lowHoop])
  })

  it('with the hoop one step above the minimum no, nor at the minimum with one that got away', () => {
    const { result, onFinish } = withCallback()
    lowerHoopFully(result)
    act(() => result.current.adjustHoop(1))
    playRound(result, 5, 5)
    expect(last(onFinish)).not.toHaveProperty('feats')

    act(() => result.current.adjustHoop(-1))
    playRound(result, 5, 4)
    expect(last(onFinish)).not.toHaveProperty('feats')
  })

  it('a stick caught behind the back: SR_BEHIND_BACK', () => {
    const { result, onFinish } = withCallback()
    act(() => result.current.setStickCount(5))
    startPlaying(result)
    act(() => result.current.catchStick(0.5, true))
    for (let i = 0; i < 4; i++) act(() => result.current.missStick())
    expect(last(onFinish)?.feats).toEqual([FEATS.behindBack])
  })

  it('catching them all from the front does not give it', () => {
    const { result, onFinish } = withCallback()
    act(() => result.current.setStickCount(5))
    startPlaying(result)
    for (let i = 0; i < 5; i++) act(() => result.current.catchStick(0.5, false))
    expect(last(onFinish)).not.toHaveProperty('feats')
  })

  it('endless, it counts each round on reloading, and it is given on ending the run', () => {
    const { result, onFinish } = withCallback()
    act(() => result.current.setEndless(true))
    act(() => result.current.setStickCount(MAX_STICKS))
    startPlaying(result)
    for (let i = 0; i < MAX_STICKS; i++) act(() => result.current.catchStick(0.5))
    expect(result.current.wave).toBe(1)
    // The second round, halfway: it is not a round, but the first already counts.
    act(() => result.current.catchStick(0.5))
    act(() => result.current.endRun())
    expect(last(onFinish)?.feats).toEqual([FEATS.cleanSweep])
  })

  it('endless, the round with one that got away does not count', () => {
    const { result, onFinish } = withCallback()
    act(() => result.current.setEndless(true))
    act(() => result.current.setStickCount(MAX_STICKS))
    startPlaying(result)
    act(() => result.current.missStick())
    for (let i = 1; i < MAX_STICKS; i++) act(() => result.current.catchStick(0.5))
    expect(result.current.wave).toBe(1)
    act(() => result.current.endRun())
    expect(last(onFinish)).not.toHaveProperty('feats')
  })

  it('leaving the run halfway loses what was achieved in it', () => {
    const { result, onFinish } = withCallback()
    act(() => result.current.setStickCount(5))
    startPlaying(result)
    act(() => result.current.catchStick(0.5, true))
    act(() => result.current.resetGame())
    playRound(result, 5, 4)
    expect(last(onFinish)).not.toHaveProperty('feats')
    expect(localStorage.getItem(FEATS_KEY)).toBeNull()
  })

  it('with two players, what the first turn did is told to the hall when the second ends', () => {
    const { result, onFinish } = withCallback()
    act(() => result.current.setGameMode('challenge'))
    act(() => result.current.setPlayers(2))
    startPlaying(result)
    for (let i = 0; i < CHALLENGE_SETUP.stickCount; i++) act(() => result.current.catchStick(0.5))
    expect(onFinish).not.toHaveBeenCalled()

    startPlaying(result)
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(last(onFinish)).toMatchObject({ mode: 'duel', feats: [FEATS.cleanSweep] })

    // The next match starts from scratch: what the previous one did is not carried over.
    startPlaying(result)
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    startPlaying(result)
    act(() => result.current.catchStick(0.5, true))
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    expect(last(onFinish)).toMatchObject({ mode: 'duel', feats: [FEATS.behindBack] })
  })
})

describe('the goal sign', () => {
  /** The Stick Rush thresholds in the hall. */
  const GOAL: Goal = {
    medals: { bronze: 1900, silver: 3750, gold: 5200 },
    better: 'higher',
    unit: 'points in challenge',
    record: null,
    mode: 'challenge',
  }

  afterEach(() => {
    act(() => setLang('en'))
  })

  function withGoal(goal: Goal | undefined = GOAL) {
    return renderHook(() => useGameStoreValue({ goal }))
  }

  it('on finishing it compares with the earlier hall record, even if the hall already records the new best', () => {
    const withRecord = { ...GOAL, record: 0 }
    const hook = renderHook(({ goal }) => useGameStoreValue({ goal }), { initialProps: { goal: withRecord } })
    startPlaying(hook.result)
    act(() => hook.result.current.catchStick(0.5))
    for (let i = 0; i < 3; i++) act(() => hook.result.current.missStick())
    expect(hook.result.current.gameState).toBe('finished')
    const points = hook.result.current.points
    expect(points).toBeGreaterThan(0)
    // What the hall does on receiving the result: the goal comes back with the new best.
    hook.rerender({ goal: { ...withRecord, record: points } })

    expect(JSON.stringify(hook.result.current.sign)).toContain('New record!')
    expect(JSON.stringify(hook.result.current.sign)).not.toContain('matched')
  })

  it('in the menu there is no sign', () => {
    const { result } = withGoal()

    expect(result.current.sign).toBeNull()
    expect(result.current.signPhase).toBeNull()
    expect(result.current.medal).toBeNull()
  })

  it('on pressing Jugar without touching anything: the mission and the bronze in sticks, until the first stick', () => {
    const { result } = withGoal()
    act(() => result.current.startGame())

    expect(result.current.signPhase).toBe('before')
    // With no record, the first time: the bronze counted in sticks, which is what the mission counts.
    expect(result.current.sign).toMatchObject({
      title: 'Catch 13 sticks. Drop three and out',
      detail: 'Bronze ≈ 13 sticks · Gold 5,200',
    })

    runOutCountdown()
    expect(result.current.signPhase).toBe('before')

    act(() => result.current.missStick())
    expect(result.current.signPhase).toBe('playing')
    expect(result.current.sign).toMatchObject({ title: 'Bronze at 1,900 · you have 0', detail: 'Lives ♥♥♡ · Sticks 12' })
  })

  it('the medal goes up on crossing each threshold, with the points of the run', () => {
    const { result } = withGoal({ ...GOAL, medals: { bronze: 1, silver: 400, gold: 100000 } })
    startPlaying(result)
    expect(result.current.medal).toBeNull()

    act(() => result.current.catchStick(0.5))
    expect(result.current.points).toBeGreaterThan(0)
    expect(result.current.points).toBeLessThan(400)
    expect(result.current.medal).toBe('bronze')

    for (let i = 0; i < 3; i++) act(() => result.current.catchStick(0.5))
    expect(result.current.points).toBeGreaterThanOrEqual(400)
    expect(result.current.medal).toBe('silver')
    expect(result.current.sign?.title).toBe(
      `Gold at 100,000 · you have ${formatFigure(result.current.points, 'en')}`,
    )
  })

  it('on finishing it says what was achieved and what was missing, and another run starts again with the mission', () => {
    const { result } = withGoal()
    startPlaying(result)
    act(() => result.current.catchStick(0.5))
    const points = result.current.points
    for (let i = 0; i < 3; i++) act(() => result.current.missStick())

    expect(result.current.gameState).toBe('finished')
    expect(result.current.signPhase).toBe('end')
    expect(result.current.sign).toMatchObject({
      title: `No medal · ${points} points in challenge`,
      detail: `${formatFigure(1900 - points, 'en')} short of bronze`,
    })

    // «Otra»: repeating the challenge without going through the menu.
    act(() => result.current.startGame())
    expect(result.current.gameMode).toBe('challenge')
    expect(result.current.signPhase).toBe('before')
    expect(result.current.medal).toBeNull()
  })

  it('it is said in the language of whoever plays', () => {
    const { result } = withGoal()
    act(() => setLang('es'))
    act(() => result.current.startGame())

    expect(result.current.sign).toMatchObject({
      title: 'Atrapa 13 palos. Tres al suelo y fuera',
      detail: 'Bronce ≈ 13 palos · Oro 5200',
    })
  })

  it('in practice, inside the hall, it says it does not count and keeps no tally', () => {
    const { result } = withGoal()
    act(() => result.current.setGameMode('practice'))
    startPlaying(result)

    expect(result.current.sign).toMatchObject({ title: 'Practice · does not count for a medal', subdued: true })
    expect(result.current.signPhase).toBeNull()
    expect(result.current.medal).toBeNull()
  })

  it('with two players it does not count either, and when the round ends the sign is removed', () => {
    const { result } = withGoal()
    act(() => result.current.setPlayers(2))
    startPlaying(result)

    expect(result.current.sign?.title).toBe('Duel · does not count for a medal')
    expect(result.current.signPhase).toBeNull()

    for (let i = 0; i < 3; i++) act(() => result.current.missStick())
    expect(result.current.gameState).toBe('finished')
    expect(result.current.sign).toBeNull()
  })

  it('with the game opened on its own: the mission and the record saved here, and outside the challenge nothing', () => {
    localStorage.setItem(HIGH_SCORE_KEYS.challenge, '3100')
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame())

    expect(result.current.sign).toMatchObject({
      title: 'Catch 13 sticks. Drop three and out',
      detail: 'Your record 3,100',
    })
    expect(result.current.medal).toBeNull()

    act(() => result.current.resetGame())
    act(() => result.current.setGameMode('practice'))
    startPlaying(result)
    expect(result.current.sign).toBeNull()
  })

  it('with the challenge of the hall it starts already with the mission in front', () => {
    const { result } = renderHook(() => useGameStoreValue({ challenge: { seed: 7 }, goal: GOAL }))

    expect(result.current.gameState).toBe('countdown')
    expect(result.current.signPhase).toBe('before')
    expect(result.current.sign?.detail).toBe('Bronze ≈ 13 sticks · Gold 5,200')
  })
})

describe('the hook of the shared e2e (`testRun.ts`)', () => {
  /** The trial thresholds of the e2e: the bronze at 10, with no record. */
  const TRIAL: Goal = {
    medals: { bronze: 10, silver: 20, gold: 30 },
    better: 'higher',
    unit: 'points in challenge',
    record: null,
    mode: 'challenge',
  }

  // The scenes of the earlier tests are still mounted: with the hook requested, they would also be exposed.
  beforeEach(() => cleanup())
  afterEach(() => {
    delete window.__runStickRush
  })

  it('without asking for it nothing is left', () => {
    renderHook(() => useGameStoreValue({ goal: TRIAL }))
    expect(window.__runStickRush).toBeUndefined()
  })

  it('starts the challenge with no countdown, sets its points, crosses the bronze and ends it telling the hall', () => {
    window.__runStickRush = {}
    const onFinish = vi.fn()
    const { result } = renderHook(() => useGameStoreValue({ goal: TRIAL, onFinish }))
    const run = window.__runStickRush!

    expect(run.sign!()).toBeNull()
    act(() => run.start!())
    expect([result.current.gameState, result.current.gameMode, result.current.teaching]).toEqual(['playing', 'challenge', false])
    expect(run.sign!()?.detail).toBe('Bronze 10 · Silver 20 · Gold 30')

    act(() => run.score!(1))
    expect(run.sign!()?.title).toBe('Bronze at 10 · you have 1')
    act(() => run.score!(10))
    expect(run.sign!()?.cheer).toBe('Bronze!')
    expect(result.current.resolved).toBe(1)

    act(() => run.end!())
    expect(result.current.gameState).toBe('finished')
    expect(result.current.outcome).toBe('cleared')
    expect(run.sign!()?.title).toBe('Bronze · 10 points in challenge')
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ mode: 'challenge', points: 10 }))
  })
})
