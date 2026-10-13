import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { openGame, startGame } from './helpers'
import { PIECES as KIT_PIECES } from '../src/lib/fairKit'
import { MAX_STICKS } from '../src/lib/gameConfig'
import { drawCallBudget } from './support/budget'

/**
 * What it costs to paint the fairground, measured on the real scene.
 *
 * It is the part of "validating the fairground in the headset" that needs no headset: what
 * is paid for in goggles is not the triangles but the **draw calls**, and
 * those are the same here as there (there, mind, per eye). The fps of a
 * desktop would say nothing about the headset; the number of calls does.
 *
 * It is measured from outside, wrapping the WebGL context, so as not to put counters
 * in the game's code. The frame is closed with a `requestAnimationFrame`
 * registered before the scene's one, so each lap counts what was
 * drawn in the previous frame.
 */

/**
 * Instances each family of parts of the fairground has to draw —boards,
 * poles and bulbs, which are the Ferris wheel and the garlands—, just as
 * `FAIR_PIECES` adds them up in `Fairground.tsx`: 119 parts among the three. And the 42 figures of the crowd (`CROWD_COUNT` in
 * `lib/crowdLayout.ts`), which are a separate family.
 *
 * This is the warning drei does not give: `<Instances limit={n}>` paints
 * `min(limit, parts)` **without saying anything**, so a short limit is not seen as
 * an error but as stage that is missing. On adding or removing parts of the fairground
 * the new numbers have to be brought here.
 */
const FAIR_INSTANCES = { boards: 12, poles: 27, bulbs: 80, figures: 42 }

/**
 * Instanced families the whole scene draws: the fairground's
 * (`FairPieces`, the crowd and one per piece of the kit, `FairKit`) plus the
 * machine's (`MachinePieces`).
 *
 * It is the signal that everything is already mounted. The machine hangs from a `Suspense`
 * of its own waiting for the wood textures, so it arrives quite a while after
 * the fairground: its families are the last to appear.
 *
 * It is COUNTED from the code instead of being written by hand. Written, one had to remember
 * to recount it every time one of the two families grew or shrank, and the
 * day you do not remember the test does not fail: it waits for less, the sample comes out with
 * the scene half mounted and the ceiling of calls passes measuring a scene that
 * is not the one the player sees. A guard that relaxes by itself is worse than not
 * having it, because nobody looks at it again.
 */
