import { expect, test, type Page } from '@playwright/test'
import { openHost } from './support/host'

/**
 * Entrar en la cabina y volver al salón no deja nada en la GPU.
 *
 * El salón monta y desmonta la escena en cada visita, en el mismo Canvas, y lo que la escena no
 * suelte se queda hasta cerrar la pestaña. El contador de three (`renderer.info.memory`) no lo ve
 * todo: los búferes de las copias de un `<Instances>` no son de ninguna geometría
 * (`disposeInstances.ts`). Así que además se cuentan los búferes y las texturas de WebGL, envolviendo
 * sus `create*` y `delete*`, como el e2e de memoria del salón (`xrcade/e2e/support/medidas.ts`).
 *
 * La primera visita deja lo que se guarda a propósito para la siguiente —los modelos del kit en la
 * caché de `useGLTF`, el HDRI en la de `useLoader`, los planos del PMREM del renderizador— y alguna
 * cosa más que se crea una vez. A partir de ahí, **cada visita tiene que dejar lo mismo que la
 * anterior**. Con el suelo proyectado del HDRI sin soltar subía una geometría y tres búferes por
 * visita (`useSoltarMallas`).
 */

declare global {
  interface Window {
    __THREE_DEVTOOLS__?: EventTarget
    __renderizador?: { info: { memory: { geometries: number; textures: number } } }
    __glVivos?: { buffers: number; textures: number }
  }
}

/** Instala el contador antes de abrir la página. */
async function instrumentar(page: Page) {
  await page.addInitScript(() => {
    const devtools = new EventTarget()
    devtools.addEventListener('observe', (event) => {
      const detail = (event as CustomEvent).detail as { isWebGLRenderer?: boolean }
      if (detail?.isWebGLRenderer === true) window.__renderizador = detail as never
    })
    window.__THREE_DEVTOOLS__ = devtools
    const gl = WebGL2RenderingContext.prototype as unknown as Record<string, (...args: unknown[]) => unknown>
    const vivos = { buffers: 0, textures: 0 }
    window.__glVivos = vivos
    const contar = (crear: string, borrar: string, clave: keyof typeof vivos) => {
      const crea = gl[crear]!
      const borra = gl[borrar]!
      gl[crear] = function (this: unknown, ...args: unknown[]) {
        const hecho = crea.apply(this, args)
        if (hecho != null) vivos[clave]++
        return hecho
      }
      gl[borrar] = function (this: unknown, ...args: unknown[]) {
        if (args[0] != null) vivos[clave]--
        return borra.apply(this, args)
      }
    }
    contar('createBuffer', 'deleteBuffer', 'buffers')
    contar('createTexture', 'deleteTexture', 'textures')
  })
}

type Vivo = { geometrias: number; texturas: number; bufferes: number; texturasGL: number }

function leer(page: Page): Promise<Vivo> {
  return page.evaluate(() => ({
    geometrias: window.__renderizador!.info.memory.geometries,
    texturas: window.__renderizador!.info.memory.textures,
    bufferes: window.__glVivos!.buffers,
    texturasGL: window.__glVivos!.textures,
  }))
}

/** Lo que queda cuando deja de cambiar: cuatro lecturas iguales seguidas, cada medio segundo. */
async function asentado(page: Page): Promise<Vivo> {
  let anterior = ''
  let iguales = 0
  for (let i = 0; i < 90 && iguales < 4; i++) {
    await page.waitForTimeout(500)
    const ahora = JSON.stringify(await leer(page))
    iguales = ahora === anterior ? iguales + 1 : 0
    anterior = ahora
  }
  return leer(page)
}

test('entrar en la cabina y volver al salón no deja búferes ni geometrías', async ({ page }) => {
  await instrumentar(page)
  await openHost(page, undefined, { aLaCarta: true })
  await expect.poll(() => page.evaluate(() => window.__renderizador != null)).toBe(true)

  const alSalir: Vivo[] = []
  for (let visita = 1; visita <= 4; visita++) {
    await page.evaluate(() => window.__stickRushHost.entrarEnLaCabina())
    const dentro = await asentado(page)
    expect(dentro.geometrias, 'la escena no llegó a montarse').toBeGreaterThan(10)
    await page.evaluate(() => window.__stickRushHost.salirDeLaCabina())
    alSalir.push(await asentado(page))
    console.log(`[liberar] visita ${visita}: dentro ${JSON.stringify(dentro)}, al salir ${JSON.stringify(alSalir.at(-1))}`)
  }

  // La primera visita llena las cachés; desde la segunda, cada una deja lo mismo que la anterior.
  for (let visita = 2; visita < alSalir.length; visita++) {
    expect(alSalir[visita], `la visita ${visita + 1} dejó más que la ${visita}`).toEqual(alSalir[visita - 1])
  }
})
