/**
 * Copies the WebXR controller profiles to `public/webxr-profiles/`.
 *
 * **Why it is needed.** @react-three/xr needs the controller's profile to
 * know which button is which, and by default it downloads it from
 * `cdn.jsdelivr.net`. That fetch is blocked by the game's CSP
 * (`connect-src 'self'`), and a headset with no way out to the internet would
 * block it too. When it fails, the library swallows the error and **never gets
 * to register the controller**: neither the ray nor the pointer is mounted,
 * which in the headset means being unable to touch anything.
 *
 * Of the `profile.json` files **all** are copied: they are small files and the
 * one for the controller whoever plays brings is needed, whichever it is.
 *
 * Of the `.glb` files with the 3D models —the 100-odd MB of the package— only
 * those in `MODELS` are copied. While playing, the game itself draws the
 * controller with its own geometry (`XRController.tsx`); the only place where
 * the manufacturer's model is needed is the tutorial, which shows the button
 * lit on the controller held in the hand (`RealController.tsx`), and there a
 * controller that is not in the list keeps the panel's drawing and nothing
 * breaks.
 *
 * Usage: `npm run sync:xr-profiles`. The result is committed, so this only
 * has to be run when updating `@webxr-input-profiles/assets`.
 */
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(
  root,
  'node_modules/@webxr-input-profiles/assets/dist/profiles',
)
const destination = join(root, 'public/webxr-profiles')

const LIST = 'profilesList.json'

/**
 * Which controllers also get their 3D model copied.
 *
 * The two of Quest, which is the hall's headset: `meta-quest-touch-plus` are
 * those of the Quest 3 and 3S, and `oculus-touch-v3` those of the Quest 2.
 * Between the four files —the two hands of each— they are 1.7 MB of the
 * package's 97.
 *
 * Adding a controller is writing its identifier here; removing it, deleting
 * it. What is not here does not fail: the tutorial keeps the drawing.
 */
const MODELS = ['meta-quest-touch-plus', 'oculus-touch-v3']

/**
 * The articulated hand the scene paints when playing with bare hands
 * (`PlayerHands.tsx`, path in `lib/hands.ts`): 190 KB, without
 * textures, served with the game because the CSP blocks the CDN.
 *
 * **It goes in `public/manos/`, outside `webxr-profiles/`**, for two reasons:
 * xrcade's hall **deletes** the `webxr-profiles/` of each game when installing
 * it (it serves its own, `install-game-assets.ts`), so in there the hand would
 * not reach where the game is played the most; and every `.glb` at the root of
 * the profiles is taken for a controller with a model (`realController.test.ts`).
 */
const HAND = 'generic-hand'
const HANDS_DIR = join(root, 'public/manos')

/** The two hands of each model, exactly as the package's files are called. */
const HANDS = ['left.glb', 'right.glb']


async function main() {
  const list = JSON.parse(await readFile(join(source, LIST), 'utf8'))

  // It is redone from scratch so that updating the package leaves no orphan
  // profiles from a previous version.
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  await copyFile(join(source, LIST), join(destination, LIST))

  let copied = 0
  for (const [id, info] of Object.entries(list)) {
    const path = info?.path
    if (typeof path !== 'string') {
      throw new Error(`The profile "${id}" declares no path in ${LIST}`)
    }
    const target = join(destination, path)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(join(source, path), target)
    copied++
  }

  let models = 0
  for (const id of MODELS) {
    for (const hand of HANDS) {
      // A misspelt identifier here would go unnoticed —the tutorial would be
      // left without a model and without saying why—, so it fails on copy.
      await copyFile(join(source, id, hand), join(destination, id, hand))
      models++
    }
  }

  console.log(
    `${copied} controller profiles and ${models} models copied to public/webxr-profiles/`,
  )

  await rm(HANDS_DIR, { recursive: true, force: true })
  await mkdir(join(HANDS_DIR, HAND), { recursive: true })
  for (const hand of HANDS) {
    await copyFile(join(source, HAND, hand), join(HANDS_DIR, HAND, hand))
  }
  console.log(`Articulated hand (${HAND}) copied to public/manos/`)
}

await main()
