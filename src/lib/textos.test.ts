import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GAME_MODE_HINTS, GAME_MODE_LABELS } from './gameMode'
import { DIFFICULTY_LABELS } from './gameConfig'
import { TEXT_KEYS, formatea, formatoDeCifra, texto, traductor, traductorSuave } from './textos'
import { OBJETIVO_ES } from './objetivo'
import { PLAYER_COUNT_HINTS, PLAYER_COUNT_LABELS, PLAYER_LABELS } from './duel'
import { MENU_ES, plural } from './palabras'

/**
 * El diccionario del juego.
 *
 * Que las claves existan lo comprueba TypeScript —salen del propio objeto—, así
 * que aquí se mira lo que el tipo no ve: que en inglés se devuelva el original
 * sin guardarlo dos veces, que en español no quede nada sin traducir, y que las
 * etiquetas que vienen de los mapas de configuración estén en el diccionario.
 * Ese último es el que se rompe solo: se añade una dificultad y nadie se acuerda.
 */
describe('los huecos de una frase', () => {
  it('se rellenan con lo que se da, y lo que no se da se queda como estaba', () => {
    expect(formatea('{player} wins', { player: 'Player 1' })).toBe('Player 1 wins')
    expect(formatea('{player}: {points}', { player: 'P' })).toBe('P: {points}')
  })
})

describe('el traductor del cartel del objetivo', () => {
  it('traduce lo que está en el diccionario y rellena los huecos', () => {
    const es = traductorSuave('es')
    expect(es('Lives')).toBe('Vidas')
    expect(es('{medal} at {target} · you have {score}', { medal: es('Silver'), target: 3750, score: 2100 })).toBe(
      'Plata a 3750 · llevas 2100',
    )
  })

  it('en inglés devuelve la frase, con sus huecos rellenos', () => {
    const en = traductorSuave('en')
    expect(en('Lives')).toBe('Lives')
    expect(en('Your record {record}', { record: 3100 })).toBe('Your record 3100')
  })

  it('lo que no está en el diccionario sale tal cual: la unidad llega ya traducida del salón', () => {
    const es = traductorSuave('es')
    expect(es('puntos en el reto')).toBe('puntos en el reto')
    // Ni lo que solo se parece a una clave por venir de más arriba que el objeto.
    expect(es('toString')).toBe('toString')
  })

  it('el diccionario lleva todas las frases comunes del cartel, y las del juego mandan sobre ellas', () => {
    for (const [clave, frase] of Object.entries(OBJETIVO_ES)) {
      expect(texto('es', clave as keyof typeof OBJETIVO_ES), clave).toBe(frase)
    }
    expect(texto('es', 'Challenge')).toBe('Reto')
  })
})

describe('el diccionario', () => {
  it('en inglés devuelve la propia clave', () => {
    expect(texto('en', 'Back to the menu')).toBe('Back to the menu')
    expect(texto('en', 'Points')).toBe('Points')
  })

  it('en español traduce', () => {
    expect(texto('es', 'Back to the menu')).toBe('Volver al menú')
    expect(traductor('es')('Game over!')).toBe('¡Partida terminada!')
  })

  it('dice el plural que toca, con uno y con dos, en los dos idiomas', () => {
    const decir = (lang: 'en' | 'es', n: number, una: string, varias: string) => traductorSuave(lang)(plural(n, una, varias), { n, stars: n })
    expect(decir('en', 1, '{stars} star', '{stars} stars')).toBe('1 star')
    expect(decir('en', 2, '{stars} star', '{stars} stars')).toBe('2 stars')
    expect(decir('es', 1, '{stars} star', '{stars} stars')).toBe('1 estrella')
    expect(decir('es', 2, '{stars} star', '{stars} stars')).toBe('2 estrellas')
    expect(decir('en', 1, '≈ {n} stick', '≈ {n} sticks')).toBe('≈ 1 stick')
    expect(decir('en', 2, '≈ {n} stick', '≈ {n} sticks')).toBe('≈ 2 sticks')
    expect(decir('es', 1, '≈ {n} stick', '≈ {n} sticks')).toBe('≈ 1 palo')
    expect(decir('es', 2, '≈ {n} stick', '≈ {n} sticks')).toBe('≈ 2 palos')
  })

  it('traduce todas las etiquetas de los mapas de configuración', () => {
    // Si un modo o una dificultad gana una entrada y no se traduce, esto cae
    // antes de que nadie vea el juego a medias en español.
    const etiquetas = [
      ...Object.values(GAME_MODE_LABELS),
      ...Object.values(GAME_MODE_HINTS),
      ...Object.values(DIFFICULTY_LABELS),
      ...Object.values(PLAYER_COUNT_LABELS),
      ...Object.values(PLAYER_COUNT_HINTS),
      ...PLAYER_LABELS,
    ]
    // Las comunes que se dicen igual en los dos idiomas («Solo») no cuentan.
    const iguales = Object.entries(MENU_ES).filter(([en, es]) => en === es).map(([en]) => en)
    const sinTraducir = etiquetas.filter((e) => texto('es', e) === e && !iguales.includes(e))
    expect(sinTraducir).toEqual([])
  })
})