function countInstancedFamilies(): number {
  const sources = ['FairPieces.tsx', 'Crowd.tsx', 'MachinePieces.tsx'].map((file) =>
    readFileSync(join('src', 'components', 'game', file), 'utf8'),
  )
  const total = sources.reduce(
    (sum, source) => sum + (source.match(/createInstances\(/g)?.length ?? 0),
    0,
  )
  // If this comes out at zero it is because the files have been moved or renamed, and the test
  // would go on to wait for nothing: better to break here, with the reason in front.
  if (total === 0) {
    throw new Error(
      'I find no instanced family in src/components/game/: ' +
        'have FairPieces.tsx or MachinePieces.tsx been moved?',
    )
  }
  // The kit's pieces do not go with `createInstances`: each one is a loose `InstancedMesh`, which
  // arrives when the models come down. Counting them makes it wait for them to be there too.
  return total + KIT_PIECES.length
}

const SCENE_INSTANCED_FAMILIES = countInstancedFamilies()

/**
 * Wait of the two parts of the sampling. More than the 15 s of `expect`: in CI the
 * scene runs in software and a frame can cost hundreds of milliseconds,
 * so both mounting it and gathering the sample take their time even if everything
 * is fine.
 */
const SAMPLE_TIMEOUT = 45_000

/**
 * Calls per frame the scene costs **in the menu**, which is the state with
 * comparable measurements: it always starts with the same five sticks hanging.
 *
 * Measured 33, and this is the place where the whole breakdown lives —`ESTADO.md` and
 * `TODO.md` quote the total and refer here, which is the only one of the three that is
 * run—:
 *
 * - **9 the fairground**: its three instanced families, the crowd (one family
 *   more, `Crowd.tsx`), the two rings of the Ferris wheel and one per piece of the kit
 *   (stalls, lamp posts and bunting, `FairKit.tsx`).
 * - **5 the machine**: three families of tubes (they share geometry but not material)
 *   and two of bulbs.
 * - **15 the five sticks**, at three each while they hang: the rope, the stick and
 *   its hook. On falling they go to two.
 * - **4 the bases of the poles**: the foot's and the brace's, for each of the
 *   two poles.
 *
 * The sticks and their hooks are loose on purpose —a stick is caught with the hand and an
 * instance cannot be pointed at nor moved on its own—, so the total is the only thing
 * that moves with the run: 56 with thirteen sticks hanging, and going down as they are
 * resolved. The fairground and the machine never change.
 *
 * What the test checks is the total, not the split: if the scene changes in cost,
 * the four lines above have to be redone here by hand, and what warns that it is
 * time is this pinned figure. A roomy ceiling would not: the scene could
 * get half as expensive again without anything going off and the breakdown would go stale in
 * silence, which is just what cannot happen with a sum nobody recalculates.
 */
const MENU = drawCallBudget('menu')

/*
 * How much the measurement is let move before demanding that the breakdown be redone (the `margin`
 * of the two phases in the manifest).
 *
 * It allows for one stick hanging more or less —three calls each— and little more:
 * being left without the machine is five at once, and without the fairground nine: they go off. The big
 * stuff goes off with a huge margin: ceasing to instance would return the scene to the ~110 of
 * when the machine went with each tube loose.
 */

/**
 * And what it costs **in a run**, with the thirteen sticks hanging: the game's maximum.
 *
 * It comes from the same breakdown: the only thing that changes between the menu and the run are the sticks, at
 * three calls each while they hang. Five sticks are 33; thirteen are eight more, at three:
 * `33 + 8 × 3 = 57`. Measured it comes out 56, one less, because as soon as the countdown starts there is
 * already one stick resolved and it goes down to two.
 *
 * **Measuring it was missing.** The menu was checked from the start and the run was not, which is where it is
 * really paid for: it was the only one of the thirteen games with no run budget.
 */
const RUN = drawCallBudget('run')

interface DrawFrame {
  /** Draw calls of the frame. */
  calls: number
  /** Instances requested in each instanced call of the frame. */
  instanced: number[]
}

declare global {
  interface Window {
    /** Only exists with the counter on (`countDrawCalls`), like `__audioSpy`. */
    __drawFrames?: DrawFrame[]
  }
}

/** Wraps the WebGL context to count calls. Before `page.goto`. */
async function countDrawCalls(page: Page) {
  await page.addInitScript(() => {
    const frames: DrawFrame[] = []
    window.__drawFrames = frames

    let calls = 0
    let instanced: number[] = []

    const gl = WebGL2RenderingContext.prototype
    const { drawElements, drawElementsInstanced } = gl
    gl.drawElements = function (...args: Parameters<typeof drawElements>) {
      calls++
      return drawElements.apply(this, args)
    }
    gl.drawElementsInstanced = function (
      ...args: Parameters<typeof drawElementsInstanced>
    ) {
      calls++
      instanced.push(args[4])
      return drawElementsInstanced.apply(this, args)
    }

    const closeFrame = () => {
      frames.push({ calls, instanced })
      // Only the last ones matter: the sample is taken with the scene settled.
      if (frames.length > 240) frames.shift()
      calls = 0
      instanced = []
      requestAnimationFrame(closeFrame)
    }
    requestAnimationFrame(closeFrame)
  })
}

/**
 * Consecutive frames with the scene already mounted whole.
 *
 * The canvas having a size (`openGame`) only says that R3F has started
 * painting. The machine takes longer —its textures—, and on a cold start the
 * whole sample fits in that gap: there the frame is worth 6 calls, which
 * are the cost of nothing, and any measurement on them lies. So first
 * it waits for all the instanced families to appear and only then
 * counts.
 */
async function sampleFrames(page: Page, count = 30): Promise<DrawFrame[]> {
  // With no counter there are no frames to count, and the waits below would take
  // 45 s to say so blaming the scene for what is missing here.
  const counting = await page.evaluate(() => Boolean(window.__drawFrames))
  expect(counting, 'countDrawCalls(page) is missing before opening the page').toBe(
    true,
  )

  await expect
    .poll(
      () =>
        page.evaluate(() => window.__drawFrames!.at(-1)?.instanced.length ?? 0),
      {
        message: 'the scene never got mounted whole',
        timeout: SAMPLE_TIMEOUT,
      },
    )
    .toBeGreaterThanOrEqual(SCENE_INSTANCED_FAMILIES)

  // What was counted during the mounting is no longer of use: the sample starts here.
  await page.evaluate(() => {
    window.__drawFrames!.length = 0
  })
  await expect
    .poll(() => page.evaluate(() => window.__drawFrames!.length), {
      message: 'the scene never got to paint frames',
      timeout: SAMPLE_TIMEOUT,
    })
    .toBeGreaterThanOrEqual(count)
  return page.evaluate(() => window.__drawFrames!.slice())
}

test.describe('Draw cost of the fairground', () => {
  test.beforeEach(async ({ page }) => {
    await countDrawCalls(page)
    await openGame(page)
  })

  test('paints the 119 parts of the fairground and its crowd, with no silent clipping', async ({
    page,
  }) => {
    const frames = await sampleFrames(page)
    const expected = Object.values(FAIR_INSTANCES)
    // It is enough for one frame to bring them all: if a limit fell
    // short, the clipping would show in all of them.
    const complete = frames.some((frame) =>
      expected.every((count) => frame.instanced.includes(count)),
    )

    expect(
      complete,
      `no frame drew ${expected.join(' + ')} instances; the last one brought ${
        frames.at(-1)?.instanced.join(' + ') || 'none'
      }`,
    ).toBe(true)
  })

  test('and the whole run, with the thirteen sticks, costs what it says too', async ({
    page,
  }) => {
    // The game's maximum: there are no more sticks. If this shoots up, the breakdown above has
    // gone stale and has to be redone, which is what a pinned figure warns of and a
    // roomy ceiling would not.
    await startGame(page, { sticks: MAX_STICKS })

    const calls = (await sampleFrames(page))
      .map((frame) => frame.calls)
      .sort((a, b) => a - b)
    const median = calls[Math.floor(calls.length / 2)]

    const measured = `calls per frame in a run (the breakdown says ${RUN.measured})`
    expect(median, measured).toBeGreaterThanOrEqual(RUN.min)
    expect(median, measured).toBeLessThanOrEqual(RUN.max)
  })

  test('the menu costs the draw calls the breakdown says', async ({
    page,
  }) => {
    // Median: the frame in which the machine comes in counts extra, and a lone
    // spike cannot move the figure that is compared with the breakdown.
    const calls = (await sampleFrames(page))
      .map((frame) => frame.calls)
      .sort((a, b) => a - b)
    const median = calls[Math.floor(calls.length / 2)]

    const measured =
      `calls per frame in the menu (the breakdown says ${MENU.measured})`
    expect(median, measured).toBeGreaterThanOrEqual(MENU.min)
    expect(median, measured).toBeLessThanOrEqual(MENU.max)
  })
})
