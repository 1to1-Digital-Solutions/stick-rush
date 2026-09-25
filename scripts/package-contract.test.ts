// @vitest-environment node

/**
 * Que el paquete publicado lleve dentro lo que hace falta para montarlo.
 *
 * `files` decide qué sube a npm, y lo que se deje fuera no falla al empaquetar
 * ni al construir: falla en la aplicación que instala el juego, que importa un
 * módulo que no está o sirve unos ficheros que nunca llegaron.
 *
 * El resto del `package.json` —`exports`, `peerDependencies`, `sideEffects`—
 * lo valida `npm run catalog:validate` desde xrcade al dar de alta el juego
 * (ver `docs/xrcade.md`). Aquí se comprueba lo que aquel no puede saber: que
 * las rutas que declara existen de verdad dentro del paquete, y que la entrada
 * llega con todo lo que importa detrás — que es lo que de verdad decide si el
 * anfitrión puede montarlo.
 */

import { execFile } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

interface PackageManifest {
  exports: Record<string, string>
  bin: Record<string, string>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  sideEffects?: string[]
}

/** Los ficheros que subirían a npm, según lo que declara `files`. */
function packedFiles(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile(
      'npm',
      ['pack', '--dry-run', '--json'],
      { cwd: projectRoot, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout) => {
        if (error != null) {
          reject(error)
          return
        }
        const [tarball] = JSON.parse(stdout) as { files: { path: string }[] }[]
        resolve(tarball.files.map((file) => file.path))
      },
    )
  })
}

/**
 * Módulos que un fichero fuente pide por su nombre: `from '…'`, un import
 * suelto por sus efectos, un `import('…')` diferido o un `require('…')`.
 */
const SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(['"])([^'"]+)\1/g

/** Sufijos que prueba un empaquetador al resolver una ruta relativa. */
const RESOLUTION_ORDER = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

function existsAsFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile()
  } catch {
    return false
  }
}

function resolveRelative(from: string, specifier: string): string | null {
  const base = join(dirname(from), specifier)
  for (const suffix of RESOLUTION_ORDER) {
    const candidate = `${base}${suffix}`
    if (existsAsFile(candidate)) return candidate
  }
  return null
}

/**
 * Todos los ficheros del propio proyecto a los que se llega desde unas entradas,
 * siguiendo sus imports relativos.
 *
 * Los que van por su nombre a secas (`three`, `react`) son los de
 * `peerDependencies` y los pone el anfitrión, así que aquí no cuentan. Un
 * especificador relativo que no resuelva se ignora en vez de fallar: eso ya lo
 * caza el typecheck, y aquí solo se pregunta por lo que se publica.
 */
function reachableFrom(entries: string[]): string[] {
  const seen = new Set<string>()
  const pending = [...entries]

  while (pending.length > 0) {
    const file = pending.pop()
    if (file == null || seen.has(file)) continue
    seen.add(file)
    if (!/\.tsx?$/.test(file)) continue

    for (const [, , specifier] of readFileSync(file, 'utf8').matchAll(
      SPECIFIER,
    )) {
      if (!specifier.startsWith('.')) continue
      const resolved = resolveRelative(file, specifier)
      if (resolved != null) pending.push(resolved)
    }
  }

  return [...seen]
}

/** Rutas relativas de todos los ficheros que hay bajo un directorio. */
async function filesIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort()
}

/**
 * Lo que la lógica del juego no puede nombrar.
 *
 * `src/lib` es el dominio: lo que decide algo y no depende del dibujo. Es también lo
 * único que se puede llevar tal cual al puerto a Godot, y allí el motor **no trae las
 * piezas del navegador**: no hay `Intl` —QuickJS-ng no lo lleva y el V8 de GodotJS se
 * compila sin ICU—, ni `window`, ni `document`, ni `navigator`. Un `toLocaleString` en
 * el marcador no falla aquí: falla allí, y de las dos maneras peores —o revienta, o
 * devuelve la cifra sin separadores y nadie se entera hasta que lo ve un jugador—.
 *
 * Por eso se comprueba sobre el código y no sobre los comentarios: explicar por qué no se
 * usa `Intl` no es usarlo.
 */
