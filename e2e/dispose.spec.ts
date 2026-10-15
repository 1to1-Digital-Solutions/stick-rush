import { expect, test, type Page } from '@playwright/test'
import { openHost } from './support/host'

/**
 * Entering the cabinet and going back to the hall leaves nothing on the GPU.
 *
 * The hall mounts and unmounts the scene on every visit, in the same Canvas, and what the scene does
 * not dispose stays until the tab is closed. three's counter (`renderer.info.memory`) does not see
 * everything: the buffers of the copies of an `<Instances>` belong to no geometry
 * (`disposeInstances.ts`). So the WebGL buffers and textures are counted as well, wrapping
 * their `create*` and `delete*`, like the hall's memory e2e (`xrcade/e2e/support/medidas.ts`).
 *
 * The first visit leaves what is kept on purpose for the next one —the kit's models in the
 * `useGLTF` cache, the HDRI in the `useLoader` one, the planes of the renderer's PMREM— and some
 * other thing that is created once. From there on, **every visit has to leave the same as the
 * previous one**. With the HDRI's projected ground not disposed, one geometry and three buffers went up per
 * visit (`useDisposeMeshes`).
 */

declare global {
  interface Window {
    __THREE_DEVTOOLS__?: EventTarget
    __renderer?: { info: { memory: { geometries: number; textures: number } } }
    __glLive?: { buffers: number; textures: number }
  }
}

/** Installs the counter before opening the page. */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const devtools = new EventTarget()
    devtools.addEventListener('observe', (event) => {
      const detail = (event as CustomEvent).detail as { isWebGLRenderer?: boolean }
      if (detail?.isWebGLRenderer === true) window.__renderer = detail as never
    })
    window.__THREE_DEVTOOLS__ = devtools
    const gl = WebGL2RenderingContext.prototype as unknown as Record<string, (...args: unknown[]) => unknown>
    const live = { buffers: 0, textures: 0 }
    window.__glLive = live
    const count = (create: string, remove: string, key: keyof typeof live) => {
      const originalCreate = gl[create]!
      const originalRemove = gl[remove]!
      gl[create] = function (this: unknown, ...args: unknown[]) {
        const made = originalCreate.apply(this, args)
        if (made != null) live[key]++
        return made
      }
      gl[remove] = function (this: unknown, ...args: unknown[]) {
        if (args[0] != null) live[key]--
        return originalRemove.apply(this, args)
      }
    }
    count('createBuffer', 'deleteBuffer', 'buffers')
    count('createTexture', 'deleteTexture', 'textures')
  })
}

type Live = { geometries: number; textures: number; buffers: number; glTextures: number }

function read(page: Page): Promise<Live> {
  return page.evaluate(() => ({
    geometries: window.__renderer!.info.memory.geometries,
    textures: window.__renderer!.info.memory.textures,
    buffers: window.__glLive!.buffers,
    glTextures: window.__glLive!.textures,
  }))
}

/** What is left when it stops changing: four equal readings in a row, every half second. */
async function settled(page: Page): Promise<Live> {
  let previous = ''
  let equal = 0
  for (let i = 0; i < 90 && equal < 4; i++) {
    await page.waitForTimeout(500)
    const now = JSON.stringify(await read(page))
    equal = now === previous ? equal + 1 : 0
    previous = now
  }
  return read(page)
}

test('entering the cabinet and going back to the hall leaves no buffers nor geometries', async ({ page }) => {
  await instrument(page)
  await openHost(page, undefined, { onDemand: true })
  await expect.poll(() => page.evaluate(() => window.__renderer != null)).toBe(true)

  const onLeaving: Live[] = []
  for (let visit = 1; visit <= 4; visit++) {
    await page.evaluate(() => window.__stickRushHost.enterCabinet())
    const inside = await settled(page)
    expect(inside.geometries, 'the scene never got mounted').toBeGreaterThan(10)
    await page.evaluate(() => window.__stickRushHost.leaveCabinet())
    onLeaving.push(await settled(page))
    console.log(`[dispose] visit ${visit}: inside ${JSON.stringify(inside)}, on leaving ${JSON.stringify(onLeaving.at(-1))}`)
  }

  // The first visit fills the caches; from the second on, each one leaves the same as the previous one.
  for (let visit = 2; visit < onLeaving.length; visit++) {
    expect(onLeaving[visit], `visit ${visit + 1} left more than visit ${visit}`).toEqual(onLeaving[visit - 1])
  }
})
