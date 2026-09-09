import { expect, test, type Page } from '@playwright/test'
import { openGame, startGame, waitForGameOver } from './helpers'

/**
 * Compartir el resultado al acabar la partida.
 *
 * El récord vive en el navegador y de ahí no sale solo: esto es el recorrido que
 * lo saca. Se juega con los tres navegadores posibles —el que trae hoja de
 * compartir, el que solo tiene portapapeles y el que no deja ninguna de las
 * dos— porque el camino que se toma depende justo de eso, y en el peor de ellos
 * lo que no puede pasar es que el botón no conteste.
 *
 * **Lo que estos tests NO cubren:** el botón dentro del visor. El emulador WebXR
 * entrega sesión pero sus punteros no llegan a pulsar los objetos de la escena
 * (ver la cabecera de `xr.spec.ts`), así que esa parte solo se valida en
 * hardware. Lo que sí está cubierto sin navegador es la decisión que la hace
 * funcionar allí: cuando la hoja de compartir no arranca, el texto se copia
 * (`shareResult.test.ts`).
 */

/**
 * La hoja de compartir del sistema, apuntando lo que se le manda.
 *
 * Con `cancel` se cierra como la cierra el jugador, con el `AbortError` que
 * mandan los navegadores. El intento queda apuntado igual: es lo que deja
 * esperar a que haya ocurrido antes de comprobar que no ocurrió nada más.
 */
async function installShareSheet(page: Page, { cancel = false } = {}) {
  await page.addInitScript((cancelled: boolean) => {
    const shared: unknown[] = []
    Object.defineProperty(window, '__shared', { value: shared })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: unknown) => {
        shared.push(data)
        if (!cancelled) return
        const error = new Error('cancelado')
        error.name = 'AbortError'
        throw error
      },
    })
  }, cancel)
}

/** Un navegador sin hoja de compartir: el caso del escritorio corriente. */
async function removeShareSheet(page: Page) {
  await page.addInitScript(() => {
    // Del prototipo y de la instancia: según el navegador está en uno u otro.
    delete (Navigator.prototype as unknown as Record<string, unknown>).share
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    })
  })
}

/** Deja el portapapeles inservible, como cuando la página no tiene el foco. */
async function breakClipboard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () =>
          Promise.reject(new DOMException('sin foco', 'NotAllowedError')),
      },
    })
  })
}

/** Lo que se le pasó a la hoja de compartir. */
async function sharedPayloads(page: Page): Promise<{ text?: string }[]> {
  return page.evaluate(
    () => (window as unknown as { __shared: { text?: string }[] }).__shared,
  )
}

/**
 * Espera a que la hoja de compartir se haya abierto tantas veces.
 *
 * Pulsar es instantáneo, armar el texto y entregarlo no: leer los envíos justo
 * después del clic es una carrera. Importa sobre todo donde lo que se comprueba
 * es que **no** pasó nada más —cancelar—, porque ahí una lectura adelantada
 * pasaría en verde con el fallo puesto.
 */
async function waitForShareAttempts(page: Page, count: number) {
  await expect
    .poll(async () => (await sharedPayloads(page)).length)
    .toBe(count)
}

function shareButton(page: Page) {
  return page.getByRole('button', { name: 'Share' })
}

test.describe('Compartir el resultado', () => {
  test('la partida se comparte con la hoja del sistema', async ({ page }) => {
    await installShareSheet(page)
    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await waitForGameOver(page)

    await shareButton(page).click()
    await waitForShareAttempts(page, 1)

    const [shared] = await sharedPayloads(page)
    const text = shared.text ?? ''
    // Lo que hace presentable al texto: de qué iba la partida, qué se sacó y
    // dónde se juega. Sin el enlace, quien lo lea no puede intentarlo.
    expect(text).toContain('Stick Rush — Practice on Easy')
    expect(text).toMatch(/\d+ points · \d+ of 5 sticks/)
    expect(text).toContain(new URL(page.url()).origin)
    // Y no se habla de vidas donde no las hay.
    expect(text).not.toMatch(/vida/i)

    await expect(page.getByText('Shared!')).toBeVisible()
  })

  test('el desafío comparte las vidas con las que se acabó', async ({
    page,
  }) => {
    await installShareSheet(page)
    await openGame(page)
    // Imposible y sin atrapar nada: las tres vidas se gastan en unos segundos,
    // que es el final que hay que poder contar.
    await startGame(page, {
      sticks: 5,
      difficulty: 'Impossible',
      mode: 'Challenge',
    })
    await waitForGameOver(page)

    await shareButton(page).click()
    await waitForShareAttempts(page, 1)

    const [shared] = await sharedPayloads(page)
    expect(shared.text).toContain('Stick Rush — Challenge on Impossible')
    expect(shared.text).toContain('0 of 3 lives')
  })

  test('sin hoja de compartir, el texto queda copiado y se avisa', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await removeShareSheet(page)
    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await waitForGameOver(page)

    await shareButton(page).click()

    await expect(
      page.getByText('Result copied to the clipboard.'),
    ).toBeVisible()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain('Stick Rush — Practice on Easy')
    expect(copied).toContain(new URL(page.url()).origin)
  })

  test('cancelar el diálogo no es un error ni copia por detrás', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await installShareSheet(page, { cancel: true })
    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await waitForGameOver(page)
    // Algo en el portapapeles de antes: si el juego copiara a escondidas, se
    // notaría porque esto habría desaparecido.
    await page.evaluate(() => navigator.clipboard.writeText('nada que ver'))

    await shareButton(page).click()
    // La hoja se abrió y se cerró: lo que no puede pasar ya habría pasado.
    await waitForShareAttempts(page, 1)

    const dialog = page.getByRole('dialog')
    await expect(dialog).not.toContainText('copiado')
    await expect(dialog).not.toContainText('Shared!')
    await expect(dialog).not.toContainText('no deja compartir')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'nada que ver',
    )
  })

  test('cuando no se puede ni compartir ni copiar, el botón lo dice', async ({
    page,
  }) => {
    await removeShareSheet(page)
    await breakClipboard(page)
    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await waitForGameOver(page)

    await shareButton(page).click()

    // Callarse aquí sería exactamente el botón que no hace nada.
    await expect(
      page.getByText(/will not share or copy/),
    ).toBeVisible()
  })

  test('el aviso no viaja a la partida siguiente', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await removeShareSheet(page)
    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await waitForGameOver(page)
    await shareButton(page).click()
    await expect(
      page.getByText('Result copied to the clipboard.'),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Back to the menu' }).click()
    await startGame(page, { sticks: 5, difficulty: 'Easy' })
    await waitForGameOver(page)

    await expect(
      page.getByText('Result copied to the clipboard.'),
    ).toBeHidden()
  })
})
