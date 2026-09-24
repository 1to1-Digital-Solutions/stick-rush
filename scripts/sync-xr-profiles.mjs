/**
 * Copia los perfiles de mando de WebXR a `public/webxr-profiles/`.
 *
 * **Por qué hace falta.** @react-three/xr necesita el perfil del mando para
 * saber qué botón es cuál, y por defecto lo descarga de `cdn.jsdelivr.net`. Ese
 * fetch lo bloquea la CSP del juego (`connect-src 'self'`), y también lo
 * bloquearía un visor sin salida a internet. Cuando falla, la librería se traga
 * el error y **nunca llega a registrar el mando**: no se monta ni el rayo ni el
 * puntero, que en el visor es quedarse sin poder tocar nada.
 *
 * De los `profile.json` se copian **todos**: son ficheros pequeños y hace falta
 * el del mando que traiga quien juegue, sea cual sea.
 *
 * De los `.glb` con los modelos 3D —los 100 MB largos del paquete— solo se
 * copian los de `MODELOS`. Jugando, el mando lo dibuja el propio juego con
 * geometría suya (`XRController.tsx`); el único sitio donde hace falta el
 * modelo del fabricante es el tutorial, que enseña el botón encendido sobre el
 * mando que se tiene en la mano (`MandoDeVerdad.tsx`), y ahí un mando que no
 * esté en la lista se queda con el dibujo del panel y no se rompe nada.
 *
 * Uso: `npm run sync:xr-profiles`. El resultado se commitea, así que esto solo
 * hay que ejecutarlo al actualizar `@webxr-input-profiles/assets`.
 */
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(
  root,
  'node_modules/@webxr-input-profiles/assets/dist/profiles',
)
const destination = join(root, 'public/webxr-profiles')

const LIST = 'profilesList.json'

/**
 * De qué mandos se copia además el modelo 3D.
 *
 * Los dos de Quest, que es el visor del arcade: `meta-quest-touch-plus` son los
 * del Quest 3 y 3S, y `oculus-touch-v3` los del Quest 2. Entre los cuatro
 * ficheros —las dos manos de cada uno— son 1,7 MB de los 97 del paquete.
 *
 * Añadir un mando es escribir aquí su identificador; quitarlo, borrarlo. Lo que
 * no esté no falla: el tutorial se queda con el dibujo.
 */
const MODELOS = ['meta-quest-touch-plus', 'oculus-touch-v3']

/**
 * La mano articulada que pinta la escena cuando se juega con las manos
 * desnudas (`ManosDelJugador.tsx`, ruta en `lib/manos.ts`): 190 KB, sin
 * texturas, servida con el juego porque la CSP bloquea el CDN.
 *
 * **Va en `public/manos/`, fuera de `webxr-profiles/`**, por dos motivos: el
 * salón de xrcade **borra** los `webxr-profiles/` de cada juego al instalarlo
 * (sirve los suyos, `install-game-assets.ts`), así que ahí dentro la mano no
 * llegaría a donde más se juega; y todo `.glb` de la raíz de los perfiles se
 * toma por un mando con modelo (`mandoDeVerdad.test.ts`).
 */
const MANO = 'generic-hand'
const MANOS_DIR = join(root, 'public/manos')

/** Las dos manos de cada modelo, tal y como se llaman los ficheros del paquete. */
const MANOS = ['left.glb', 'right.glb']


async function main() {
  const list = JSON.parse(await readFile(join(source, LIST), 'utf8'))

  // Se rehace desde cero para que al actualizar el paquete no queden perfiles
  // huérfanos de una versión anterior.
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  await copyFile(join(source, LIST), join(destination, LIST))

  let copied = 0
  for (const [id, info] of Object.entries(list)) {
    const path = info?.path
    if (typeof path !== 'string') {
      throw new Error(`El perfil "${id}" no declara ruta en ${LIST}`)
    }
    const target = join(destination, path)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(join(source, path), target)
    copied++
  }

  let modelos = 0
  for (const id of MODELOS) {
    for (const mano of MANOS) {
      // Un identificador mal escrito aquí pasaría desapercibido —el tutorial se
      // quedaría sin modelo y sin decir por qué—, así que se cae al copiar.
      await copyFile(join(source, id, mano), join(destination, id, mano))
      modelos++
    }
  }

  console.log(
    `${copied} perfiles de mando y ${modelos} modelos copiados a public/webxr-profiles/`,
  )

  await rm(MANOS_DIR, { recursive: true, force: true })
  await mkdir(join(MANOS_DIR, MANO), { recursive: true })
  for (const mano of MANOS) {
    await copyFile(join(source, MANO, mano), join(MANOS_DIR, MANO, mano))
  }
  console.log(`Mano articulada (${MANO}) copiada a public/manos/`)
}

await main()
