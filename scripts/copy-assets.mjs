#!/usr/bin/env node
/**
 * Copia los ficheros estáticos del juego a donde los sirva quien lo monta.
 *
 * El HDRI, las texturas de la madera, los modelos del recinto y los perfiles de
 * mando no viajan en el código: son 3 MB que el navegador pide por HTTP mientras juega. Una
 * aplicación que monte Stick Rush tiene que servirlos desde su propio sitio y
 * decirle dónde con la opción `assetsBase` (ver `docs/mounting-the-game.md`).
 *
 * Uso, desde el proyecto que lo consume:
 *
 *   npx stick-rush-assets public/juegos/stick-rush
 *
 * Es idempotente: se ejecuta otra vez tras subir la versión del juego y deja el
 * destino con los ficheros de la versión nueva.
 */
import { existsSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(packageRoot, 'public')

/** Lo que necesita el juego. El resto de `public/` es de su propia web. */
const ASSETS = ['audio', 'hdri', 'manos', 'models', 'textures', 'webxr-profiles', 'CREDITS.md']

async function main() {
  const target = process.argv[2]
  if (!target) {
    console.error('Uso: stick-rush-assets <directorio de destino>')
    process.exit(1)
  }

  // Antes de tocar el destino: que falte uno solo se nota en el visor y tarde
  // —el escenario sin HDRI, o los mandos sin registrar—, así que aquí se para
  // en vez de dejar la copia a medias. Es la red que avisa si alguna vez se
  // renombra un directorio de `public/` y esta lista se queda atrás.
  const missing = ASSETS.filter((asset) => !existsSync(join(source, asset)))
  if (missing.length > 0) {
    console.error(
      `Faltan en el paquete de Stick Rush: ${missing.join(', ')}. ` +
        'Reinstala la versión del juego; si persiste, es un fallo suyo.',
    )
    process.exit(1)
  }

  const destination = resolve(process.cwd(), target)
  await mkdir(destination, { recursive: true })

  for (const asset of ASSETS) {
    const to = join(destination, asset)
    // Se rehace cada uno desde cero para que al subir de versión no queden
    // ficheros huérfanos de la anterior. Se borra solo lo que se va a copiar:
    // el destino puede ser un directorio compartido con otras cosas.
    await rm(to, { recursive: true, force: true })
    await cp(join(source, asset), to, { recursive: true })
  }

  console.log(`Ficheros de Stick Rush copiados a ${destination}`)
}

await main()
