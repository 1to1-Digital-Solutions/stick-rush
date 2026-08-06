import { expect, type Page } from '@playwright/test'
import { XR_EMULATOR_BUNDLE } from './globalSetup'

export type Point = { x: number; y: number; z: number }

/** Convierte una posición de `xrLayout` (tupla) al punto que usa el emulador. */
export function toPoint([x, y, z]: [number, number, number]): Point {
  return { x, y, z }
}
type Hand = 'left' | 'right'

/** API que el emulador expone en la página bajo `window.__xrTest`. */
interface XRTestApi {
  hasSession: () => boolean
  place: (hand: Hand, target: Point) => void
  aim: (hand: Hand, target: Point) => void
  press: (hand: Hand, button: 'squeeze' | 'trigger', value?: number) => void
  endSession: () => Promise<void>
}

declare global {
  interface Window {
    __xrTest: XRTestApi
  }
}

/**
 * Instala el emulador WebXR. Hay que llamarlo **antes** de `page.goto`: el
 * runtime tiene que existir cuando la app comprueba `navigator.xr`.
 */
export async function installXREmulator(page: Page) {
  await page.addInitScript({ path: XR_EMULATOR_BUNDLE })
}

/**
 * Entra en una sesión inmersiva pulsando el botón real del menú.
 *
 * Hay un único botón de entrada: la sesión se abre en `immersive-ar` cuando el
 * visor la admite, porque es la que deja alternar escenario y passthrough sin
 * reabrirla (ver `XRWrapper`).
 *
 * Además de esperar a que la sesión exista, espera a que la app haya asentado
 * su estado: `XRSessionController` reacciona a la entrada con un efecto que
 * lleva al menú, y actuar antes de que corra hace que ese efecto cancele
 * después lo que el test acababa de hacer.
 */
export async function enterVR(page: Page) {
  await page.getByRole('button', { name: 'Entrar en el visor' }).click()
  await expect
    .poll(() => page.evaluate(() => window.__xrTest.hasSession()), {
      message: 'no arrancó la sesión inmersiva',
    })
    .toBe(true)
  await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
}

/** Sale de la sesión inmersiva, como al quitarse el visor. */
export async function exitXR(page: Page) {
  await page.evaluate(() => window.__xrTest.endSession())
  await expect
    .poll(() => page.evaluate(() => window.__xrTest.hasSession()), {
      message: 'la sesión inmersiva no se cerró',
    })
    .toBe(false)
}

/** Coloca la mano en un punto y la orienta hacia donde mira el jugador. */
export async function placeHand(page: Page, hand: Hand, target: Point) {
  await page.evaluate(
    ([h, t]) => window.__xrTest.place(h as Hand, t as Point),
    [hand, target] as const,
  )
  // Un par de frames para que el runtime propague la pose a la escena.
  await page.waitForTimeout(120)
}

/** Apunta el rayo de la mano hacia un punto, sin moverla de sitio. */
export async function aimHandAt(page: Page, hand: Hand, target: Point) {
  await page.evaluate(
    ([h, t]) => window.__xrTest.aim(h as Hand, t as Point),
    [hand, target] as const,
  )
  await page.waitForTimeout(120)
}

/** Pulsa y suelta un botón del mando. */
export async function pressAndRelease(
  page: Page,
  hand: Hand,
  button: 'squeeze' | 'trigger',
) {
  await page.evaluate(
    ([h, b]) => window.__xrTest.press(h as Hand, b as 'squeeze' | 'trigger', 1),
    [hand, button] as const,
  )
  await page.waitForTimeout(120)
  await page.evaluate(
    ([h, b]) => window.__xrTest.press(h as Hand, b as 'squeeze' | 'trigger', 0),
    [hand, button] as const,
  )
  await page.waitForTimeout(120)
}

/**
 * Arranca una partida estando ya dentro de la sesión inmersiva.
 *
 * El canvas inmersivo se traga los clics, así que se usa el teclado sobre el
 * overlay. Se reintenta porque al entrar en sesión el documento puede perder el
 * foco durante un instante y la pulsación se va al vacío.
 */
export async function startGameInsideSession(page: Page, attempts = 8) {
  const score = page.getByRole('status')
  for (let attempt = 0; attempt < attempts; attempt++) {
    await page.getByRole('button', { name: 'Jugar' }).focus()
    await page.keyboard.press('Enter')

    // No basta con que aparezca el marcador: si la partida arranca en el hueco
    // entre que la sesión existe y que `XRSessionController` registra que hubo
    // sesión, su efecto la descarta acto seguido (entrar en el visor con una
    // partida a medias vuelve al menú a propósito). Se confirma que persiste.
    await page.waitForTimeout(400)
    if (await score.count()) return

    await page.waitForTimeout(200)
  }
  throw new Error(
    `No se pudo arrancar la partida dentro de la sesión en ${attempts} intentos`,
  )
}