/** Dónde vive el código del juego, para leerlo entero. */
const SRC = join(import.meta.dirname, '..')

/** Todo el código del juego en un solo texto, menos el propio diccionario y los tests. */
function codigo(carpeta = ''): string {
  return readdirSync(join(SRC, carpeta), { withFileTypes: true })
    .map((entrada) => {
      const ruta = join(carpeta, entrada.name)
      if (entrada.isDirectory()) return codigo(ruta)
      if (!/\.tsx?$/.test(entrada.name) || /\.test\.tsx?$/.test(entrada.name)) return ''
      if (entrada.name === 'textos.ts') return ''
      return readFileSync(join(SRC, ruta), 'utf8')
    })
    .join('\n')
}

describe('el diccionario no acumula', () => {
  it('ni le falta ninguna de las que se dicen', () => {
    // El reverso del otro, y el que faltaba: aquel caza una clave declarada que ya no usa
    // nadie —molesta pero inofensiva—, y este una que **se usa y no está declarada**, que es
    // la que se ve. En bateo, `t('Fastest')` devolvía `undefined` y el marcador del reto
    // pintaba una fila con su cifra y sin nombre, solo en español.
    const fuente = codigo()
    const usadas = [...fuente.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1])
    const faltan = [...new Set(usadas)].filter(
      (clave) => !(TEXT_KEYS as readonly string[]).includes(clave),
    )

    expect(faltan).toEqual([])
  })

  it('no guarda frases que ya no dice nadie', () => {
    // Una frase cambia en el componente y la vieja se queda aquí traducida para siempre:
    // no rompe nada, y por eso nadie la quita nunca. Los otros doce ya lo vigilan; este no.
    const fuente = codigo()
    const huerfanas = TEXT_KEYS.filter((clave) => !fuente.includes(clave))

    expect(huerfanas).toEqual([])
  })
})

/**
 * Las cifras que se enseñan.
 *
 * Se prueba con números y no con `toLocaleString` delante porque es justo lo contrario
 * de lo que se busca: el formato tiene que salir de aquí, que es lo único que el motor
 * del visor y el del puerto a Godot ejecutan igual.
 */
describe('las cifras que enseña el juego', () => {
  it('separa los miles con punto en español y con coma en inglés', () => {
    expect(formatoDeCifra(1000, 'en')).toBe('1,000')
    expect(formatoDeCifra(12400, 'es')).toBe('12.400')
    expect(formatoDeCifra(12400, 'en')).toBe('12,400')
    expect(formatoDeCifra(1234567, 'es')).toBe('1.234.567')
    expect(formatoDeCifra(1234567, 'en')).toBe('1,234,567')
  })

  it('en español agrupa desde las cinco cifras, como el cartel de objetivo y la cabina del salón', () => {
    // La regla de la RAE y de CLDR: «2100», no «2.100». El inglés sí agrupa desde las cuatro.
    expect(formatoDeCifra(1000, 'es')).toBe('1000')
    expect(formatoDeCifra(2100, 'es')).toBe('2100')
    expect(formatoDeCifra(9999, 'es')).toBe('9999')
    expect(formatoDeCifra(9999.6, 'es')).toBe('10.000')
    expect(formatoDeCifra(10000, 'es')).toBe('10.000')
    expect(formatoDeCifra(2100, 'en')).toBe('2,100')
  })

  it('deja tal cual lo que no llega a mil', () => {
    expect(formatoDeCifra(0, 'es')).toBe('0')
    expect(formatoDeCifra(0, 'en')).toBe('0')
    expect(formatoDeCifra(7, 'es')).toBe('7')
    expect(formatoDeCifra(7, 'en')).toBe('7')
    expect(formatoDeCifra(999, 'es')).toBe('999')
    expect(formatoDeCifra(999, 'en')).toBe('999')
  })

  it('conserva el signo de lo que va en negativo', () => {
    expect(formatoDeCifra(-7, 'es')).toBe('-7')
    expect(formatoDeCifra(-7, 'en')).toBe('-7')
    expect(formatoDeCifra(-1234, 'es')).toBe('-1234')
    expect(formatoDeCifra(-12345, 'es')).toBe('-12.345')
    expect(formatoDeCifra(-1234, 'en')).toBe('-1,234')
    // Menos de medio punto por debajo de cero es cero, y no «-0».
    expect(formatoDeCifra(-0.4, 'es')).toBe('0')
    expect(formatoDeCifra(-0.4, 'en')).toBe('0')
  })

  it('cuenta como cero lo que no es un número', () => {
    // El récord sale del almacenamiento, que cualquiera puede editar a mano.
    expect(formatoDeCifra(Number.NaN, 'es')).toBe('0')
    expect(formatoDeCifra(Number.POSITIVE_INFINITY, 'en')).toBe('0')
  })
})
