import { gameStorage } from './storage'
import type { TextKey } from './textos'

/**
 * The tutorial that is seen inside the headset the first time.
 *
 * **The problem it solves.** With the headset on, whoever arrives new does not know that the
 * sticks are grabbed: the immersive menu is operated with the controller's ray, so the first
 * thing they learn is exactly what is **not** useful for playing —pointing from afar catches
 * nothing (see `xrInteraction.ts`)—.
 *
 * **And how it was solved badly.** It was a slideshow on a clock, with the run on
 * hold: three stretches —a controller with a stick falling on it, how many sticks were coming
 * and at which level— and when the seconds ran out it was taken as learned. Whoever watched it
 * without doing anything came out the same as they went in, and as a bonus it was the only one in
 * the fleet with a tutorial of its own: two different panels to maintain and, the day of porting
 * it to Godot, two ports.
 *
 * **How it is solved now: by milestones.** Each step is passed **by catching a stick**. The
 * run does not stop —the sticks fall while it is explained—, and the panel waits for what has
 * to happen to happen instead of counting seconds. Each step also carries a **safety
 * deadline** in case someone stays watching: it passes by itself, because a step that is not
 * achieved would leave someone locked in it. And there is always a way out at hand: next and skip.
 *
 * Only the script lives here —which steps there are, what passes them, how long they wait and
 * whether it has already been seen—, with no three nor React, to be able to test it with no
 * browser nor headset.
 */

/** What each step teaches, and what has to be done to pass it. */
export type TutorialStepKey =
  /** Closing the hand on a stick: it is passed on catching the first one. */
  | 'grab'
  /** That they fall everywhere: it is passed on catching another, which forces looking for it. */
  | 'around'

/** The steps, in order. */
export const TUTORIAL_STEPS: readonly TutorialStepKey[] = ['grab', 'around']

/**
 * Which button of the controller each step teaches, to draw it highlighted.
 *
 * **It is half of the lesson.** A phrase that says «el botón de agarre» is only useful to whoever
 * already knows which one it is; with the headset on, what is in the hand is a controller with
 * five buttons and none with its name written on it. `null` is a step that is not about squeezing anything.
 */
export type ControllerButton = 'agarre' | 'gatillo'

export const TUTORIAL_BUTTONS: Record<TutorialStepKey, ControllerButton | null> = {
  grab: 'agarre',
  // The second step does not teach another button: it is the same gesture, looking elsewhere.
  // Repeating the mark on the controller here would turn it into decoration, and on the way it
  // would cover the stick that has to be looked for right when it is time to look for it.
  around: null,
}

/**
 * What WebXR calls each of those buttons.
 *
 * It is the bridge between the everyday name —the one used when writing the lesson— and the
 * identifier of the controller profile, which is the one the part is found with inside the
 * 3D model when the tutorial shows it at real size on the hand (`RealController.tsx`).
 * The two names are those of the standard and work for any controller, not only for those of
 * Quest.
 */
export const COMPONENTE_DEL_BOTON: Record<ControllerButton, string> = {
  agarre: 'xr-standard-squeeze',
  gatillo: 'xr-standard-trigger',
}

/**
 * What is asked for in each step, with a controller in the hand.
 *
 * The phrases live here and not in the panel that draws them because **two places show them**:
 * the headset's panel and its reflection in the overlay, which is DOM and cannot import anything
 * from three. A game with a single screen would have them next to the drawing, like the rest of
 * the fleet.
 */
export const PHRASES: Record<TutorialStepKey, TextKey> = {
  grab: 'Hold the grip button on a stick, do not point at it',
  around: 'They fall all around you: turn and catch another one',
}

/**
 * And what is asked for **with bare hands**, which is how it can also be played.
 *
 * There is no button to squeeze there: the grab pointer is moved by the pinch (see
 * `xrInteraction.ts`). The tutorial is the only screen that explains the gesture, so
 * naming a button to whoever has no controller would be explaining the game to them backwards.
 */
export const PHRASES_WITH_HANDS: Record<TutorialStepKey, TextKey> = {
  grab: 'Pinch your fingers on a stick, do not point at it',
  around: 'They fall all around you: turn and catch another one',
}

/**
 * How many sticks have to be caught so far to take each step as done.
 *
 * The milestone is **catching**, which is the only thing the game asks to learn, and it is
 * counted accumulated from the start of the run: that way the second step cannot be met with the
 * same stick that met the first.
 */
export const STEP_STICKS: Record<TutorialStepKey, number> = {
  grab: 1,
  around: 2,
}

/**
 * How long each step waits before passing by itself, in seconds.
 *
 * It is a net, not a clock: the normal thing is that the step is passed by catching long before.
 * It exists because the milestone may never arrive —whoever stays reading the panel, or whoever
 * misses the sticks one after another— and the panel would stay in front of the face the whole run.
 *
 * The first one waits longer: it is the one that teaches the gesture, and before being able to do
 * it one has to wait for a stick to fall.
 */