const BROWSER_ONLY: { pattern: RegExp; missing: string }[] = [
  { pattern: /\bIntl\b/, missing: '`Intl`, que el motor del puerto no lleva dentro' },
  { pattern: /toLocale/, missing: '`toLocale…`, que necesita `Intl`' },
  { pattern: /\bnavigator\b/, missing: '`navigator`, que fuera del navegador no existe' },
  { pattern: /\bwindow\b/, missing: '`window`, que fuera del navegador no existe' },
  { pattern: /\bdocument\b/, missing: '`document`, que fuera del navegador no existe' },
]

/** El código sin lo que se escribe para leerlo. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}
/**
 * El puerto al navegador de este juego: los ficheros de `src/lib` que sí pueden usarlo.
 *
 * Van nombrados uno a uno y no por comodín a propósito: son exactamente lo que habrá que
 * reescribir para el motor nuevo, así que la lista tiene que costar de alargar. Añadir
 * uno es decir «esto no se porta tal cual», y eso se decide, no se hereda de un patrón.
 */
const BROWSER_PORT = [
  // Los ajustes del arcade vistos desde el navegador: la cookie del idioma y el
  // almacenamiento, con el aviso a las demás pestañas.
  'ajustesCliente.ts',
  // El récord guardado, que se entera si lo cambian desde otra pestaña.
  'highScore.ts',
  // La cuenta de montajes que solo existe si un test la ha pedido antes de cargar.
  'montajes.ts',
  // Dónde están los palos, escrito en `window` solo si el e2e ha pedido la sonda.
  'sceneProbe.ts',
  // El almacenamiento local, con el navegador que lo bloquea contemplado.
  'storage.ts',
]

let packed: string[]
let manifest: PackageManifest

beforeAll(async () => {
  ;[packed, manifest] = await Promise.all([
    packedFiles(),
    readFile(join(projectRoot, 'package.json'), 'utf8').then(
      (raw) => JSON.parse(raw) as PackageManifest,
    ),
  ])
  // Empaquetar arranca npm entero: en una máquina fría se pasa de los cinco
  // segundos por defecto sin que nada vaya mal.
}, 120_000)

describe('lo que el paquete declara', () => {
  it('tiene punto de entrada por defecto, sin el cual el hub no puede importarlo', () => {
    expect(manifest.exports['.']).toBeDefined()
  })

  it('deja React y three al anfitrión', () => {
    // Dos copias de React rompen los hooks y dos de three, la escena. Es el
    // fallo caro porque no rompe el build: rompe la partida.
    const shared = /^(react|react-dom|three)$|^@react-three\//
    const own = Object.keys(manifest.dependencies ?? {}).filter((name) =>
      shared.test(name),
    )
    expect(own).toEqual([])
    expect(
      Object.keys(manifest.peerDependencies ?? {}).sort(),
    ).toContain('three')
  })

  it('marca los estilos como efecto para que el empaquetador no se los coma', () => {
    expect(manifest.sideEffects).toContain('*.css')
  })
})

