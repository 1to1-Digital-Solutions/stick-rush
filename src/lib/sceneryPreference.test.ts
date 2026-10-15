import { afterEach, describe, expect, it } from 'vitest'

import { SCENERIES, readScenery } from './settings'
import { OWN_SCENERY_KEY, forgetOwnScenery, sceneryModeOf, sceneryOf } from './sceneryPreference'

/**
 * The hall's scenery seen from Stick Rush (`sceneryPreference.ts`).
 *
 * The preference and the rule of the scenery are tested with the bridge (`settings.test.ts` and
 * `settingsClient.test.tsx`). What is left here is what belongs to this game: the translation to
 * `scene` and `passthrough`, and that the game's own key does not rule and disappears.
 */

afterEach(() => {
  window.localStorage.clear()
})

describe('the translation at the edge', () => {
  it('the drawn place of the hall is the square, and the room is the passthrough', () => {
    expect(sceneryModeOf('place')).toBe('scene')
    expect(sceneryModeOf('room')).toBe('passthrough')
  })

  it('goes and comes back without losing anything', () => {
    for (const scenery of SCENERIES) expect(sceneryOf(sceneryModeOf(scenery))).toBe(scenery)
  })

  it('what the menu of the game chooses is written with the values of the hall', () => {
    // Written by hand: if `passthrough` were written in the hall's key, the hall would read it
    // as rubbish and go back to the drawn place.
    expect(sceneryOf('scene')).toBe('place')
    expect(sceneryOf('passthrough')).toBe('room')
  })
})

describe('the own key of the game', () => {
  it('is the one of the game, written by hand', () => {
    // If it drifted, the real one would stay unerased and one that does not exist would be erased.
    expect(OWN_SCENERY_KEY).toBe('stick-rush:scenery')
  })

  it('does not rule: with it on passthrough and the one of the hall unset, the square is seen', () => {
    window.localStorage.setItem(OWN_SCENERY_KEY, 'passthrough')

    expect(sceneryModeOf(readScenery(window.localStorage))).toBe('scene')
  })

  it('is erased without carrying it over to the one of the hall', () => {
    window.localStorage.setItem(OWN_SCENERY_KEY, 'passthrough')

    forgetOwnScenery(window.localStorage)

    expect(window.localStorage.getItem(OWN_SCENERY_KEY)).toBeNull()
    expect(window.localStorage.getItem('xrcade:scenery')).toBeNull()
  })

  it('does not touch what was chosen in the hall', () => {
    window.localStorage.setItem('xrcade:scenery', 'room')

    forgetOwnScenery(window.localStorage)

    expect(readScenery(window.localStorage)).toBe('room')
  })

  it('with no storage, or with one that throws, it does not blow up', () => {
    const broken = {
      removeItem() {
        throw new Error('blocked')
      },
    }

    expect(() => forgetOwnScenery(null)).not.toThrow()
    expect(() => forgetOwnScenery(broken)).not.toThrow()
  })
})