export const STEP_DEADLINE: Record<TutorialStepKey, number> = {
  grab: 12,
  around: 8,
}

/** The minimum so that a step does not slip away before one has been able to try it. */
export const TUTORIAL_MIN_SECONDS = 12
/** The maximum the lesson can take up of a run if nobody catches anything. */
export const TUTORIAL_MAX_SECONDS = 25

/**
 * How long the lesson lasts in the worst case: without catching a single stick, from deadline to deadline.
 *
 * Bounded between the minimum and the maximum by a test, so lengthening one step forces shortening
 * another.
 */
export const TUTORIAL_SECONDS = TUTORIAL_STEPS.reduce(
  (total, step) => total + STEP_DEADLINE[step],
  0,
)

/**
 * What whoever plays has already done. It **accumulates**: doing something is not undone.
 *
 * It is deduced from what the run already counts —how many sticks have been caught— instead of
 * being noted down apart: a tutorial that keeps its own count ends up disagreeing with what happens
 * in the scene, and here what rules is what happens in the scene.
 */
export type TutorialMilestones = Readonly<Record<TutorialStepKey, boolean>>

/** Nothing done yet. */
export const NO_MILESTONES: TutorialMilestones = { grab: false, around: false }

/**
 * The milestones that are deduced from the sticks caught so far.
 *
 * The count comes from the run, not from outside, but it is sanitised all the same: a `NaN` that
 * slipped in here would leave the two steps unmet forever and the panel up until both deadlines
 * ran out.
 */
export function milestonesFromCatches(caught: number): TutorialMilestones {
  const caughtCount = Number.isFinite(caught) ? Math.floor(caught) : 0
  return {
    grab: caughtCount >= STEP_STICKS.grab,
    around: caughtCount >= STEP_STICKS.around,
  }
}

/**
 * Which step is to be shown, or `null` if nothing is left.
 *
 * The first one that is not done, skipping the ones that have been taken as passed with the button
 * or by deadline. It is **computed** instead of being stored, for the same reason as the milestones.
 *
 * @param skipped How many steps have been taken as passed without having done them.
 */
export function tutorialStep(milestones: TutorialMilestones, skipped: number): TutorialStepKey | null {
  for (let i = Math.max(0, skipped); i < TUTORIAL_STEPS.length; i += 1) {
    const step = TUTORIAL_STEPS[i]
    if (!milestones[step]) return step
  }
  return null
}

/**
 * Taking the step being shown as passed: where to keep looking from.
 *
 * **The position of the step** is noted down, not «one more than there were»: with a milestone
 * already met ahead, adding one to the count can leave the same step on screen, and then neither
 * the next button nor the deadline would do anything. And it never goes back: what was taken as
 * passed does not return.
 */
export function skipStep(skipped: number, step: TutorialStepKey): number {
  return Math.max(skipped, TUTORIAL_STEPS.indexOf(step) + 1)
}

/**
 * Where it is remembered that the tutorial has already been seen. With a prefix, like the record
 * and the height of the hoop, so as not to clash with anything else of the same origin.
 */
export const TUTORIAL_SEEN_KEY = 'stick-rush:tutorial-seen'

/**
 * What is stored as «already seen»: **the version of the lesson**, not a yes.
 *
 * Any other value shows it again, so raising this number is the way for whoever already saw it to
 * see it again when what it teaches has changed. Version 1 was the demonstration on a clock, with
 * the run waiting and a fake controller catching a fake stick; version **2** is this one, which is
 * done by playing and is passed by catching real sticks. Whoever saw version 1 has not done this one.
 */
export const TUTORIAL_SEEN_VALUE = '2'

/**
 * Has the lesson already been seen?
 *
 * What is read is external input —anyone can edit it from the browser's tools—, so only the exact
 * value counts as seen: anything else shows it again, which is the safe side. Showing it too often
 * costs a skippable panel; not showing it leaves someone not knowing how to play.
 */
export function tutorialSeen(storage: Pick<Storage, 'getItem'> | null = gameStorage()): boolean {
  if (storage === null) return false
  try {
    return storage.getItem(TUTORIAL_SEEN_KEY) === TUTORIAL_SEEN_VALUE
  } catch {
    // Storage cut off: it is shown again. Seeing too much is better than not understanding.
    return false
  }
}

/**
 * Leaves a record that it has already been seen.
 *
 * @returns whether it was stored. A `false` is not an error: it means that this browser stores
 *   nothing and the lesson will be seen next time too.
 */
export function markTutorialSeen(storage: Storage | null = gameStorage()): boolean {
  if (storage === null) return false
  try {
    storage.setItem(TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE)
    return true
  } catch {
    return false
  }
}
