/**
 * Copia los perfiles de mando de WebXR a `public/webxr-profiles/`.
 *
 * **Por qué hace falta.** @react-three/xr necesita el perfil del mando para
 * saber qué botón es cuál, y por defecto lo descarga de `cdn.jsdelivr.net`. Ese
 * fetch lo bloquea nuestra CSP (`connect-src 'self'`) —y también lo bloquearía
 * un visor sin salida a internet—. Cuando falla, la librería se traga el error
 * en un `.catch(console.error)` y **nunca llega a registrar el mando**: no se
 * monta ni el modelo, ni el rayo, ni el puntero de agarre. El resultado en el
 * visor era quedarse sin mandos y sin poder pulsar nada.
 *
 * Solo se copian los `profile.json` (528 KB en total). Los `.glb` con los
 * modelos 3D —los 100 MB largos del paquete— no se tocan: el mando lo dibuja el
 * juego con geometría propia en `XRController.tsx`.
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

  console.log(`${copied} perfiles de mando copiados a public/webxr-profiles/`)
}

await main()
