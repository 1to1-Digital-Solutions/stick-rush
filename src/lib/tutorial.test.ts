import { beforeEach, describe, expect, it } from 'vitest'

import {
  COMPONENTE_DEL_BOTON,
  PHRASES,
  PHRASES_WITH_HANDS,
  milestonesFromCatches,
  markTutorialSeen,
  STEP_STICKS,
  STEP_DEADLINE,
  skipStep,
  NO_MILESTONES,
  TUTORIAL_BUTTONS,
  TUTORIAL_MAX_SECONDS,
  TUTORIAL_MIN_SECONDS,
  TUTORIAL_SECONDS,
  TUTORIAL_SEEN_KEY,
  TUTORIAL_SEEN_VALUE,
  TUTORIAL_STEPS,
  tutorialSeen,
  tutorialStep,
} from './tutorial'

/**
 * The script of the tutorial, tested with no browser nor headset.
 *
 * What is checked here is what is not seen by looking at the panel: that the steps are passed
 * **by doing** —catching real sticks, with the count the run keeps—, that none
 * can lock anyone in, and that a cut-off storage shows the lesson again instead
 * of breaking.
 */

/** Fake storage, with just what the tutorial uses. */
function fakeStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(TUTORIAL_SEEN_KEY, initial)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  } as unknown as Storage
}

/** The one browsers have in private mode: it throws instead of failing. */
function blockedStorage(): Storage {
  return {
    getItem: () => {
      throw new DOMException('blocked', 'SecurityError')
    },
    setItem: () => {
      throw new DOMException('quota exhausted', 'QuotaExceededError')
    },
  } as unknown as Storage
}

describe('the lesson fits in a run', () => {
  it('lasts between the minimum and the maximum even if nothing is caught', () => {
    // `TUTORIAL_SECONDS` is the worst case: from deadline to deadline, without a single stick
    // caught. Being bounded here, lengthening one step forces shortening another.
    expect(TUTORIAL_SECONDS).toBeGreaterThanOrEqual(TUTORIAL_MIN_SECONDS)
    expect(TUTORIAL_SECONDS).toBeLessThanOrEqual(TUTORIAL_MAX_SECONDS)
  })

  it('teaches catching and looking around, in that order', () => {
    expect([...TUTORIAL_STEPS]).toEqual(['grab', 'around'])
  })

  it('no step slips away before one has been able to try it', () => {
    for (const step of TUTORIAL_STEPS) {
      // The deadline is a net, not a clock: below a few seconds it would go by like a
      // blink and nobody would get to do what it asks.
      expect(STEP_DEADLINE[step], step).toBeGreaterThanOrEqual(5)
    }
    // The first one waits longer: before being able to catch one has to wait for a stick to fall.
    expect(STEP_DEADLINE.grab).toBeGreaterThan(STEP_DEADLINE.around)
  })

  it('and each step asks for one stick more than the previous one', () => {
    // If the second one settled for the same sticks as the first, it would be met with the
    // stick that already met the first and nobody would get to turn round.
    const sticks = TUTORIAL_STEPS.map((step) => STEP_STICKS[step])
    for (let i = 1; i < sticks.length; i += 1) expect(sticks[i]).toBeGreaterThan(sticks[i - 1])
  })
})

describe('what is shown with each step', () => {
  it('the first asks for the grip and the second asks for no button', () => {
    // The second is the same gesture looking elsewhere: repeating the mark on the controller
    // would turn it into decoration and would cover the stick that has to be looked for.
    expect(TUTORIAL_BUTTONS.grab).toBe('agarre')
    expect(TUTORIAL_BUTTONS.around).toBeNull()
  })

  it('the buttons that are named are those of the WebXR standard', () => {
    // It is what allows finding the part inside the model of whichever controller is in use,
    // whatever it is: a Quest name would not work for the others.
    for (const button of Object.values(TUTORIAL_BUTTONS)) {
      if (button == null) continue
      expect(COMPONENTE_DEL_BOTON[button], button).toMatch(/^xr-standard-/)
    }
  })

  it('there is a phrase for each step, with a controller and with bare hands', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(PHRASES[step], step).toBeTruthy()
      expect(PHRASES_WITH_HANDS[step], step).toBeTruthy()
    }
  })

  it('and whoever has no controller is not told the name of a button', () => {
    // Naming the grip to whoever plays with their hands would be explaining the game to them
    // backwards: there the pointer is moved by the pinch.
    expect(PHRASES_WITH_HANDS.grab).not.toBe(PHRASES.grab)
    expect(PHRASES.grab.toLowerCase()).toContain('grip button')
    expect(PHRASES_WITH_HANDS.grab.toLowerCase()).not.toContain('button')
    // The one about turning round is done the same with a controller or without it.
    expect(PHRASES_WITH_HANDS.around).toBe(PHRASES.around)
  })
})

