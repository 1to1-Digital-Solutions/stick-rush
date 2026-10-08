import { expect, test } from '@playwright/test'
import { catchHangingStick, modeButton, openGame, waitForGameOver } from './helpers'

/**
 * La partida a dos, de punta a punta en el navegador: elegir el desafío y a dos, jugar la tanda
 * del primero, ver el aviso de pasar el mando, jugar la del segundo y ver quién gana y lo que
 * lleva la pareja.
 *
 * Las reglas —la misma semilla, quién gana, el empate— las prueba `lib/duel.ts` sin navegador;
 * aquí se comprueba que lleguen a la pantalla. Cada tanda se acaba sola con la tercera vida.
 */
test('a dos: el primero juega, le pasa el mando al segundo y al acabar sale quién gana', async ({ page }) => {
  await openGame(page)
  await modeButton(page, 'Challenge').click()
  await expect(page.getByRole('region', { name: 'Who you play against' })).toBeVisible()
  await page.getByRole('button', { name: /^Duel/ }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  // El marcador dice de quién es la tanda.
  await expect(page.getByText('Player 1', { exact: true })).toBeVisible()
  await expect(page.getByRole('timer')).toBeHidden()
  await catchHangingStick(page)
  await waitForGameOver(page)

  // El aviso de pasar el mando, y el botón de empezar dicho para quien lo va a pulsar.
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Pass the controller to Player 2.')
  await page.getByRole('button', { name: 'Player 2, your turn' }).click()

  await expect(page.getByText('Player 2', { exact: true })).toBeVisible()
  await waitForGameOver(page)

  // El primero atrapó uno y el segundo ninguno: gana el primero, y se apunta a la pareja.
  await expect(dialog.getByRole('heading', { name: 'Player 1 wins' })).toBeVisible()
  await expect(dialog).toContainText('Duels won: 1–0 · tied: 0')

  // De vuelta al menú, lo que lleva la pareja sigue ahí, y el récord del desafío no se ha tocado.
  await page.getByRole('button', { name: 'Back to the menu' }).click()
  await expect(page.getByText('Duels won: 1–0 · tied: 0')).toBeVisible()
  await page.getByRole('button', { name: /^On your own/ }).click()
  await expect(page.getByText(/Best score in/)).toHaveCount(0)
})
