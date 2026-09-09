import { expect, test, type Page } from '@playwright/test'
import { openGame } from './helpers'

/**
 * Deja la máquina a la vista y espera a que esté pintada.
 *
 * El menú de escritorio es un panel opaco que tapa el canvas entero, así que
 * para mirar la escena hay que apartarlo. Y hay que esperar: hasta que llegan el
 * HDRI y las texturas de la madera, el canvas es un rectángulo de color, y una
 * captura de eso pesa unos pocos kilobytes frente a los cientos de la plaza.
 */
async function revealScene(page: Page) {
  await page.evaluate(() => {
    const menu = document.querySelector('main')
    if (menu instanceof HTMLElement) menu.style.display = 'none'
  })

  await expect
    .poll(async () => (await page.locator('canvas').screenshot()).length, {
      timeout: 30_000,
    })
    .toBeGreaterThan(100_000)
}

/** Cuánto se deja pasar entre las dos capturas que se comparan. */
const MOVEMENT_WINDOW = 600

async function canvasBox(page: Page) {
  const box = await page.locator('canvas').boundingBox()
  if (box == null) throw new Error('la escena 3D no está montada')
  return box
}

/**
 * Recorte centrado en la máquina, en coordenadas de página.
 *
 * Las cotas van en proporción al **alto** del canvas —el `fov` de la cámara es
 * vertical— para que el recorte siga cayendo sobre la máquina aunque cambie la
 * relación de aspecto.
 */
function machineClip({ x, y, width, height }: Awaited<ReturnType<typeof canvasBox>>) {
  return {
    x: x + width / 2 - height * 0.195,
    y: y + height * 0.21,
    width: height * 0.39,
    height: height * 0.25,
  }
}

/**
 * Si la escena cambia entre dos instantes.
 *
 * Con el panel del menú apartado y las animaciones del DOM congeladas, en el
 * menú solo pueden moverse dos cosas: los palos meciéndose y la noria del
 * recinto, que gira despacio en la periferia. Mirando el canvas entero, un
 * cambio puede venir de cualquiera de las dos; con `onlyMachine` la captura se
 * recorta a la máquina, muy lejos de la noria, y entonces solo puede ser el
 * balanceo.
 */
async function sceneMoves(
  page: Page,
  { onlyMachine = false } = {},
): Promise<boolean> {
  const canvas = await canvasBox(page)
  const clip = onlyMachine ? machineClip(canvas) : canvas
  const before = await page.screenshot({ clip, animations: 'disabled' })
  await page.waitForTimeout(MOVEMENT_WINDOW)
  const after = await page.screenshot({ clip, animations: 'disabled' })
  return !before.equals(after)
}

test.describe('Menú de inicio', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('presenta el juego sobre la escena 3D ya montada', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(
      page.getByText('Catch the sticks before they hit the ground.'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
  })

  test('ofrece de 5 a 13 palos, con 5 preseleccionado', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Number of sticks' })
    const options = section.getByRole('button')
    await expect(options).toHaveCount(9)
    await expect(options.first()).toHaveText('5')
    await expect(options.last()).toHaveText('13')
    await expect(options.first()).toHaveAttribute('aria-pressed', 'true')
  })

  test('cambia el número de palos y lo refleja en el estado del botón', async ({
    page,
  }) => {
    const nine = page.getByRole('button', { name: '9', exact: true })
    await nine.click()

    await expect(nine).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: '5', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('ofrece las cinco dificultades, con Fácil preseleccionada', async ({
    page,
  }) => {
    const section = page.getByRole('region', { name: 'Difficulty' })
    await expect(section.getByRole('button')).toHaveCount(5)
    await expect(section.getByRole('button')).toHaveText([
      'Easy',
      'Medium',
      'Hard',
      'Expert',
      'Impossible',
    ])
    await expect(section.getByRole('button', { name: 'Easy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('solo hay una dificultad activa a la vez', async ({ page }) => {
    await page.getByRole('button', { name: 'Hard', exact: true }).click()

    await expect(
      page.getByRole('button', { name: 'Hard', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('button', { name: 'Easy', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  test('los palos colgados se mecen, así que la máquina no parece congelada', async ({
    page,
  }) => {
    await revealScene(page)

    expect(await sceneMoves(page, { onlyMachine: true })).toBe(true)
  })

  test('con el movimiento reducido, no se mueve nada de la escena', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await revealScene(page)
    // Los palos que ya se mecían tardan un instante en enderezarse.
    await page.waitForTimeout(MOVEMENT_WINDOW)

    // Aquí sí se mira el canvas entero: la preferencia tiene que parar tanto el
    // balanceo de los palos como la noria del recinto.
    expect(await sceneMoves(page)).toBe(false)
  })

  test('esconde la entrada al visor en un navegador sin WebXR', async ({
    page,
  }) => {
    await expect(page.getByRole('button', { name: /Enter/ })).toHaveCount(0)
  })

  test('no pide nada a dominios externos', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.hostname !== '127.0.0.1' && url.protocol.startsWith('http')) {
        external.push(request.url())
      }
    })

    await page.reload()
    await openGame(page)
    await page.getByRole('button', { name: 'Play' }).click()
    await expect(page.getByRole('status')).toBeVisible()

    expect(external).toEqual([])
  })

  test('la ruta /game abre la misma escena', async ({ page }) => {
    await openGame(page, '/game')
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
  })

  test('se puede recorrer y jugar solo con el teclado', async ({ page }) => {
    await page.getByRole('button', { name: '5', exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: '6', exact: true })).toBeFocused()

    await page.getByRole('button', { name: 'Play' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toBeVisible()
  })
})
