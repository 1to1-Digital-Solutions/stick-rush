import path from 'node:path'
import { expect, type Page } from '@playwright/test'

import type { HostAnchor } from '../../src/lib/hostAnchor'
import type { Goal } from '../../src/lib/goal'
import type { Trial } from './common'
import { HOST_BUNDLE } from './globalSetup'

/** Stick Rush's record for the common e2e (`support/common.ts`): the challenge's points. */
export const ENSAYO: Trial = { mode: 'challenge', better: 'higher' }

/** Where the hall serves this game's static files. */
export const ASSETS_BASE = '/juegos/stick-rush/'
/** What the host does NOT serve from the root: in the hall, there is nothing of this game there. */
const ASSET_ROOTS = ['/webxr-profiles/']
const PAGE_PATH = '/test-host'
const BUNDLE_PATH = '/test-host.js'
const PUBLIC_DIR = path.join(process.cwd(), 'public')

/**
 * The host's HTML. The anchor travels in the document itself: the game uses it in its first
 * placement, as when the hall mounts the scene with it.
 */
function html(anchor: HostAnchor | undefined, { onDemand = false, challenge, goal }: HostOptions): string {
  const cabinet =
    (anchor == null ? '' : ` data-anchor="${JSON.stringify(anchor).replace(/"/g, '&quot;')}"`) +
    (onDemand ? ` data-cabinet="on-demand"` : '') +
    (challenge == null ? '' : ` data-challenge="${challenge}"`) +
    (goal == null ? '' : ` data-goal="${JSON.stringify(goal).replace(/"/g, '&quot;')}"`)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Test host</title>
    <style>
      html, body, #game { height: 100%; margin: 0; }
    </style>
  </head>
  <body>
    <div id="game" data-assets-base="${ASSETS_BASE}"${cabinet}></div>
    <script src="${BUNDLE_PATH}"></script>
  </body>
</html>
`
}

export interface HostOptions {
  /**
   * Mount the scene only when asked (`enterHostBooth`), **as in the hall**: there the
   * cabinet is chosen with the headset already on, so the scene is born inside an open session.
   * By default it is mounted with the page, which is what suits the rest of the suite.
   */
  onDemand?: boolean
  /** The seed of the challenge the hall passes to the scene (`challenge`), if one is wanted. */
  challenge?: number
  /** The medal thresholds the hall passes to the scene (`goal`), if they are wanted. */
  goal?: Goal
}

export interface TestHost {
  /** The paths the page has requested, in order. */
  requested: string[]
}

/**
 * Serves a page that mounts the scene as the hall would mount it: under its prefix, with the same
 * security policy as the game's website and with the static root answering 404.
 *
 * **The 404 is not decoration.** Inside the hall, the root's `/webxr-profiles/` belongs to the hub, not to
 * this game: its own hangs from `/juegos/stick-rush/`. Something that asked for it from the root
 * would work on the game's own website and would be missing right where it is played.
 */
export async function openHost(page: Page, anchor?: HostAnchor, options: HostOptions = {}): Promise<TestHost> {
  const csp = (await page.request.get('/')).headers()['content-security-policy']
  expect(csp, 'the server returned no security policy').toBeTruthy()

  const requested: string[] = []
  await page.route('**/*', async (route) => {
    const { pathname } = new URL(route.request().url())
    requested.push(pathname)
    if (pathname === PAGE_PATH) {
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        headers: { 'content-security-policy': csp },
        body: html(anchor, options),
      })
    }
    if (pathname === BUNDLE_PATH) {
      return route.fulfill({ contentType: 'text/javascript; charset=utf-8', path: HOST_BUNDLE })
    }
    if (pathname.startsWith(ASSETS_BASE)) {
      return route.fulfill({ path: path.join(PUBLIC_DIR, pathname.slice(ASSETS_BASE.length)) })
    }
    if (ASSET_ROOTS.some((root) => pathname.startsWith(root))) {
      return route.fulfill({ status: 404, body: '' })
    }
    return route.continue()
  })

  await page.goto(PAGE_PATH)
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect
    .poll(async () => (await canvas.boundingBox())?.width ?? 0, {
      timeout: 30_000,
      message: 'the scene never got painted inside the host',
    })
    .toBeGreaterThan(0)
  return { requested }
}

/**
 * Enters the immersive session from the host, which is how the hall enters: whoever owns
 * the Canvas owns the session.
 *
 * It is retried because the store does not accept the session until the Canvas has connected it with
 * three, a little after the first frame.
 */
export async function enterHostVR(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.__stickRushHost.enterVR().then(
            () => true,
            () => false,
          ),
        ),
      { message: 'the host could not open the immersive session' },
    )
    .toBe(true)
  await expect
    .poll(() => page.evaluate(() => window.__xrTest.hasSession()))
    .toBe(true)
}

/** Chooses the cabinet: mounts the scene inside the session already open (with `onDemand`). */
export async function enterHostBooth(page: Page): Promise<void> {
  await page.evaluate(() => window.__stickRushHost.enterCabinet())
}

/** What the scene has told the host on finishing each run. */
export function finishedRuns(page: Page) {
  return page.evaluate(() => window.__stickRushHost.finished)
}

/** An object of the scene, by name, seen from outside the Canvas. */
export function findInScene(page: Page, name: string) {
  return page.evaluate((n) => window.__stickRushHost.find(n), name)
}

/**
 * Stops painting an object of the scene, or paints it again. It is what lets us measure what
 * **that** costs and nothing else: the draw calls with it minus the calls without it.
 */
export function hideInScene(page: Page, name: string, hidden: boolean) {
  return page.evaluate(([n, h]) => window.__stickRushHost.hide(n, h), [name, hidden] as const)
}

/** Points the host's camera, with no headset, at a point of the scene. */
export function lookAtInScene(page: Page, [x, y, z]: readonly [number, number, number]) {
  return page.evaluate(([a, b, c]) => window.__stickRushHost.lookAt(a, b, c), [x, y, z] as const)
}
