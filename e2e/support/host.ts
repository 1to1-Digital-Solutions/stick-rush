import path from 'node:path'
import { expect, type Page } from '@playwright/test'

import type { HostAnchor } from '../../src/lib/hostAnchor'
import type { Objetivo } from '../../src/lib/objetivo'
import type { Ensayo } from './comun'
import { HOST_BUNDLE } from './globalSetup'

/** El récord de Stick Rush para los e2e comunes (`support/comun.ts`): los puntos del reto. */
export const ENSAYO: Ensayo = { modo: 'challenge', mejorEs: 'mas' }

/** Donde el salón sirve los estáticos de este juego. */
export const ASSETS_BASE = '/juegos/stick-rush/'
/** Lo que el anfitrión NO sirve desde la raíz: en el salón, ahí no hay nada de este juego. */
const ASSET_ROOTS = ['/webxr-profiles/']
const PAGE_PATH = '/anfitrion-de-prueba'
const BUNDLE_PATH = '/anfitrion-de-prueba.js'
const PUBLIC_DIR = path.join(process.cwd(), 'public')

/**
 * El HTML del anfitrión. El anclaje viaja en el propio documento: el juego lo usa en su primera
 * colocación, como cuando el salón monta la escena con él.
 */
function html(anchor: HostAnchor | undefined, { aLaCarta = false, reto, objetivo }: HostOptions): string {
  const cabina =
    (anchor == null ? '' : ` data-anchor="${JSON.stringify(anchor).replace(/"/g, '&quot;')}"`) +
    (aLaCarta ? ` data-cabina="a-la-carta"` : '') +
    (reto == null ? '' : ` data-reto="${reto}"`) +
    (objetivo == null ? '' : ` data-objetivo="${JSON.stringify(objetivo).replace(/"/g, '&quot;')}"`)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Anfitrión de prueba</title>
    <style>
      html, body, #juego { height: 100%; margin: 0; }
    </style>
  </head>
  <body>
    <div id="juego" data-assets-base="${ASSETS_BASE}"${cabina}></div>
    <script src="${BUNDLE_PATH}"></script>
  </body>
</html>
`
}

export interface HostOptions {
  /**
   * Montar la escena solo cuando se pida (`enterHostBooth`), **como en el salón**: allí se
   * elige cabina con el visor ya puesto, así que la escena nace dentro de una sesión abierta.
   * Por defecto se monta con la página, que es lo que le vale al resto de la suite.
   */
  aLaCarta?: boolean
  /** La semilla del reto que el salón le pasa a la escena (`reto`), si se quiere uno. */
  reto?: number
  /** Los listones de medalla que el salón le pasa a la escena (`objetivo`), si se quieren. */
  objetivo?: Objetivo
}

export interface TestHost {
  /** Las rutas que la página ha pedido, en orden. */
  requested: string[]
}

/**
 * Sirve una página que monta la escena como la montaría el salón: bajo su prefijo, con la misma
 * política de seguridad que la web del juego y con la raíz de estáticos respondiendo 404.
 *
 * **Lo del 404 no es adorno.** Dentro del salón, `/webxr-profiles/` de la raíz es del hub, no de
 * este juego: lo suyo cuelga de `/juegos/stick-rush/`. Algo que lo pidiera de la raíz
 * funcionaría en la web propia y faltaría justo donde se juega.
 */
export async function openHost(page: Page, anchor?: HostAnchor, opciones: HostOptions = {}): Promise<TestHost> {
  const csp = (await page.request.get('/')).headers()['content-security-policy']
  expect(csp, 'el servidor no devolvió política de seguridad').toBeTruthy()

  const requested: string[] = []
  await page.route('**/*', async (route) => {
    const { pathname } = new URL(route.request().url())
    requested.push(pathname)
    if (pathname === PAGE_PATH) {
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        headers: { 'content-security-policy': csp },
        body: html(anchor, opciones),
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
      message: 'la escena no llegó a pintarse dentro del anfitrión',
    })
    .toBeGreaterThan(0)
  return { requested }
}

/**
 * Entra en la sesión inmersiva desde el anfitrión, que es como entra el salón: quien es dueño
 * del Canvas es dueño de la sesión.
 *
 * Se reintenta porque el store no acepta la sesión hasta que el Canvas lo ha conectado con
 * three, un poco después del primer fotograma.
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
      { message: 'el anfitrión no pudo abrir la sesión inmersiva' },
    )
    .toBe(true)
  await expect
    .poll(() => page.evaluate(() => window.__xrTest.hasSession()))
    .toBe(true)
}

/** Elige la cabina: monta la escena dentro de la sesión ya abierta (con `aLaCarta`). */
export async function enterHostBooth(page: Page): Promise<void> {
  await page.evaluate(() => window.__stickRushHost.entrarEnLaCabina())
}

/** Lo que la escena ha contado al anfitrión al acabar cada partida. */
export function partidasTerminadas(page: Page) {
  return page.evaluate(() => window.__stickRushHost.terminadas)
}

/** Un objeto de la escena, por nombre, visto desde fuera del Canvas. */
export function buscarEnLaEscena(page: Page, nombre: string) {
  return page.evaluate((n) => window.__stickRushHost.buscar(n), nombre)
}

/**
 * Deja de pintar un objeto de la escena, o lo vuelve a pintar. Es lo que permite medir lo que
 * cuesta **eso** y nada más: las llamadas de dibujo con él menos las llamadas sin él.
 */
export function esconderEnLaEscena(page: Page, nombre: string, oculto: boolean) {
  return page.evaluate(([n, o]) => window.__stickRushHost.esconder(n, o), [nombre, oculto] as const)
}

/** Apunta la cámara del anfitrión, sin visor, a un punto de la escena. */
export function mirarEnLaEscena(page: Page, [x, y, z]: readonly [number, number, number]) {
  return page.evaluate(([a, b, c]) => window.__stickRushHost.mirar(a, b, c), [x, y, z] as const)
}
