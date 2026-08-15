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

/** La hoja de compartir del sistema, apuntando lo que se le manda. */
async function installShareSheet(page: Page) {
  await page.addInitScript(() => {
    const shared: unknown[] = []
    Object.defineProperty(window, '__shared', { value: shared })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: unknown) => void shared.push(data),
    })
  })
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

function shareButton(page: Page) {
  return page.getByRole('button', { name: 'Compartir' })
}

test.describe('Compartir el resultado', () => {
  test('la partida se comparte con la hoja del sistema', async ({ page }) => {
    await installShareSheet(page)
    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Fácil' })
    await waitForGameOver(page)

    await shareButton(page).click()

    const shared = await sharedPayloads(page)
    expect(shared).toHaveLength(1)
    const text = shared[0].text ?? ''
    // Lo que hace presentable al texto: de qué iba la partida, qué se sacó y
    // dónde se juega. Sin el enlace, quien lo lea no puede intentarlo.
    expect(text).toContain('Stick Rush — Práctica en Fácil')
    expect(text).toMatch(/\d+ puntos · \d+ de 5 palos/)
    expect(text).toContain(new URL(page.url()).origin)
    // Y no se habla de vidas donde no las hay.
    expect(text).not.toMatch(/vida/i)

    await expect(page.getByText('¡Compartido!')).toBeVisible()
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
      difficulty: 'Imposible',
      mode: 'Desafío',
    })
    await waitForGameOver(page)

    await shareButton(page).click()

    const [shared] = await sharedPayloads(page)
    expect(shared.text).toContain('Stick Rush — Desafío en Imposible')
    expect(shared.text).toContain('0 de 3 vidas')
  })

  test('sin hoja de compartir, el texto queda copiado y se avisa', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await removeShareSheet(page)
    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Fácil' })
    await waitForGameOver(page)

    await shareButton(page).click()

    await expect(
      page.getByText('Resultado copiado al portapapeles.'),
    ).toBeVisible()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain('Stick Rush — Práctica en Fácil')
    expect(copied).toContain(new URL(page.url()).origin)
  })

  test('cancelar el diálogo no es un error ni copia por detrás', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => {
          const error = new Error('cancelado')
          error.name = 'AbortError'
          return Promise.reject(error)
        },
      })
    })
    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Fácil' })
    await waitForGameOver(page)
    // Algo en el portapapeles de antes: si el juego copiara a escondidas, se
    // notaría porque esto habría desaparecido.
    await page.evaluate(() => navigator.clipboard.writeText('nada que ver'))

    await shareButton(page).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).not.toContainText('copiado')
    await expect(dialog).not.toContainText('¡Compartido!')
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
    await startGame(page, { sticks: 5, difficulty: 'Fácil' })
    await waitForGameOver(page)

    await shareButton(page).click()

    // Callarse aquí sería exactamente el botón que no hace nada.
    await expect(
      page.getByText(/no deja compartir ni copiar/),
    ).toBeVisible()
  })

  test('el aviso no viaja a la partida siguiente', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await removeShareSheet(page)
    await openGame(page)
    await startGame(page, { sticks: 5, difficulty: 'Fácil' })
    await waitForGameOver(page)
    await shareButton(page).click()
    await expect(
      page.getByText('Resultado copiado al portapapeles.'),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Volver al menú' }).click()
    await startGame(page, { sticks: 5, difficulty: 'Fácil' })
    await waitForGameOver(page)

    await expect(
      page.getByText('Resultado copiado al portapapeles.'),
    ).toBeHidden()
  })
})