describe('the milestones come from what the run has caught so far', () => {
  it('without catching anything none is done', () => {
    expect(milestonesFromCatches(0)).toEqual(NO_MILESTONES)
  })

  it('the first stick gives the first step, and the second gives the second', () => {
    expect(milestonesFromCatches(1)).toEqual({ grab: true, around: false })
    expect(milestonesFromCatches(2)).toEqual({ grab: true, around: true })
  })

  it('they are not undone: more sticks do not take away what was done', () => {
    expect(milestonesFromCatches(37)).toEqual({ grab: true, around: true })
  })

  it('a broken count is counted as zero instead of jamming the panel', () => {
    // A `NaN` slipped in here would leave the two steps unmet forever and the panel up
    // until both deadlines ran out.
    expect(milestonesFromCatches(Number.NaN)).toEqual(NO_MILESTONES)
    expect(milestonesFromCatches(Number.POSITIVE_INFINITY)).toEqual(NO_MILESTONES)
    expect(milestonesFromCatches(1.9)).toEqual({ grab: true, around: false })
  })
})

describe('which step is to be shown', () => {
  it('the first one that is not done', () => {
    expect(tutorialStep(NO_MILESTONES, 0)).toBe('grab')
    expect(tutorialStep(milestonesFromCatches(1), 0)).toBe('around')
  })

  it('and nothing when all of them are', () => {
    expect(tutorialStep(milestonesFromCatches(2), 0)).toBeNull()
  })

  it('the ones taken as passed do not return, even if they were not done', () => {
    expect(tutorialStep(NO_MILESTONES, 1)).toBe('around')
    expect(tutorialStep(NO_MILESTONES, 2)).toBeNull()
  })

  it('a count of skipped ones below zero does not revive steps', () => {
    expect(tutorialStep(NO_MILESTONES, -3)).toBe('grab')
  })
})

describe('taking a step as passed', () => {
  it('notes down its position, not one more than there were', () => {
    // With a milestone already met ahead, adding one to the count can leave the same step on
    // screen: neither the next button nor the deadline would do anything.
    expect(skipStep(0, 'around')).toBe(2)
    expect(tutorialStep(NO_MILESTONES, skipStep(0, 'around'))).toBeNull()
  })

  it('and it never goes back', () => {
    expect(skipStep(2, 'grab')).toBe(2)
  })

  it('skipping the first leaves the second on screen', () => {
    expect(tutorialStep(NO_MILESTONES, skipStep(0, 'grab'))).toBe('around')
  })
})

describe('remembering that it has already been seen', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('only the exact value counts as seen', () => {
    expect(tutorialSeen(fakeStorage(TUTORIAL_SEEN_VALUE))).toBe(true)
    expect(tutorialSeen(fakeStorage())).toBe(false)
  })

  it('whoever saw the old lesson sees it again', () => {
    // What is stored is the version of the lesson: version 1 was the demonstration on a clock
    // and was not done by playing, so whoever saw it has not done this one.
    expect(TUTORIAL_SEEN_VALUE).not.toBe('1')
    expect(tutorialSeen(fakeStorage('1'))).toBe(false)
  })

  it('anything edited by hand shows it again', () => {
    // It is external input: the safe side is chosen, which is showing it too often.
    expect(tutorialSeen(fakeStorage('yes'))).toBe(false)
  })

  it('with no storage, and with the storage cut off, it is shown again', () => {
    expect(tutorialSeen(null)).toBe(false)
    expect(tutorialSeen(blockedStorage())).toBe(false)
  })

  it('leaves a record, and then it is read', () => {
    const storage = fakeStorage()
    expect(markTutorialSeen(storage)).toBe(true)
    expect(storage.getItem(TUTORIAL_SEEN_KEY)).toBe(TUTORIAL_SEEN_VALUE)
    expect(tutorialSeen(storage)).toBe(true)
  })

  it('and not being able to store it is not an error: it will be seen next time too', () => {
    expect(markTutorialSeen(null)).toBe(false)
    expect(markTutorialSeen(blockedStorage())).toBe(false)
  })

  it('without saying in which one, it uses the one of the browser', () => {
    // It is the real path: the game calls both with no argument.
    expect(tutorialSeen()).toBe(false)
    expect(markTutorialSeen()).toBe(true)
    expect(window.localStorage.getItem(TUTORIAL_SEEN_KEY)).toBe(TUTORIAL_SEEN_VALUE)
    expect(tutorialSeen()).toBe(true)
  })

  it('the key carries the prefix of the game, so as not to clash with anything of the same origin', () => {
    expect(TUTORIAL_SEEN_KEY).toMatch(/^stick-rush:/)
  })
})