describe('el paquete que se publica', () => {
  it('lleva dentro todo lo que apunta `exports`', () => {
    const targets = Object.values(manifest.exports).map((target) =>
      target.replace(/^\.\//, ''),
    )

    expect(targets.length).toBeGreaterThan(0)
    expect(targets.filter((target) => !packed.includes(target))).toEqual([])
  })

  it('lleva dentro los módulos que esa entrada importa, no solo la entrada', () => {
    // Publicar el punto de entrada sin lo que hay debajo no falla al empaquetar
    // ni al construir aquí: falla al instalarlo, importando un módulo que no
    // subió. Y no hace falta borrar `src/lib` de `files` para provocarlo: basta
    // con que el juego importe algo de `src/app`, que es de la web y no viaja.
    const entries = Object.values(manifest.exports)
      .map((target) => join(projectRoot, target.replace(/^\.\//, '')))
      .filter((target) => /\.tsx?$/.test(target))

    const reachable = reachableFrom(entries).map((file) =>
      relative(projectRoot, file),
    )

    // Si el rastreo dejara de seguir imports, se quedaría en las entradas y
    // pasaría sin comprobar nada.
    expect(reachable.length).toBeGreaterThan(entries.length)
    expect(reachable.filter((file) => !packed.includes(file))).toEqual([])
  })

  it('lleva dentro el ejecutable que copia los ficheros estáticos', () => {
    const targets = Object.values(manifest.bin).map((target) =>
      target.replace(/^\.\//, ''),
    )

    expect(targets.length).toBeGreaterThan(0)
    expect(targets.filter((target) => !packed.includes(target))).toEqual([])
  })

  it('lleva dentro los ficheros estáticos que ese ejecutable copia', async () => {
    // El ejecutable lee de `public/` dentro del paquete instalado: lo que no
    // suba a npm no está ahí, y `stick-rush-assets` se para diciendo que el
    // paquete llegó incompleto.
    const assets = (await filesIn(join(projectRoot, 'public'))).map(
      (file) => `public/${file}`,
    )

    expect(assets.length).toBeGreaterThan(0)
    expect(assets.filter((asset) => !packed.includes(asset))).toEqual([])
  })

  it('y ese ejecutable copia todo lo que hay en `public/`', async () => {
    // La lista de `copy-assets.mjs` se escribe a mano: un directorio nuevo en `public/` que no
    // se añada ahí funciona en la web del juego y falta en el salón, donde el juego pide un
    // fichero que nadie copió. Se lee del fuente porque importarlo lo ejecutaría.
    const fuente = await readFile(join(projectRoot, 'scripts/copy-assets.mjs'), 'utf8')
    const lista = /const ASSETS = \[([^\]]*)\]/.exec(fuente)
    expect(lista, 'no encuentro la lista ASSETS en copy-assets.mjs').not.toBeNull()
    const copiados = [...lista![1].matchAll(/'([^']+)'/g)].map(([, nombre]) => nombre)

    const enPublic = await readdir(join(projectRoot, 'public'))
    expect(copiados.sort()).toEqual(enPublic.filter((nombre) => !nombre.startsWith('.')).sort())
  })

  it('no lleva los tests, que no le sirven a quien lo monta', () => {
    expect(packed.filter((file) => /\.test\.tsx?$/.test(file))).toEqual([])
  })
})

describe('la lógica que se lleva el puerto a Godot', () => {
  it('no llama a nada que solo exista dentro de un navegador', async () => {
    const lib = join(projectRoot, 'src/lib')
    const sources = (await filesIn(lib)).filter(
      (file) =>
        /\.tsx?$/.test(file) &&
        !/\.test\.tsx?$/.test(file) &&
        !BROWSER_PORT.includes(file),
    )

    // Si el barrido dejara de encontrar ficheros, pasaría sin comprobar nada.
    expect(sources.length).toBeGreaterThan(20)

    const found = sources.flatMap((file) => {
      const source = code(readFileSync(join(lib, file), 'utf8'))
      return BROWSER_ONLY.filter(({ pattern }) => pattern.test(source)).map(
        ({ missing }) => `src/lib/${file} usa ${missing}`,
      )
    })

    expect(
      found,
      'La lógica del juego tiene que correr también fuera de un navegador: en el puerto a' +
        ' Godot no hay Intl, ni window, ni document, ni navigator. Lo que necesite el' +
        ' navegador se saca a src/components (como shareOrCopy.ts); una cifra con los miles' +
        ' separados se pide a formatoDeCifra() de src/lib/textos.ts. Si un fichero de' +
        ' src/lib es de verdad el puerto al navegador, va nombrado en BROWSER_PORT.',
    ).toEqual([])
  })
})
