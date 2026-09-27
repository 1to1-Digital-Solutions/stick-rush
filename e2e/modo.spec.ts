import { expect, test } from '@playwright/test'
import { HIGH_SCORE_KEYS } from '@/lib/highScore'
import { DIFFICULTY_LABELS } from '@/lib/gameConfig'
import { CHALLENGE_SETUP } from '@/lib/gameMode'
import {
  catchStick,
  modeButton,
  openGame,
  readLives,
  startGame,
  waitForGameOver,
} from './helpers'

/**
 * Práctica y desafío.
 *
 * Lo que se juega aquí es el recorrido entero del modo nuevo: elegirlo en el
 * menú, ver las vidas durante la partida y que el desafío se cierre al gastar
 * la tercera. Las reglas en sí (cuándo se acaba, cuántas vidas quedan) las
 * fijan los unitarios de `gameMode.ts`, que no dependen del reloj.
 */

test.describe('Modo de juego', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
  })

  test('el menú ofrece los tres modos, con Práctica puesta', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Mode' })
    await expect(section.getByRole('button')).toHaveCount(3)
    await expect(modeButton(page, 'Practice')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(modeButton(page, 'Challenge')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // Lo que pone en juego cada uno se lee sin entrar a la partida.
    await expect(section).toContainText('Three lives')
  })

  test('elegir desafío deja la selección a la vista, y nada más que preguntar', async ({ page }) => {
    await modeButton(page, 'Challenge').click()

    // El desafío va fijo: de la práctica a Jugar, sin palos ni velocidad que elegir.
    await expect(page.getByRole('region', { name: 'Number of sticks' })).toBeHidden()
    await expect(page.getByRole('region', { name: 'Difficulty' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()

    await expect(modeButton(page, 'Challenge')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(modeButton(page, 'Practice')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('en práctica el marcador no habla de vidas', async ({ page }) => {
    await startGame(page, { sticks: 5, difficulty: 'Easy', mode: 'Practice' })

    expect(await readLives(page)).toBeNull()
  })

  test('en desafío el marcador enseña las vidas y bajan al escaparse un palo', async ({
    page,
  }) => {
    await startGame(page, { sticks: CHALLENGE_SETUP.stickCount, mode: 'Challenge' })

    expect(await readLives(page)).toBe(3)
    // Sin tocar nada, el primer palo se estrella y se lleva una vida.
    await expect.poll(() => readLives(page)).toBe(2)
  })

  test('el desafío se acaba al gastar la última vida, antes que la práctica', async ({
    page,
  }) => {
    // La misma partida en los dos modos: en práctica hay que esperar a que
    // caigan todos los palos y en desafío se cierra con el tercer fallo. Se
    // comparan los tiempos entre sí, y no contra un número de segundos, porque
    // una máquina cargada estira las dos por igual. El desafío va fijo, así que
    // la práctica se pone igual que él.
    await startGame(page, { sticks: CHALLENGE_SETUP.stickCount, mode: 'Challenge' })
    const challengeStart = Date.now()
    await waitForGameOver(page)
    const challengeMs = Date.now() - challengeStart

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('You are out of lives')
    await page.getByRole('button', { name: 'Back to the menu' }).click()

    await startGame(page, {
      sticks: CHALLENGE_SETUP.stickCount,
      difficulty: DIFFICULTY_LABELS[CHALLENGE_SETUP.difficulty],
      mode: 'Practice',
    })
    const practiceStart = Date.now()
    await waitForGameOver(page)
    const practiceMs = Date.now() - practiceStart

    await expect(dialog).toContainText('Game over!')
    // Tres palos de cinco: el tercero toca el suelo antes que el último. Si
    // algún día el desafío dejara de cortarse, aquí se ve.
    expect(challengeMs).toBeLessThan(practiceMs)
  })

  test('al terminar, el desafío enseña la puntuación y las vidas que quedaron', async ({
    page,
  }) => {
    // Son los dos datos que resumen un desafío, y los que luego se comparten.
    await startGame(page, { sticks: CHALLENGE_SETUP.stickCount, mode: 'Challenge' })
    await waitForGameOver(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('You are out of lives')
    await expect(dialog).toContainText('Lives')
    await expect(dialog).toContainText('0 / 3')
    await expect(dialog).toContainText('possible')
    await expect(dialog).toContainText(DIFFICULTY_LABELS[CHALLENGE_SETUP.difficulty])
  })

  test('vaciar el aro con vidas de sobra es superar el reto', async ({
    page,
  }) => {
    // La otra mitad del modo: un desafío no solo se pierde. Los palos cuelgan
    // atrapables desde el primer segundo, así que cogiéndolos según se puede da
    // tiempo a vaciar el aro, y ahí el final es otro y las vidas sobreviven.
    await startGame(page, { sticks: CHALLENGE_SETUP.stickCount, mode: 'Challenge' })

    const dialog = page.getByRole('dialog')
    // Se atrapa hasta que la partida se cierra sola: si algún palo se escapa
    // por el camino el desafío sigue vivo —para eso hay tres vidas— y quedan
    // menos que coger, así que el tope es el número de palos.
    for (
      let attempt = 0;
      attempt < CHALLENGE_SETUP.stickCount && !(await dialog.isVisible());
      attempt++
    ) {
      await catchStick(page)
    }

    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Challenge cleared!')
    // Sobrevivir con vidas es el resultado, no cuántas exactamente: un palo
    // perdido por el camino no cambia el desenlace.
    await expect(dialog).toContainText(/[1-3] \/ 3/)
  })

  test('el modo elegido sigue puesto al volver al menú', async ({ page }) => {
    await startGame(page, { sticks: CHALLENGE_SETUP.stickCount, mode: 'Challenge' })
    await waitForGameOver(page)

    await page.getByRole('button', { name: 'Back to the menu' }).click()

    await expect(modeButton(page, 'Challenge')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('cada modo tiene su récord y el menú dice de cuál habla', async ({
    page,
  }) => {
    // Un desafío se corta al quedarse sin vidas, así que nunca podría batir la
    // marca de una práctica con los mismos palos: con un récord compartido, el
    // modo con algo en juego sería el único sin nada que superar.
    await page.addInitScript(
      (key) => window.localStorage.setItem(key, '99999'),
      HIGH_SCORE_KEYS.practice,
    )
    await openGame(page)

    await expect(page.getByText(/^Best score/)).toContainText('Practice')
    await expect(page.getByText(/^Best score/)).toContainText('99,999')

    await modeButton(page, 'Challenge').click()

    // El desafío empieza sin marca propia, y la de práctica no se le presta.
    await expect(page.getByText(/^Best score/)).toHaveCount(0)
  })
})
