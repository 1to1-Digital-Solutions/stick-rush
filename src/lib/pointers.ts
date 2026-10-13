/**
 * Who keeps the controller's ray when it points at several things at once.
 *
 * The headset's pointer system (`@pmndrs/pointer-events`) gives each ray **to the nearest
 * hit** and stops there: what is behind does not find out. And **it does not look at whether
 * something is seen**: the word `visible` does not appear in the whole library, because the ray
 * is resolved by three's raycaster, to which visibility says nothing either.
 *
 * Here that matters more than in any other game, because **whoever plays is inside the
 * machine**: the sticks hang in an arc 57 cm around, and the menu is planted 95 cm in front
 * of the face. That is, between the hand and any button there are always sticks. Reported with
 * the headset on: «sometimes when selecting the config menu it is as if there were an object in
 * front of me and the cursor gets cut off. It is an invisible object I cannot see and it does
 * not let me select the option I want». The invisible object is a stick already caught: on
 * catching it, it is switched off with `visible` —it is not unmounted, so as not to throw away
 * its material and recompile it— and it keeps listening to pointers as if nothing had happened.
 *
 * Three rules, and all three are read in their place:
 *
 * - **The scenery is not there for the ray.** The machine, the floor, the square and the
 *   curtain of the scenery change listen to nothing, and with the library as is they do not get
 *   in the way; but it is enough for a host to put a listener above —the hall, a group that
 *   collects clicks— for everything hanging from it to count as touched. Declared on the world,
 *   it does not depend on who mounts the game.
 * - **Nor is a stick that cannot be caught right now.** The sticks always listen, because they
 *   are the same during the run and outside it; outside they only cover buttons. And the one
 *   already caught is not even seen. `auto` is said instead of staying silent, because the world
 *   they hang from is already denied: what is needed is **to switch it back on** for the stick
 *   that can indeed be caught.
 * - **With the ui in front, the ui wins.** Even if there is a stick in the way that can indeed
 *   be caught —the exit question comes up in the middle of a run—, the button takes the ray. It
 *   is an order and not a distance: the library looks at `pointerEventsOrder` first and only on
 *   a tie at the distance.
 */

/** The order of the immersive ui against the rest of the scene, which goes at 0. */
export const MENU_POINTER_ORDER = 1

/** What the world —machine, floor, scenery and curtain— declares to the pointers: that it is not there. */
export const DECOR_POINTER_EVENTS = 'none' as const

/**
 * Whether a stick is there for the ray: only when it can be caught.
 *
 * `auto` and not `undefined` because it inherits the world's `none`: without switching it back
 * on explicitly, not a single one could be caught.
 */
export function stickPointerEvents(catchable: boolean): 'auto' | 'none' {
  return catchable ? 'auto' : 'none'
}
