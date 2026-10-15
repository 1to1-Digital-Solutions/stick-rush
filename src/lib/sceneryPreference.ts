import type { Scenery } from './settings'
// Only the type: it is erased on compiling, so it creates no real cycle with the store even
// though the store imports from here.
import type { SceneryMode } from './gameStore'

/**
 * The hall's scenery, translated to what this game calls it.
 *
 * **The preference does not belong to this game.** It is stored in `xrcade:scenery`, with the
 * hall's values (`place` and `room`), and the rule of when the scenery is removed is `showsPlace`:
 * both in `lib/settings.ts`, the copy of the bridge with the hall; the hook and the change are in
 * `lib/settingsClient.ts`. Stick Rush calls the same thing `scene` and `passthrough` in all its
 * code —the store, the fade, the menu's selector—, so the translation is done here, at
 * the edge, and the rest of the game does not find out that the value comes from elsewhere.
 *
 * **Why it has none of its own.** The hall always enters `immersive-ar` when the headset has
 * it, so the session type does not say what whoever plays chose. With one scenery per game,
 * whoever chose «passthrough» in this cabinet would come in with no square even if in the hall
 * they had chosen the drawn place, and there would be no way of knowing which of the two rules.
 */

/** What this game calls the hall's scenery: `place` is the square, `room` the room. */
export function sceneryModeOf(scenery: Scenery): SceneryMode {
  return scenery === 'room' ? 'passthrough' : 'scene'
}

/** What is written in the hall when it is chosen from this game. */
export function sceneryOf(mode: SceneryMode): Scenery {
  return mode === 'passthrough' ? 'room' : 'place'
}

/**
 * The key of the game's own scenery, which nobody writes.
 *
 * If it is in the browser, it is erased when the run's state is mounted and **it is not carried
 * over** to the hall's: the choice that rules is the hall's. Leaving it would break nothing
 * —nobody reads it—, but erasing it keeps whoever looks at the storage from believing there are
 * two preferences.
 */
export const OWN_SCENERY_KEY = 'stick-rush:scenery'

/**
 * Forgets the game's own scenery.
 *
 * It withstands a storage that is not there or that throws: there is nothing to forget, and the
 * game carries on with the hall's.
 */
export function forgetOwnScenery(storage: Pick<Storage, 'removeItem'> | null): void {
  try {
    storage?.removeItem(OWN_SCENERY_KEY)
  } catch {
    // Storage cut off: nothing could be stored under that key either.
  }
}
