import { expect, test } from '@playwright/test'

import { ASSETS_BASE, buscarEnLaEscena, enterHostVR, openHost } from './support/host'
import { installXREmulator, placeHand, useBareHands } from './support/xr'

/**
 * Las manos, montado dentro del salón.
 *
 * El guante y la mano articulada colgaban antes del store de WebXR del propio juego (su
 * `controller`, su `hand.model`), y dentro del salón el store es del salón, que no dibuja
 * manos: justo donde más se juega, quien iba a por un palo no veía dónde tenía la mano. Ahora
 * las monta la escena (`ManosDelJugador`), y esto lo comprueba con la escena metida en un
 * Canvas ajeno cuyo store, como el del salón, no dibuja nada en la mano.
 *
 * Desde fuera del Canvas no se ve la geometría, así que el anfitrión deja buscar por nombre
 * (`guante-right`, `mano-desnuda-right`): si está, si se pinta y dónde.
 */

/** Dónde se pone la mano: delante y un poco a la derecha, a la altura del pecho. */
const DELANTE = { x: 0.2, y: 1.3, z: -0.35 }

test('con mandos, el guante va en la mano aunque el store sea del anfitrión', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await installXREmulator(page)
  await openHost(page)
  await enterHostVR(page)
  await placeHand(page, 'right', DELANTE)

  await expect
    .poll(() => buscarEnLaEscena(page, 'guante-right'), {
      message: 'el guante de la mano derecha no llegó a pintarse',
    })
    .toMatchObject({ visible: true })

  // Y donde está el mando, no donde está el mundo: la escena lo baja y lo corre, y el guante
  // tiene que quedarse en la mano igual.
  const guante = await buscarEnLaEscena(page, 'guante-right')
  expect(guante).not.toBeNull()
  const lejos = Math.hypot(guante!.x - DELANTE.x, guante!.y - DELANTE.y, guante!.z - DELANTE.z)
  expect(lejos).toBeLessThan(0.12)

  // Uno por mano, no dos: el `controller` del anfitrión no dibuja nada suyo.
  expect(await buscarEnLaEscena(page, 'guante-left')).not.toBeNull()
  expect(errors).toEqual([])
})

test('con las manos desnudas, la mano articulada sale del juego y no de la raíz', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await installXREmulator(page)
  const { requested } = await openHost(page)
  await enterHostVR(page)
  // Se entra con mandos y se sueltan, que es lo que se hace con el visor. Hay que esperar a que
  // estén registrados: @react-three/xr los registra al cargar su perfil, y si se desconectan
  // antes, los da de alta igual después y se quedan colgados (en el visor la pose de un mando
  // que ya no está no llega, y el guante se esconde; en el emulador sí llega).
  await expect.poll(() => buscarEnLaEscena(page, 'guante-right')).not.toBeNull()
  await useBareHands(page)

  await expect
    .poll(() => buscarEnLaEscena(page, 'mano-desnuda-right'), {
      message: 'la mano desnuda derecha no llegó a pintarse',
    })
    .toMatchObject({ visible: true })
  await expect
    .poll(() => buscarEnLaEscena(page, 'mano-desnuda-left'))
    .toMatchObject({ visible: true })

  // El modelo se pide bajo el prefijo del juego —la raíz del salón no lo tiene— y fuera de sus
  // `webxr-profiles/`, que el salón borra de cada juego al instalarlo porque sirve la suya.
  expect(requested).toContain(`${ASSETS_BASE}manos/generic-hand/right.glb`)
  const otrasRutas = requested.filter(
    (ruta) => ruta.includes('/generic-hand/') && !ruta.startsWith(`${ASSETS_BASE}manos/`),
  )
  expect(otrasRutas).toEqual([])

  // Al soltar los mandos, el guante se va.
  await expect.poll(() => buscarEnLaEscena(page, 'guante-right')).toBeNull()
  expect(errors).toEqual([])
})
