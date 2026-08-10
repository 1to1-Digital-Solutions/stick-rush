import { expect, type Page } from '@playwright/test'

/** Punto en píxeles dentro del canvas. */
export interface ScreenPoint {
  x: number
  y: number
}

/**
 * Abre el juego y espera a que la escena 3D esté montada y pintando.
 *
 * El Canvas se carga con `dynamic(..., { ssr: false })`, así que al llegar al
 * HTML todavía no existe. Además, R3F no dimensiona el canvas hasta el primer
 * `requestAnimationFrame`, que no se ejecuta si la pestaña está en segundo
 * plano: esperar a que tenga tamaño es lo que distingue "cargando" de "listo".
 */
export async function openGame(page: Page, path = '/') {
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()

  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect
    .poll(async () => (await canvas.boundingBox())?.width ?? 0, {
      timeout: 30_000,
    })
    .toBeGreaterThan(0)
}

/** Configura la partida en el menú y la arranca. */
export async function startGame(
  page: Page,
  { sticks, difficulty }: { sticks: number; difficulty: string },
) {
  await page.getByRole('button', { name: String(sticks), exact: true }).click()
  await page.getByRole('button', { name: difficulty, exact: true }).click()
  await page.getByRole('button', { name: 'Jugar' }).click()

  await expect(page.getByRole('status')).toHaveAttribute(
    'aria-label',
    new RegExp(`Atrapados 0 de ${sticks}$`),
  )

  // La partida no empieza al pulsar, sino cuando se agota la cuenta atrás.
  // Devolver antes dejaría a los tests intentando atrapar palos que todavía
  // cuelgan quietos y no se dejan coger.
  await expect(page.getByRole('timer')).toBeHidden()
}

/** Palos atrapados según el marcador. */
export async function readScore(page: Page): Promise<number> {
  const label = await page.getByRole('status').getAttribute('aria-label')
  const match = label?.match(/Atrapados (\d+) de (\d+)/)
  if (!match) throw new Error(`Marcador ilegible: ${label}`)
  return Number(match[1])
}

/** Puntos acumulados según el marcador. */
export async function readPoints(page: Page): Promise<number> {
  const label = await page.getByRole('status').getAttribute('aria-label')
  const match = label?.match(/^([\d.]+) puntos/)
  if (!match) throw new Error(`Marcador ilegible: ${label}`)
  return Number(match[1].replace(/\./g, ''))
}

/**
 * Localiza un palo atrapable barriendo el canvas con el puntero.
 *
 * No hay forma de seleccionar un objeto 3D desde el DOM, así que se usa la
 * señal que el propio juego da al jugador: `Stick` pone el cursor en `pointer`
 * mientras el palo se puede atrapar. El barrido va de arriba abajo, de modo que
 * encuentra primero los palos que aún cuelgan del aro (los más altos): se mecen
 * unos milímetros, así que apenas se mueven entre encontrarlos y hacer clic,
 * frente a los que ya están cayendo.
 */
export async function findCatchableStick(
  page: Page,
  { step = 4 }: { step?: number } = {},
): Promise<ScreenPoint | null> {
  return page.evaluate((stepPx) => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const cursorBefore = document.body.style.cursor

    for (let y = rect.top + stepPx; y < rect.bottom; y += stepPx * 2) {
      for (let x = rect.left + stepPx; x < rect.right; x += stepPx) {
        canvas.dispatchEvent(
          new PointerEvent('pointermove', {
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
          }),
        )
        if (document.body.style.cursor === 'pointer') {
          return { x, y }
        }
      }
    }

    document.body.style.cursor = cursorBefore
    return null
  }, step)
}

/** El cursor en `pointer` es la señal de que hay un palo bajo el puntero. */
export async function isPointingAtStick(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.style.cursor === 'pointer')
}

/**
 * Localiza un punto del canvas donde hay un palo **colgado del aro**, no uno
 * cayendo.
 *
 * El barrido no distingue uno de otro, así que el candidato se confirma un par
 * de segundos después colocando el ratón encima: el palo que cuelga sigue
 * exactamente donde estaba y el que caía ya se ha ido del sitio (en Fácil baja
 * medio metro en ese rato). Como los anclajes del aro solo dependen de cuántos
 * palos tenga la partida, el punto sigue valiendo en la siguiente con el mismo
 * número de palos.
 */
export async function findHangingStick(
  page: Page,
  { attempts = 4 }: { attempts?: number } = {},
): Promise<ScreenPoint> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const candidate = await findCatchableStick(page)
    if (!candidate) continue

    await page.waitForTimeout(2000)
    // Por pasos: con un solo salto la escena no llega a registrar el palo que
    // hay debajo, igual que no lo registraría un ratón teletransportado.
    await page.mouse.move(candidate.x, candidate.y, { steps: 8 })
    if (await isPointingAtStick(page)) return candidate
  }

  throw new Error(`No se encontró ningún palo colgado en ${attempts} intentos`)
}

/**
 * Atrapa un palo y devuelve el punto donde se hizo clic.
 *
 * El barrido localiza un candidato con eventos sintéticos (instantáneos), pero
 * antes de pulsar se coloca el ratón de verdad y se confirma el hover: entre el
 * barrido y el clic el palo ha seguido cayendo, así que el punto puede haberse
 * quedado atrás. Si el candidato ya no vale, se vuelve a barrer.
 */
export async function catchStick(
  page: Page,
  { attempts = 12 }: { attempts?: number } = {},
): Promise<ScreenPoint> {
  const scoreBefore = await readScore(page)

  for (let attempt = 0; attempt < attempts; attempt++) {
    const target = await findCatchableStick(page)
    if (!target) continue

    await page.mouse.move(target.x, target.y)
    if (!(await isPointingAtStick(page))) continue

    await page.mouse.down()
    await page.mouse.up()

    if ((await readScore(page)) > scoreBefore) return target
  }

  throw new Error(
    `No se pudo atrapar ningún palo en ${attempts} intentos (marcador: ${scoreBefore})`,
  )
}

/** Espera al diálogo de fin de partida. */
export async function waitForGameOver(page: Page, timeout = 60_000) {
  await expect(page.getByRole('dialog')).toBeVisible({ timeout })
}
