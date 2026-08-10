import { expect, test } from '@playwright/test'
import { openGame } from './helpers'

test.describe('Menú de inicio', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('presenta el juego sobre la escena 3D ya montada', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'STICK RUSH' })).toBeVisible()
    await expect(
      page.getByText('Atrapa los palos antes de que toquen el suelo.'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jugar' })).toBeVisible()
  })

  test('ofrece de 5 a 13 palos, con 5 preseleccionado', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Número de palos' })
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
    const section = page.getByRole('region', { name: 'Dificultad' })
    await expect(section.getByRole('button')).toHaveCount(5)
    await expect(section.getByRole('button')).toHaveText([
      'Fácil',
      'Medio',
      'Difícil',
      'Experto',
      'Imposible',
    ])
    await expect(section.getByRole('button', { name: 'Fácil' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('solo hay una dificultad activa a la vez', async ({ page }) => {
    await page.getByRole('button', { name: 'Difícil', exact: true }).click()

    await expect(
      page.getByRole('button', { name: 'Difícil', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('button', { name: 'Fácil', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  test('deja silenciar el juego, con el estado a la vista', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Silenciar' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  test('esconde la entrada al visor en un navegador sin WebXR', async ({
    page,
  }) => {
    await expect(page.getByRole('button', { name: /Entrar en/ })).toHaveCount(0)
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
    await page.getByRole('button', { name: 'Jugar' }).click()
    await expect(page.getByRole('status')).toBeVisible()

    expect(external).toEqual([])
  })

  test('la ruta /game abre la misma escena', async ({ page }) => {
    await openGame(page, '/game')
    await expect(page.getByRole('button', { name: 'Jugar' })).toBeVisible()
  })

  test('se puede recorrer y jugar solo con el teclado', async ({ page }) => {
    await page.getByRole('button', { name: '5', exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: '6', exact: true })).toBeFocused()

    await page.getByRole('button', { name: 'Jugar' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toBeVisible()
  })
})
